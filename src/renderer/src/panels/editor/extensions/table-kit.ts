/**
 * Table support for the Machina editor.
 *
 * Uses @tiptap/extension-table's built-in TableKit which bundles Table,
 * TableRow, TableCell, and TableHeader nodes. Markdown round-tripping is
 * handled by the extension's built-in parseMarkdown/renderMarkdown hooks
 * together with marked's native GFM table tokenizer.
 *
 * Phase 3D1: parse/render/round-trip only. Visual editing UX (3D2) is deferred.
 */
import { TableKit } from '@tiptap/extension-table'

export const MachinaTableKit = TableKit.configure({
  table: {
    resizable: false,
    HTMLAttributes: {
      class: 'te-table'
    }
  },
  tableHeader: {
    HTMLAttributes: {
      class: 'te-table-header'
    }
  },
  tableCell: {
    HTMLAttributes: {
      class: 'te-table-cell'
    }
  }
})
