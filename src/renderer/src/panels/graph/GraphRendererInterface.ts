import type { SimNode, SimEdge, RenderOptions } from './GraphRenderer'
import { renderGraph, findNodeAt } from './GraphRenderer'

export interface RenderParams {
  ctx: CanvasRenderingContext2D
  nodes: readonly SimNode[]
  edges: readonly SimEdge[]
  width: number
  height: number
  selectedId: string | null
  hoveredId: string | null
  options: RenderOptions
}

export interface GraphRendererInterface {
  render(params: RenderParams): number
  hitTest(nodes: readonly SimNode[], x: number, y: number): SimNode | null
  resize(width: number, height: number, dpr: number): void
  dispose(): void
}

export class Canvas2DGraphRenderer implements GraphRendererInterface {
  render(params: RenderParams): number {
    return renderGraph(
      params.ctx,
      params.nodes,
      params.edges,
      params.width,
      params.height,
      params.selectedId,
      params.hoveredId,
      params.options
    )
  }

  hitTest(nodes: readonly SimNode[], x: number, y: number): SimNode | null {
    return findNodeAt(nodes as SimNode[], x, y)
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // Canvas2D doesn't need to track dimensions internally
  }

  dispose(): void {
    // Canvas2D has no GPU resources to release
  }
}
