import { useEffect, useRef, useState } from 'react'
import CodeBlock from '@tiptap/extension-code-block'
import type { ReactNodeViewProps } from '@tiptap/react'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import mermaid from 'mermaid'

// Configure mermaid once at module load
let mermaidInitialized = false

function ensureMermaidInit(): void {
  if (mermaidInitialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    darkMode: true,
    themeVariables: {
      primaryColor: '#1e293b',
      primaryBorderColor: '#475569',
      primaryTextColor: '#e2e8f0',
      lineColor: '#94a3b8',
      secondaryColor: '#334155',
      tertiaryColor: '#1e293b',
      fontFamily: 'var(--font-mono)',
      fontSize: '14px'
    }
  })
  mermaidInitialized = true
}

let renderCounter = 0

function MermaidDiagram({ code }: { code: string }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code.trim() || !containerRef.current) return

    ensureMermaidInit()

    const id = `mermaid-${++renderCounter}`

    mermaid
      .render(id, code.trim())
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            // Extract natural dimensions from the viewBox and set them
            // explicitly so the diagram isn't squashed into the container.
            const vb = svgEl.getAttribute('viewBox')
            if (vb) {
              const parts = vb.split(/[\s,]+/)
              const vbWidth = parseFloat(parts[2])
              const vbHeight = parseFloat(parts[3])
              if (vbWidth && vbHeight) {
                svgEl.setAttribute('width', `${vbWidth}px`)
                svgEl.setAttribute('height', `${vbHeight}px`)
              }
            }
            svgEl.style.maxWidth = 'none'
          }
          setError(null)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [code])

  if (error) {
    return (
      <div className="mermaid-error">
        <span className="mermaid-error-label">Mermaid syntax error</span>
        <pre>{code}</pre>
      </div>
    )
  }

  return <div ref={containerRef} className="mermaid-diagram" />
}

function MermaidCodeBlockView({ node }: ReactNodeViewProps): React.ReactElement {
  const language = (node.attrs as Record<string, string>).language

  if (language === 'mermaid') {
    return (
      <NodeViewWrapper className="mermaid-block" contentEditable={false}>
        <div className="mermaid-label">mermaid</div>
        <MermaidDiagram code={node.textContent} />
        {/* Hidden content keeps ProseMirror model in sync for serialization */}
        <div style={{ display: 'none' }}>
          <NodeViewContent />
        </div>
      </NodeViewWrapper>
    )
  }

  // Default code block rendering for non-mermaid languages
  return (
    <NodeViewWrapper>
      <pre className={language ? `language-${language}` : undefined}>
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}

export const MermaidCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidCodeBlockView)
  }
})
