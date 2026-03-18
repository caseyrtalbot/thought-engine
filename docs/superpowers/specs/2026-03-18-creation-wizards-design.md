# Claude Config Canvas: Creation Wizards

**Date**: 2026-03-18
**Status**: Approved
**Scope**: Phase 3 of Claude Config Canvas

## Summary

Add the ability to create new Claude Code configuration files (commands, agents, skills, memory, rules) directly from the Claude Config Canvas. Creation happens in the inspector panel using a structured form header + pre-filled code editor template. The canvas stays read-only; new cards appear automatically after file creation.

## Problem

The canvas visualizes `~/.claude/` configuration but offers no way to create new config files. Users must manually create files with the correct structure, frontmatter, and placement. This is error-prone and doesn't leverage the visual context the canvas provides.

## Design

### Core Interaction

1. User clicks "+" button on a zone header label (e.g., "Commands (4) +")
2. Inspector panel opens in creation mode with:
   - Structured form fields at the top (type-specific: name, model, tools, etc.)
   - Code editor below pre-filled with best-practice template
   - "Create" button (type-colored) and "Cancel" button in header
3. User fills in fields and edits the template
4. On "Create": file is written to `~/.claude/`, canvas reloads, new card appears
5. Inspector transitions to normal read-view of the created file

### Entry Point

Zone labels in the canvas get a "+" button that appears on hover. Each zone already knows its type, so clicking "+" in the "Commands (4)" label starts a command creation flow.

**Implementation detail**: Zone label divs currently have `pointer-events-none` (line 306 of `ClaudeConfigPanel.tsx`). Change to `pointer-events-auto` so the "+" button is clickable. The label text itself stays non-interactive; only the "+" icon handles clicks.

The "+" button is rendered inline with the zone label text as a small `<button>` element that transitions from 0 to full opacity on hover over the label container.

### Inspector State Machine

The inspector has three mutually exclusive states:

```
State 1: CLOSED      inspectorFile = null, creationMode = null
State 2: VIEWING     inspectorFile = { path, title }, creationMode = null
State 3: CREATING    inspectorFile = null, creationMode = { configType }
```

Transitions:
- Click card -> VIEWING (existing behavior)
- Click zone "+" -> CREATING
- Click "Cancel" in creation form -> CLOSED
- Click "Create" (success) -> VIEWING (of newly created file)
- Click close (x) or Escape -> CLOSED
- Click different card while creating -> VIEWING (discards creation form)

The `ClaudeConfigPanel.tsx` panel routes rendering:
- `creationMode` is set -> render `CreationInspector`
- `inspectorFile` is set -> render `ConfigInspector` (existing)
- Neither -> inspector panel hidden

### Canvas Reload After Creation

The `ClaudeConfigPanel` already has a `handleRefresh` callback (line 236) that re-parses config and reloads the canvas. After successful file creation:

1. `CreationInspector` calls a `onCreated(filePath, title)` callback
2. `ClaudeConfigPanel` handles it: calls `handleRefresh()`, then opens the new file in `ConfigInspector` via `inspectorStore.openInspector(filePath, title)`

This reuses existing infrastructure. No new reload mechanism needed.

### Per-Type Creation Forms

#### 1. Commands (Priority 1)

**File path**: `~/.claude/commands/{name}.md`

**Form fields**:
- `name`: text input with `/` prefix visual (slugified for filename)
- Editor pre-filled with:

```markdown
---
description: {cursor here}
---

{instruction body}
```

**Best-practice guidance**: Commands should start with a clear action verb. The `description:` frontmatter field makes the command visible on canvas cards. Instructions should specify what Claude does when the command is invoked.

#### 2. Agents (Priority 2)

**File path**: `~/.claude/agents/{name}.md`

**Form fields**:
- `name`: text input (slugified for filename)
- `description`: one-line text input
- `model`: toggle group (opus | sonnet | haiku)
- `tools`: chip selector with toggleable pills for standard tools (Read, Write, Edit, Bash, Grep, Glob, Agent, WebFetch, WebSearch, NotebookEdit)

**Editor pre-filled with frontmatter generated from form fields + instruction body placeholder.**

**Form-to-editor sync**: One-way only. Form fields generate the frontmatter; the editor shows the full output. Changing form fields regenerates the editor content. The user can edit the instruction body freely in the editor, but frontmatter is controlled by the form fields. This avoids the complexity of bidirectional YAML parsing.

#### 3. Skills (Priority 3)

**File path**: `~/.claude/skills/{name}/SKILL.md`

**Form fields**:
- `name`: text input (becomes directory name, slugified)
- `description`: one-line text input
- Editor pre-filled with SKILL.md template:

```markdown
---
name: {name}
description: {description}
---

# {Name}

{skill instructions}
```

**On create**: creates the directory `~/.claude/skills/{name}/` via `mkdir`, then writes `SKILL.md` inside it. Does not create `prompts/` or `references/` subdirs (user can add these later).

#### 4. Memory (Priority 4)

**File path**: `~/.claude/projects/{encoded-project-path}/memory/{type}-{name}.md`

**Form fields**:
- `name`: text input (slugified)
- `description`: one-line text input
- `type`: select dropdown (user | feedback | project | reference)

The filename is auto-prefixed with the selected type (e.g., `feedback-testing.md`). This matches the `inferMemoryType` convention in the parser (lines 30-36 of `claude-config-parser.ts`) so the type badge renders correctly even without frontmatter.

**Editor pre-filled with type-specific template:**

```markdown
---
name: {type}-{name}
description: {description}
type: {selected-type}
---

{type-specific content guidance}
```

Type-specific content guidance:
- **feedback**: "Lead with the rule itself, then a **Why:** line and **How to apply:** line."
- **project**: "Lead with the fact or decision, then **Why:** and **How to apply:** lines."
- **user**: "Information about the user's role, goals, or preferences."
- **reference**: "Pointer to where information can be found in external systems."

**Project path access**: `CreationInspector` receives `projectPath` from `useClaudeConfigStore((s) => s.config?.projectPath)`. If null, the memory type option is disabled in the zone "+" button (the Memory zone label omits `configType`, so no "+" appears).

#### 5. Rules (Priority 5)

**File path**: `~/.claude/rules/{category}/{name}.md`

**Form fields**:
- `name`: text input (slugified)
- `category`: text input with autocomplete suggestions from existing rule categories found in the current config. New category names are allowed and the directory is created automatically.

**Editor pre-filled with**:

```markdown
# {Name}

{rule content}
```

Rules have no frontmatter. Just markdown content. On create, if the category directory doesn't exist, create it with `mkdir` before writing the file.

### File Structure

```
src/renderer/src/
  panels/claude-config/
    CreationInspector.tsx      NEW  - Main creation form + per-type rendering
    creation-templates.ts      NEW  - Template generators + slugify utility
  store/
    inspector-store.ts         EDIT - Add creationMode state + actions
  panels/claude-config/
    ClaudeConfigPanel.tsx      EDIT - Route inspector states, wire up onCreated
  panels/canvas/claude/
    claude-canvas-layout.ts    EDIT - ZoneLabel gets configType field
```

### CreationInspector Component

```
CreationInspector
  props: configType, configPath, projectPath, onCreated, onClose
  state: formFields (per-type), editorContent

  Layout:
    Header:
      Left: "New {Type}" title + target directory path
      Right: Cancel (ghost button) + Create (type-colored solid button)
    Form: Type-specific fields (name, model, tools, etc.)
      Below name field: filename preview in monospace (e.g., "deploy-check.md")
    Editor: CodeMirror instance with generated template (markdown language)

  On Create:
    1. Validate: name non-empty, no slashes, not just whitespace
    2. Check file exists via window.api.fs.fileExists(targetPath)
       - If exists: show red inline error below name field:
         "File already exists" + "Open existing" link button
    3. For skills/rules: await window.api.fs.mkdir(parentDir)
    4. await window.api.fs.writeFile(targetPath, editorContent)
    5. Call onCreated(targetPath, displayTitle)

  On Cancel / Escape:
    Discard form state, call onClose()

  Navigate away (click card):
    Form state is discarded (no confirmation dialog - creation is lightweight)
```

### Inspector Store Changes

```typescript
// inspector-store.ts
interface InspectorStore {
  readonly inspectorFile: { path: string; title: string } | null
  readonly creationMode: { configType: string } | null
  openInspector: (path: string, title: string) => void
  closeInspector: () => void
  startCreation: (configType: string) => void
  cancelCreation: () => void
}

// startCreation clears inspectorFile (mutually exclusive states)
startCreation: (configType) => set({ creationMode: { configType }, inspectorFile: null })

// openInspector clears creationMode
openInspector: (path, title) => set({ inspectorFile: { path, title }, creationMode: null })

// cancelCreation clears creationMode
cancelCreation: () => set({ creationMode: null })

// closeInspector clears both
closeInspector: () => set({ inspectorFile: null, creationMode: null })
```

### Zone Label "+" Button

The `ZoneLabel` interface gets a `configType` field:

```typescript
interface ZoneLabel {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly color: string
  readonly configType?: string  // 'command' | 'agent' | 'skill' | 'memory' | 'rule'
}
```

**Which zones get which types**:
- Rules -> `'rule'`
- Agents -> `'agent'`
- Skills -> `'skill'`
- Commands -> `'command'`
- Teams -> omitted (no creation wizard, JSON is complex)
- Memory -> `'memory'` (only if projectPath is set)
- Settings -> omitted (not user-creatable)

**Rendering**: The zone label `<div>` changes from `pointer-events-none` to `pointer-events-auto` when it has a `configType`. The "+" button is a `<button>` child that calls `inspectorStore.startCreation(configType)` on click.

### Validation and Edge Cases

**Name conflicts**: Before writing, check if the target file exists using `window.api.fs.fileExists()`. Show red inline error text below the name input: "A command named /deploy already exists". Render a small "Open existing" text button that calls `onCreated(existingPath, existingTitle)` to view it.

**Name sanitization**: `slugify(input)`: lowercase, trim, replace spaces/underscores with hyphens, strip non-alphanumeric (except hyphens), collapse consecutive hyphens. Show the actual filename preview below the input in monospace as the user types.

**Write failures**: If `writeFile` throws, show red error text below the Create button. Form state is preserved so the user can retry.

**Missing directories**: For skills (`skills/{name}/`) and rules (`rules/{category}/`), create the directory with `mkdir` before writing. `mkdir` is recursive-safe in the IPC layer.

**Memory without project**: If `projectPath` is null in the config, the Memory zone label omits `configType` so no "+" button appears. If somehow triggered, the form shows "Memory requires an active project" and disables Create.

**Escape key**: In `CreationInspector`, Escape calls `onClose()` which triggers `cancelCreation()`. Form state is discarded without confirmation.

### What's NOT in Scope

- Editing existing files from the canvas (current inspector code editor handles this)
- Deleting files from the canvas
- Drag-and-drop reordering
- Team creation (JSON config with member references is complex)
- Live preview of the card while editing
- Bidirectional form/editor sync (form -> editor only)

## Testing

- Unit tests for `creation-templates.ts`:
  - Each type generates valid markdown with correct frontmatter
  - `slugify()` handles spaces, special chars, consecutive hyphens
- Unit tests for name validation (empty, slashes, whitespace-only)
- Integration: creating each type writes correct file to correct path
- Edge case: duplicate name detection returns error
- Edge case: skill directory creation before file write

## Implementation Order

1. `creation-templates.ts` (pure functions, testable independently)
2. `inspector-store.ts` changes (add creation state + actions)
3. `CreationInspector.tsx` (command form first, then add other types incrementally)
4. `ClaudeConfigPanel.tsx` updates (route creation state, wire onCreated + handleRefresh)
5. `claude-canvas-layout.ts` (add configType to ZoneLabel, zone label pointer-events)
6. Wire up: "+" click -> inspector -> create -> reload -> view
