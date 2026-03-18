# Creation Wizards Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add creation wizards to the Claude Config Canvas so users can create commands, agents, skills, memory, and rules from zone "+" buttons with best-practice templates.

**Architecture:** Inspector panel gets a creation mode that renders a form + code editor for each config type. Zone labels get "+" buttons. File creation uses existing IPC `writeFile`/`mkdir`. Canvas refreshes after creation via existing `handleRefresh`.

**Tech Stack:** React 18, TypeScript, Zustand, CodeMirror 6, Tailwind v4, Electron IPC

**Spec:** `docs/superpowers/specs/2026-03-18-creation-wizards-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/renderer/src/panels/claude-config/creation-templates.ts` | CREATE | Pure functions: `slugify()`, per-type template generators, tool list constant |
| `src/renderer/src/panels/claude-config/CreationInspector.tsx` | CREATE | Form + editor component for creating config files |
| `src/renderer/src/store/inspector-store.ts` | MODIFY | Add `creationMode` state, `startCreation`/`cancelCreation` actions |
| `src/renderer/src/panels/canvas/claude/claude-canvas-layout.ts` | MODIFY | Add `configType` field to `ZoneLabel` interface and populate per zone |
| `src/renderer/src/panels/claude-config/ClaudeConfigPanel.tsx` | MODIFY | Route creation state to `CreationInspector`, wire `onCreated` callback |
| `tests/engine/creation-templates.test.ts` | CREATE | Unit tests for templates and slugify |

---

### Task 1: Creation Templates (Pure Functions)

**Files:**
- Create: `src/renderer/src/panels/claude-config/creation-templates.ts`
- Create: `tests/engine/creation-templates.test.ts`

- [ ] **Step 1: Write failing tests for slugify**

```typescript
// tests/engine/creation-templates.test.ts
import { describe, it, expect } from 'vitest'
import { slugify } from '../../src/renderer/src/panels/claude-config/creation-templates'

describe('creation-templates', () => {
  describe('slugify', () => {
    it('lowercases and replaces spaces with hyphens', () => {
      expect(slugify('My Command')).toBe('my-command')
    })

    it('strips special characters', () => {
      expect(slugify('hello@world!')).toBe('helloworld')
    })

    it('collapses consecutive hyphens', () => {
      expect(slugify('a--b---c')).toBe('a-b-c')
    })

    it('trims leading/trailing hyphens', () => {
      expect(slugify('-hello-')).toBe('hello')
    })

    it('replaces underscores with hyphens', () => {
      expect(slugify('my_command')).toBe('my-command')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(slugify('   ')).toBe('')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/engine/creation-templates.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement slugify and template generators**

```typescript
// src/renderer/src/panels/claude-config/creation-templates.ts

export type ConfigType = 'command' | 'agent' | 'skill' | 'memory' | 'rule'

export const AVAILABLE_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob',
  'Agent', 'WebFetch', 'WebSearch', 'NotebookEdit'
] as const

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateCommandTemplate(name: string): string {
  return `---
description: Describe what /${name} does
---

Instructions for Claude when /${name} is invoked.
`
}

export function generateAgentTemplate(
  name: string,
  description: string,
  model: string,
  tools: readonly string[]
): string {
  const toolsYaml = tools.map((t) => `  - ${t}`).join('\n')
  return `---
name: ${name}
description: ${description}
model: ${model}
tools:
${toolsYaml}
---

You are ${description ? description.toLowerCase() : `the ${name} agent`}.
`
}

export function generateSkillTemplate(name: string, description: string): string {
  const titleCase = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return `---
name: ${name}
description: ${description}
---

# ${titleCase}

Skill instructions go here.
`
}

export function generateMemoryTemplate(
  name: string,
  description: string,
  memoryType: string
): string {
  const guidance: Record<string, string> = {
    feedback: 'Lead with the rule itself, then a **Why:** line and **How to apply:** line.',
    project: 'Lead with the fact or decision, then **Why:** and **How to apply:** lines.',
    user: 'Information about the user\'s role, goals, or preferences.',
    reference: 'Pointer to where information can be found in external systems.'
  }

  return `---
name: ${name}
description: ${description}
type: ${memoryType}
---

${guidance[memoryType] ?? 'Memory content goes here.'}
`
}

export function generateRuleTemplate(name: string): string {
  const titleCase = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return `# ${titleCase}

Rule content goes here.
`
}

export function getTargetPath(
  configType: ConfigType,
  basePath: string,
  name: string,
  options?: { category?: string; memoryType?: string; projectPath?: string | null }
): string {
  const slug = slugify(name)
  switch (configType) {
    case 'command':
      return `${basePath}/commands/${slug}.md`
    case 'agent':
      return `${basePath}/agents/${slug}.md`
    case 'skill':
      return `${basePath}/skills/${slug}/SKILL.md`
    case 'memory': {
      const encoded = (options?.projectPath ?? '').replace(/\//g, '-')
      const prefix = options?.memoryType ?? 'user'
      return `${basePath}/projects/${encoded}/memory/${prefix}-${slug}.md`
    }
    case 'rule': {
      const cat = options?.category ? slugify(options.category) : 'common'
      return `${basePath}/rules/${cat}/${slug}.md`
    }
  }
}
```

- [ ] **Step 4: Add template tests**

Add to the same test file:

```typescript
import {
  slugify,
  generateCommandTemplate,
  generateAgentTemplate,
  generateSkillTemplate,
  generateMemoryTemplate,
  generateRuleTemplate,
  getTargetPath
} from '../../src/renderer/src/panels/claude-config/creation-templates'

describe('template generators', () => {
  it('generates command template with frontmatter', () => {
    const result = generateCommandTemplate('deploy')
    expect(result).toContain('---')
    expect(result).toContain('description:')
    expect(result).toContain('/deploy')
  })

  it('generates agent template with tools list', () => {
    const result = generateAgentTemplate('reviewer', 'Code review expert', 'sonnet', ['Read', 'Grep'])
    expect(result).toContain('name: reviewer')
    expect(result).toContain('model: sonnet')
    expect(result).toContain('  - Read')
    expect(result).toContain('  - Grep')
  })

  it('generates skill template with title case heading', () => {
    const result = generateSkillTemplate('deploy-check', 'Verify deployment')
    expect(result).toContain('# Deploy Check')
    expect(result).toContain('name: deploy-check')
  })

  it('generates memory template with type-specific guidance', () => {
    const result = generateMemoryTemplate('testing-rules', 'Rules for testing', 'feedback')
    expect(result).toContain('type: feedback')
    expect(result).toContain('Why:')
  })

  it('generates rule template with heading', () => {
    const result = generateRuleTemplate('no-console')
    expect(result).toContain('# No Console')
  })
})

describe('getTargetPath', () => {
  it('returns correct command path', () => {
    expect(getTargetPath('command', '/home/.claude', 'deploy')).toBe('/home/.claude/commands/deploy.md')
  })

  it('returns correct skill directory path', () => {
    expect(getTargetPath('skill', '/home/.claude', 'my-skill')).toBe('/home/.claude/skills/my-skill/SKILL.md')
  })

  it('returns correct memory path with type prefix', () => {
    const path = getTargetPath('memory', '/home/.claude', 'testing', {
      memoryType: 'feedback',
      projectPath: '/Users/casey/project'
    })
    expect(path).toContain('feedback-testing.md')
    expect(path).toContain('projects/')
  })

  it('returns correct rule path with category', () => {
    const path = getTargetPath('rule', '/home/.claude', 'no-console', { category: 'common' })
    expect(path).toBe('/home/.claude/rules/common/no-console.md')
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/engine/creation-templates.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/panels/claude-config/creation-templates.ts tests/engine/creation-templates.test.ts
git commit -m "feat: add creation template generators and slugify utility"
```

---

### Task 2: Inspector Store - Add Creation Mode

**Files:**
- Modify: `src/renderer/src/store/inspector-store.ts`

- [ ] **Step 1: Update inspector store with creation state**

Replace the entire `inspector-store.ts` with:

```typescript
import { create } from 'zustand'

interface InspectorStore {
  readonly inspectorFile: { path: string; title: string } | null
  readonly creationMode: { configType: string } | null
  openInspector: (path: string, title: string) => void
  closeInspector: () => void
  startCreation: (configType: string) => void
  cancelCreation: () => void
}

export const useInspectorStore = create<InspectorStore>((set) => ({
  inspectorFile: null,
  creationMode: null,

  openInspector: (path, title) =>
    set({ inspectorFile: { path, title }, creationMode: null }),

  closeInspector: () =>
    set({ inspectorFile: null, creationMode: null }),

  startCreation: (configType) =>
    set({ creationMode: { configType }, inspectorFile: null }),

  cancelCreation: () =>
    set({ creationMode: null })
}))
```

- [ ] **Step 2: Run typecheck to verify no regressions**

Run: `npm run typecheck 2>&1 | grep -v 'scope.*missing\|PdfCard\|getDefaultConfigPath'`
Expected: No new errors (existing pre-existing errors excluded)

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All 262+ tests pass

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/store/inspector-store.ts
git commit -m "feat: add creation mode state to inspector store"
```

---

### Task 3: Zone Label "+" Buttons

**Files:**
- Modify: `src/renderer/src/panels/canvas/claude/claude-canvas-layout.ts`
- Modify: `src/renderer/src/panels/claude-config/ClaudeConfigPanel.tsx`

- [ ] **Step 1: Add configType to ZoneLabel interface**

In `claude-canvas-layout.ts`, update the `ZoneLabel` interface (line 18-23):

```typescript
export interface ZoneLabel {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly color: string
  readonly configType?: string
}
```

- [ ] **Step 2: Populate configType on each zone label**

Update each `labels.push()` call in `layoutClaudeConfig`:

- Rules label (line 103-108): add `configType: 'rule'`
- Agents label: add to the agents zone (need to add a label for agents first - currently agents zone has no label). Add after line 131:
```typescript
if (agentItems.length > 0) {
  labels.push({
    text: `Agents (${agentItems.length})`,
    x: 0,
    y: row2Y + LABEL_OFFSET,
    color: '#a78bfa',
    configType: 'agent'
  })
}
```
- Settings label (line 143): no configType (not user-creatable)
- Skills label (line 177-182): add `configType: 'skill'`
- Commands label (line 208-213): add `configType: 'command'`
- Teams label (line 235-240): no configType (complex JSON)
- Memory label (line 263-268): add `configType: config.projectPath ? 'memory' : undefined`

- [ ] **Step 3: Update zone label rendering in ClaudeConfigPanel.tsx**

Replace the zone label rendering block (lines 302-321) with:

```tsx
{zoneLabels.map((label) => (
  <div
    key={label.text}
    className="absolute select-none"
    style={{
      left: label.x,
      top: label.y,
      pointerEvents: label.configType ? 'auto' : 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }}
  >
    <span
      style={{
        color: label.color,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: typography.fontFamily.display,
        letterSpacing: '0.03em',
        opacity: 0.8,
        whiteSpace: 'nowrap'
      }}
    >
      {label.text}
    </span>
    {label.configType && (
      <button
        onClick={(e) => {
          e.stopPropagation()
          useInspectorStore.getState().startCreation(label.configType!)
        }}
        className="opacity-0 hover:opacity-100 transition-opacity"
        style={{
          background: label.color + '22',
          color: label.color,
          border: 'none',
          borderRadius: 4,
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          lineHeight: 1
        }}
        title={`New ${label.configType}`}
      >
        +
      </button>
    )}
  </div>
))}
```

Add the import at the top of ClaudeConfigPanel.tsx:
```typescript
import { useInspectorStore } from '../../store/inspector-store'
```
(Already imported on line 6, so just verify it's there.)

- [ ] **Step 4: Make "+" visible on parent hover**

Add a CSS class. In the zone label container div, add `group` class and change the button to use `group-hover:opacity-100`:

Actually, since we're using inline styles on the canvas (not Tailwind classes on transformed elements), use a simpler approach: set the button opacity to 0.4 by default (subtle but visible), 1.0 on hover. Replace `className="opacity-0 hover:opacity-100 transition-opacity"` with:

```tsx
style={{
  ...existingStyles,
  opacity: 0.4,
  transition: 'opacity 150ms'
}}
onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1' }}
onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.4' }}
```

- [ ] **Step 5: Run typecheck and tests**

Run: `npm run typecheck 2>&1 | grep -v 'scope.*missing\|PdfCard\|getDefaultConfigPath'` and `npm test`
Expected: No new errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/panels/canvas/claude/claude-canvas-layout.ts src/renderer/src/panels/claude-config/ClaudeConfigPanel.tsx
git commit -m "feat: add zone label + buttons for config creation"
```

---

### Task 4: CreationInspector Component

**Files:**
- Create: `src/renderer/src/panels/claude-config/CreationInspector.tsx`

- [ ] **Step 1: Build the CreationInspector component**

This is the main creation UI. It renders form fields based on `configType` and a CodeMirror editor with the generated template.

```typescript
// src/renderer/src/panels/claude-config/CreationInspector.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { markdown } from '@codemirror/lang-markdown'
import { useCodeMirrorEditor } from '../canvas/shared/use-codemirror'
import { colors, typography } from '../../design/tokens'
import {
  slugify,
  generateCommandTemplate,
  generateAgentTemplate,
  generateSkillTemplate,
  generateMemoryTemplate,
  generateRuleTemplate,
  getTargetPath,
  AVAILABLE_TOOLS,
  type ConfigType
} from './creation-templates'

// Type-specific accent colors matching canvas card borders
const TYPE_COLORS: Record<string, string> = {
  command: '#34d399',
  agent: '#a78bfa',
  skill: '#22d3ee',
  memory: '#fb923c',
  rule: '#94a3b8'
}

const TYPE_LABELS: Record<string, string> = {
  command: 'Command',
  agent: 'Agent',
  skill: 'Skill',
  memory: 'Memory',
  rule: 'Rule'
}

interface CreationInspectorProps {
  readonly configType: string
  readonly configPath: string
  readonly projectPath: string | null
  readonly onCreated: (filePath: string, title: string) => void
  readonly onClose: () => void
}

export function CreationInspector({
  configType,
  configPath,
  projectPath,
  onCreated,
  onClose
}: CreationInspectorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('sonnet')
  const [tools, setTools] = useState<string[]>(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'])
  const [memoryType, setMemoryType] = useState('feedback')
  const [category, setCategory] = useState('common')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const slug = slugify(name)
  const accentColor = TYPE_COLORS[configType] ?? '#94a3b8'

  // Generate template content from form fields
  const templateContent = useMemo(() => {
    if (!slug) return ''
    switch (configType) {
      case 'command': return generateCommandTemplate(slug)
      case 'agent': return generateAgentTemplate(slug, description, model, tools)
      case 'skill': return generateSkillTemplate(slug, description)
      case 'memory': return generateMemoryTemplate(`${memoryType}-${slug}`, description, memoryType)
      case 'rule': return generateRuleTemplate(slug)
      default: return ''
    }
  }, [configType, slug, description, model, tools, memoryType])

  const targetPath = useMemo(() => {
    if (!slug) return ''
    return getTargetPath(configType as ConfigType, configPath, name, {
      category,
      memoryType,
      projectPath
    })
  }, [configType, configPath, name, category, memoryType, projectPath, slug])

  // Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const toggleTool = useCallback((tool: string) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    )
  }, [])

  const handleCreate = useCallback(async () => {
    if (!slug) {
      setError('Name is required')
      return
    }
    setError(null)
    setIsCreating(true)

    try {
      // Check for conflicts
      const exists = await window.api.fs.fileExists(targetPath)
      if (exists) {
        setError(`File already exists: ${targetPath.split('/').pop()}`)
        setIsCreating(false)
        return
      }

      // Create parent directory for skills and rules
      if (configType === 'skill') {
        const dirPath = targetPath.replace('/SKILL.md', '')
        await window.api.fs.mkdir(dirPath)
      } else if (configType === 'rule') {
        const dirPath = targetPath.split('/').slice(0, -1).join('/')
        await window.api.fs.mkdir(dirPath)
      }

      // Get editor content (may have been modified by user)
      const content = editorContentRef.current || templateContent
      await window.api.fs.writeFile(targetPath, content)
      onCreated(targetPath, slug)
    } catch (err) {
      setError(`Failed to create: ${String(err)}`)
    }
    setIsCreating(false)
  }, [slug, targetPath, configType, templateContent, onCreated])

  // Track editor content for user modifications
  const editorContentRef = { current: templateContent }
  const handleEditorChange = useCallback((content: string) => {
    editorContentRef.current = content
  }, [])

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: colors.bg.base }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{
          backgroundColor: colors.bg.elevated,
          borderBottom: `1px solid ${colors.border.default}`
        }}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
            New {TYPE_LABELS[configType] ?? configType}
          </span>
          {targetPath && (
            <span
              className="text-xs truncate"
              style={{ color: colors.text.muted, fontFamily: typography.fontFamily.mono }}
            >
              {targetPath.split('.claude/').pop()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1 rounded"
            style={{ color: colors.text.secondary, border: `1px solid ${colors.border.default}` }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!slug || isCreating}
            className="text-xs px-3 py-1 rounded font-medium"
            style={{
              backgroundColor: slug ? accentColor : colors.bg.elevated,
              color: slug ? '#0f172a' : colors.text.muted,
              opacity: isCreating ? 0.6 : 1
            }}
          >
            {isCreating ? 'Creating...' : `Create ${TYPE_LABELS[configType] ?? ''}`}
          </button>
        </div>
      </div>

      {/* Form fields */}
      <div
        className="px-3 py-3 space-y-3 shrink-0"
        style={{ borderBottom: `1px solid ${colors.border.default}` }}
      >
        {/* Name field (all types) */}
        <div>
          <label
            className="block mb-1"
            style={{ ...typography.metadata, color: colors.text.muted }}
          >
            NAME
          </label>
          <div className="flex items-center gap-1">
            {configType === 'command' && (
              <span style={{ color: accentColor, fontFamily: typography.fontFamily.mono, fontSize: 14 }}>/</span>
            )}
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              placeholder={configType === 'command' ? 'deploy-check' : `my-${configType}`}
              autoFocus
              className="flex-1 px-2 py-1.5 rounded text-sm"
              style={{
                backgroundColor: colors.bg.elevated,
                border: `1px solid ${colors.border.default}`,
                color: colors.text.primary,
                fontFamily: typography.fontFamily.mono,
                outline: 'none'
              }}
            />
          </div>
          {slug && slug !== name && (
            <span className="text-xs mt-0.5 block" style={{ color: colors.text.muted, fontFamily: typography.fontFamily.mono }}>
              {slug}.md
            </span>
          )}
        </div>

        {/* Description (agents, skills, memory) */}
        {(configType === 'agent' || configType === 'skill' || configType === 'memory') && (
          <div>
            <label className="block mb-1" style={{ ...typography.metadata, color: colors.text.muted }}>
              DESCRIPTION
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-line description"
              className="w-full px-2 py-1.5 rounded text-sm"
              style={{
                backgroundColor: colors.bg.elevated,
                border: `1px solid ${colors.border.default}`,
                color: colors.text.primary,
                outline: 'none'
              }}
            />
          </div>
        )}

        {/* Model toggle (agents only) */}
        {configType === 'agent' && (
          <div>
            <label className="block mb-1" style={{ ...typography.metadata, color: colors.text.muted }}>
              MODEL
            </label>
            <div className="flex gap-2">
              {['opus', 'sonnet', 'haiku'].map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className="px-3 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: model === m ? accentColor + '30' : colors.bg.elevated,
                    border: `1px solid ${model === m ? accentColor : colors.border.default}`,
                    color: model === m ? accentColor : colors.text.secondary
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tool chips (agents only) */}
        {configType === 'agent' && (
          <div>
            <label className="block mb-1" style={{ ...typography.metadata, color: colors.text.muted }}>
              TOOLS
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TOOLS.map((tool) => {
                const active = tools.includes(tool)
                return (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: active ? accentColor + '20' : colors.bg.elevated,
                      border: `1px solid ${active ? accentColor + '44' : colors.border.default}`,
                      color: active ? '#c4b5fd' : colors.text.muted,
                      fontFamily: typography.fontFamily.mono
                    }}
                  >
                    {tool}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Memory type (memory only) */}
        {configType === 'memory' && (
          <div>
            <label className="block mb-1" style={{ ...typography.metadata, color: colors.text.muted }}>
              TYPE
            </label>
            <div className="flex gap-2">
              {['feedback', 'project', 'user', 'reference'].map((t) => (
                <button
                  key={t}
                  onClick={() => setMemoryType(t)}
                  className="px-2.5 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: memoryType === t ? accentColor + '30' : colors.bg.elevated,
                    border: `1px solid ${memoryType === t ? accentColor : colors.border.default}`,
                    color: memoryType === t ? accentColor : colors.text.secondary
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category (rules only) */}
        {configType === 'rule' && (
          <div>
            <label className="block mb-1" style={{ ...typography.metadata, color: colors.text.muted }}>
              CATEGORY
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="common"
              className="w-full px-2 py-1.5 rounded text-sm"
              style={{
                backgroundColor: colors.bg.elevated,
                border: `1px solid ${colors.border.default}`,
                color: colors.text.primary,
                fontFamily: typography.fontFamily.mono,
                outline: 'none'
              }}
            />
          </div>
        )}

        {/* Error display */}
        {error && (
          <p className="text-xs" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {templateContent ? (
          <CreationEditor
            key={`${configType}-${slug}-${model}-${tools.join(',')}-${memoryType}`}
            content={templateContent}
            onChange={handleEditorChange}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs" style={{ color: colors.text.muted }}>
              Enter a name to see the template preview
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function CreationEditor({
  content,
  onChange
}: {
  readonly content: string
  readonly onChange: (content: string) => void
}) {
  const { containerRef } = useCodeMirrorEditor({
    initialContent: content,
    language: markdown(),
    onChange
  })

  return <div ref={containerRef} className="h-full" />
}
```

**Note**: The `editorContentRef` pattern is intentionally a plain object (not `useRef`) so it re-creates when form fields change and the editor re-mounts with the new template. The user's edits to the body are preserved within a single editor session, but changing form fields regenerates the template (form fields are primary, editor is secondary).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck 2>&1 | grep -v 'scope.*missing\|PdfCard\|getDefaultConfigPath'`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/panels/claude-config/CreationInspector.tsx
git commit -m "feat: add CreationInspector component with per-type forms"
```

---

### Task 5: Wire Up ClaudeConfigPanel

**Files:**
- Modify: `src/renderer/src/panels/claude-config/ClaudeConfigPanel.tsx`

- [ ] **Step 1: Import CreationInspector and add creation state reading**

Add import:
```typescript
import { CreationInspector } from './CreationInspector'
```

After the existing inspector state reading (line 211-212), add:
```typescript
const creationMode = useInspectorStore((s) => s.creationMode)
const cancelCreation = useInspectorStore((s) => s.cancelCreation)
```

- [ ] **Step 2: Add onCreated callback**

After `handleFitAll` (line 253-256), add:
```typescript
const handleCreated = useCallback(async (filePath: string, title: string) => {
  // Refresh canvas to show the new card
  await handleRefresh()
  // Open the new file in the inspector
  useInspectorStore.getState().openInspector(filePath, title)
}, [handleRefresh])
```

- [ ] **Step 3: Update inspector panel rendering**

Replace the inspector panel section (lines 343-356) with:

```tsx
{/* Inspector panel */}
{(inspectorFile || creationMode) && (
  <>
    <div className="panel-divider" />
    <div className="flex-1 overflow-hidden min-w-[350px]">
      {creationMode ? (
        <CreationInspector
          configType={creationMode.configType}
          configPath={configPath}
          projectPath={vaultPath ?? null}
          onCreated={handleCreated}
          onClose={cancelCreation}
        />
      ) : inspectorFile ? (
        <ConfigInspector
          key={inspectorFile.path}
          path={inspectorFile.path}
          title={inspectorFile.title}
          onClose={closeInspector}
        />
      ) : null}
    </div>
  </>
)}
```

- [ ] **Step 4: Update canvas width to account for creation mode**

Update the canvas panel width (line 262):
```tsx
style={{ width: (inspectorFile || creationMode) ? '55%' : '100%' }}
```

- [ ] **Step 5: Run typecheck and tests**

Run: `npm run typecheck 2>&1 | grep -v 'scope.*missing\|PdfCard\|getDefaultConfigPath'` and `npm test`
Expected: No new errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/panels/claude-config/ClaudeConfigPanel.tsx
git commit -m "feat: wire creation inspector into Claude Config panel"
```

---

### Task 6: Visual Verification

- [ ] **Step 1: Start the app**

Run: `npm run dev`

- [ ] **Step 2: Open Claude Config Canvas**

Press Cmd+Shift+C to open the canvas.

- [ ] **Step 3: Verify "+" buttons appear on zone labels**

Hover over zone labels (Rules, Agents, Skills, Commands, Memory). Each should show a "+" button. Settings and Teams should NOT have "+" buttons.

- [ ] **Step 4: Test command creation flow**

1. Click "+" on the Commands zone label
2. Inspector should open with "New Command" header
3. Type a name (e.g., "test-deploy")
4. Verify filename preview shows `test-deploy.md`
5. Verify editor shows frontmatter template
6. Click "Create"
7. Verify canvas refreshes and new command card appears
8. Verify inspector switches to read view of the new file

- [ ] **Step 5: Test agent creation flow**

1. Click "+" on Agents zone
2. Verify model toggle and tool chips render
3. Select different model, toggle some tools
4. Verify editor frontmatter updates
5. Create the agent and verify card appears

- [ ] **Step 6: Test edge cases**

1. Try creating with empty name (should show error)
2. Try creating duplicate name (should show "File already exists")
3. Press Escape during creation (should close without saving)
4. Click a card while creating (should switch to view mode)

- [ ] **Step 7: Take screenshots and share with user for visual verification**

Per project feedback: always verify UI work visually. Ask user to share screenshots.

- [ ] **Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: creation wizard visual polish and edge cases"
```

---

### Task 7: Final Verification and Push

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Only pre-existing errors

- [ ] **Step 3: Push to remote**

```bash
git push
```
