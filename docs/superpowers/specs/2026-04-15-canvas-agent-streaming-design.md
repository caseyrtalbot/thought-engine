# Canvas Agent Streaming — Design

**Date:** 2026-04-15
**Status:** Approved, pending implementation plan
**Related:** `src/main/services/agent-action-runner.ts`, `src/renderer/src/hooks/use-agent-orchestrator.ts`, `src/renderer/src/panels/canvas/AgentPreview.tsx`

## Problem

Canvas agent commands (`challenge`, `emerge`, `organize`, `tidy`, `compile`, `ask`) fail every time in both dev and production with the error `claude timed out after 60000ms`. Root cause: `CLI_TIMEOUT_MS = 60_000` is too short for realistic workloads.

### Evidence

Direct `spawn('claude', ['--print'])` reproduction outside Electron, same env, same invocation as `agent-action-runner.ts:419`:

| Prompt | First byte | Total |
|---|---|---|
| Trivial (`{"ops":[]}` response) | 6.3s | 6.9s |
| Small `challenge` on 2 synthetic cards | 42.4s | 42.7s |

A minimal realistic action already lands at 43s — 70% of the budget. `compile` or `organize` on real vault data reliably exceeds 60s. The hardcoded cap is the sole failure mode.

Additionally, the current UX shows a single `computing` spinner with no feedback for the 60+s wait. Users cannot distinguish a working agent from a stalled one.

## Goals

1. Remove the root-cause timeout failure.
2. Replace opaque wait with a polished streaming UI showing agent progress in real time.
3. Improve error copy so users understand what went wrong and what to try next.
4. Keep the existing op-validation and canvas-apply flow unchanged (streaming is additive, not a rewrite of the apply pipeline).

## Non-goals

- Op-by-op canvas materialization (deferred; option B from brainstorming).
- Streaming input (multi-turn conversations with the agent).
- Persistence of agent history across sessions.
- Changing the set of agent actions or their prompts.

## Transport (main process)

Replace the current `callClaude` in `src/main/services/agent-action-runner.ts:419` with a streaming variant. Spawn flags change from `['--print']` to:

```
claude --print --output-format stream-json --verbose --include-partial-messages
```

Confirmed via direct test: `--include-partial-messages` emits `stream_event.content_block_delta` events at ~100–300ms cadence for both `thinking_delta` and `text_delta` content blocks.

Parse stdout as JSONL (split on `\n`, one JSON object per non-empty line). Route events:

| Event path | Action |
|---|---|
| `type: 'stream_event', event.type: 'message_start'` | transition phase → `thinking` (emit IPC) |
| `event.delta.type: 'thinking_delta'` | append `event.delta.thinking` to `thinkingBuf`, emit IPC delta |
| `event.delta.type: 'text_delta'` | append `event.delta.text` to `textBuf`; on first text delta emit phase → `drafting`; emit IPC delta |
| `event.delta.type: 'signature_delta'` | ignore |
| `type: 'result'` | use `result.result` string as source for JSON extraction |
| `type: 'assistant'` | ignore (complete message; already handled by deltas) |
| `type: 'system'` | ignore (session hooks, init) |

After `close` event: run existing `extractJsonFromResponse(textBuf)` → `validateAgentOps` → `buildPlanFromOps`. Emit phase → `materializing` with op count, then return plan via existing `AgentActionResponse` shape.

### Throttling

Deltas arrive every 100–300ms. Forward each IPC event as it arrives; renderer handles visual batching. No main-process coalescing needed at observed cadence.

### Cancellation

Keep the existing `_activeProc` + `cancelAgentAction()` mechanism. SIGTERM on cancel. Renderer cancel button and Esc key both route through `window.api.agentAction.cancel()`.

## IPC surface

New one-way event channel: `agent-action:stream` (main → renderer).

```ts
// src/shared/agent-action-types.ts (add)
export type AgentStreamEvent =
  | { kind: 'phase'; phase: 'starting' | 'thinking' | 'drafting' | 'materializing'; count?: number }
  | { kind: 'thinking-delta'; text: string }
  | { kind: 'text-delta'; text: string }
```

Register in `src/main/ipc/agent-actions.ts` via a small `BrowserWindow.webContents.send` helper or an injected emitter. Expose to the renderer under the existing event namespace (all event subscribers live under `api.on.*` per the preload convention at `src/preload/index.ts:156-186`):

```ts
// src/preload/index.ts (add inside the `on:` object)
agentActionStream: (cb: (ev: AgentStreamEvent) => void) => typedOn('agent-action:stream', cb)
```

Renderer subscribes once at orchestrator mount: `window.api.on.agentActionStream(handler)`.

Existing `agent-action:compute` invoke remains unchanged — still returns the final `AgentActionResponse`. Streaming is strictly additive.

## Timeouts

Drop `CLI_TIMEOUT_MS = 60_000`. Replace with:

- **Silence watchdog**: reset on every stream event (including `system` events during startup). Fires after 30s with no activity. Error: `Agent stalled. Try a smaller selection.`
- **Total cap**: 180s safety net. Error: `Agent exceeded 3-minute limit. Try fewer cards.`
- Both cleared on `close`.

Silence is the real signal. The hard cap exists only to prevent indefinite hangs from pathological network states.

## Thought card (renderer)

New component `src/renderer/src/panels/canvas/AgentThoughtCard.tsx`. Glass overlay layer, floats above the canvas.

### Anchor

Position anchored to the interaction origin:

| Trigger | Anchor |
|---|---|
| Toolbar button (most actions) | button's screen rect, offset below by 12px |
| `challenge` / `emerge` with selection | bounding-box centroid of selected nodes, in screen coords |
| Vault-scope (no selection) | viewport center |

Position computed once at `phase=computing` transition; does not follow viewport pan/zoom (card stays fixed to screen).

### Dimensions

- Width: 440px (clamped to `min(440, viewportWidth - 48)`)
- Min height: 120px
- Max height: `min(400px, 50vh)`
- Body scrolls internally when content exceeds max height; auto-scroll to bottom during streaming

### Phase choreography

| Phase | Trigger | Body | Header |
|---|---|---|---|
| Starting | `phase=computing` set | animated three-dot pulse, no text | `Starting agent · 0:03` |
| Thinking | first `thinking-delta` | streamed thinking prose, italic, `color-text-secondary` | `Thinking · 0:08` |
| Drafting | first `text-delta` | thinking block fades to 40% opacity and sticks to top; new text streams below in default text color | `Drafting ops · 0:14` |
| Materializing | plan validated (from IPC response) | body replaced with op-count summary ("6 new cards, 2 new edges") | `Materializing…` |
| Dissolve | 300ms after materializing | card fades + scales to 0.96, translates toward anchor | — |
| Error | any error path | body becomes error copy with Retry and Dismiss buttons | `Agent failed` |

### Elapsed timer

Updates every 500ms. Format: `M:SS`. Visible in header from Starting through Drafting. Hidden in Materializing / Dissolve.

### Streaming animation

Token deltas arrive every 100–300ms. Each delta appends to the visible body immediately — no artificial typewriter delay (the cadence is already human-readable). Auto-scroll pins to bottom during streaming; user scroll-up pauses auto-scroll until they scroll back to bottom.

The `drafting` phase must hide the JSON code fence from the user. Implementation: when `text_delta` content starts matching ```` ```json ```` (or just ```` ``` ````) followed by `{`, stop appending to the visible text buffer. The full raw buffer still accumulates for JSON extraction. This keeps the narrative clean while JSON parses silently.

### Cancel affordance

Subtle `×` icon top-right of the card, `color-text-tertiary` default, `color-text-primary` on hover. Keybind: Esc while card is visible cancels. Both route to `window.api.agentAction.cancel()`.

### Accessibility

- Streaming body wrapped in `<div role="log" aria-live="polite" aria-atomic="false">`.
- Phase header in a separate `<div aria-live="polite">`.
- Respects `prefers-reduced-motion`: cross-fades only (150ms), no scale/translate on dissolve, no auto-scroll animation (jump instead).
- Cancel `×` has `aria-label="Cancel agent action"`.

## Error copy

Surface via the existing `AgentPreview.tsx` error bar (kept for Dismiss + Retry UX). Map `runAgentAction` error paths to specific copy:

| Condition | Copy |
|---|---|
| Silence watchdog fires | `Agent stalled. Try a smaller selection.` |
| Total cap fires | `Agent exceeded 3-minute limit. Try fewer cards.` |
| Non-zero CLI exit | `Agent error: ${stderr.trim().split('\n').pop()?.slice(0, 140) ?? 'unknown'}` |
| Spawn ENOENT | `Couldn't find Claude CLI. Run \`which claude\` in terminal.` |
| JSON parse or op validation | `Agent returned invalid output. Try again.` |

Each error maps via a tagged error type from `agent-action-runner.ts`, not by string-matching the message. Proposed tags: `'stalled' | 'cap' | 'cli-error' | 'not-found' | 'invalid-output'`.

## File-level change summary

| File | Change |
|---|---|
| `src/main/services/agent-action-runner.ts` | Rewrite `callClaude` for stream-json; add silence watchdog + total cap; emit IPC stream events; tag errors |
| `src/main/ipc/agent-actions.ts` | Wire stream-event emitter into `runAgentAction` call |
| `src/shared/agent-action-types.ts` | Add `AgentStreamEvent` union and error tag types |
| `src/shared/ipc-channels.ts` | Declare `agent-action:stream` event channel |
| `src/preload/index.ts` | Expose `agentAction.onStream` |
| `src/renderer/src/hooks/use-agent-orchestrator.ts` | Subscribe to stream events; maintain per-action stream state for thought card |
| `src/renderer/src/panels/canvas/AgentThoughtCard.tsx` | New component |
| `src/renderer/src/panels/canvas/AgentPreview.tsx` | Replace plain `errorMessage` render with tagged error copy lookup |
| `src/renderer/src/panels/canvas/CanvasView.tsx` | Render `<AgentThoughtCard>` when orchestrator phase is `computing` or `materializing` |

## Testing

- **Unit**: `agent-action-runner.test.ts` — stream parsing (mock stdout JSONL), silence watchdog, total cap, error tag mapping, cancellation mid-stream.
- **Unit**: `AgentThoughtCard.test.tsx` — phase transitions, elapsed timer, cancel affordance, reduced-motion branch, JSON-fence hiding in drafting phase.
- **Manual**: trigger each of the six actions against real vault content; verify streaming visibly progresses; verify error copy on forced kill (`pkill -f 'claude --print'`); verify cancel via × and Esc.

## Rollout

Single PR. The streaming refactor replaces `callClaude` entirely; there is no interim stopgap worth shipping.

## Open questions

None — all decisions from brainstorming are captured above.
