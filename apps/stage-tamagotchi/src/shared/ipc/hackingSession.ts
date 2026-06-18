import type { InferOutput } from 'valibot'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'
import { literal, nullable, number, object, optional, picklist, string, union } from 'valibot'

/**
 * Hacking Session state machine FSM values.
 *
 * - `inactive` — No Code_Process running, sessionId null
 * - `starting` — Process spawning, progressing through readiness tiers
 * - `active` — Fully operational, WebContentsView mounted, WebSocket connected
 * - `failed` — Error occurred, teardown completed, retry available
 */
export type HackingSessionState = 'inactive' | 'starting' | 'active' | 'failed'

/**
 * Code mode selection for the Code module.
 */
export type CodeMode = 'spec' | 'vibe' | 'boss' | 'ask' | 'debug'

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Provider configuration schema for mapping AIRI providers to Code module.
 */
export const ProviderConfigSchema = object({
  name: string(),
  apiKey: string(),
  baseUrl: optional(string()),
  model: optional(string()),
  temperature: optional(number()),
  maxTokens: optional(number()),
})

/**
 * Activation configuration payload schema.
 */
export const ActivationConfigSchema = object({
  codeMode: optional(picklist(['spec', 'vibe', 'boss', 'ask', 'debug'])),
  providerConfig: optional(ProviderConfigSchema),
})

/**
 * Process information schema for runtime state.
 */
export const ProcessInfoSchema = object({
  pid: number(),
  port: number(),
})

/**
 * Hacking Session state payload schema.
 */
export const HackingSessionStatePayloadSchema = object({
  sessionId: nullable(string()),
  state: picklist(['inactive', 'starting', 'active', 'failed']),
  processInfo: optional(ProcessInfoSchema),
  lastError: optional(string()),
})

/**
 * Activation result schema.
 */
export const ActivationResultSchema = object({
  success: literal(true),
  sessionId: string(),
})

/**
 * Activation error schema.
 */
export const ActivationErrorSchema = object({
  success: literal(false),
  error: string(),
})

/**
 * Activation response union schema.
 */
export const ActivationResponseSchema = union([ActivationResultSchema, ActivationErrorSchema])

/**
 * Deactivation result schema.
 */
export const DeactivationResultSchema = object({
  success: literal(true),
})

/**
 * Deactivation error schema.
 */
export const DeactivationErrorSchema = object({
  success: literal(false),
  error: optional(string()),
})

/**
 * Deactivation response union schema.
 */
export const DeactivationResponseSchema = union([DeactivationResultSchema, DeactivationErrorSchema])

/**
 * Summary metadata schema.
 */
export const SummaryMetadataSchema = object({
  mode: string(),
  model: string(),
  tokens: number(),
})

/**
 * Code summary message payload schema.
 */
export const CodeSummaryPayloadSchema = object({
  sessionId: string(),
  text: string(),
  metadata: SummaryMetadataSchema,
})

// ============================================================================
// TypeScript Types
// ============================================================================

/**
 * Provider configuration for Code module.
 *
 * Use when:
 * - Mapping AIRI provider settings to Code module format
 * - Syncing configuration via POST /config endpoint
 *
 * Expects:
 * - `name` is the provider identifier (e.g., "anthropic", "openai")
 * - `apiKey` is the provider API key
 * - Optional fields for customization (baseUrl, model, temperature, maxTokens)
 */
export type ProviderConfig = InferOutput<typeof ProviderConfigSchema>

/**
 * Activation configuration payload.
 *
 * Use when:
 * - Invoking `electronHackingSessionActivate` from renderer
 * - Requesting to start Hacking Session with specific mode and provider
 *
 * Expects:
 * - `codeMode` defaults to "vibe" if omitted
 * - `providerConfig` is read from AIRI settings if omitted
 */
export type ActivationConfig = InferOutput<typeof ActivationConfigSchema>

/**
 * Process runtime information.
 *
 * Use when:
 * - Displaying process PID and port in settings UI for debugging
 * - Logging process lifecycle events
 */
export type ProcessInfo = InferOutput<typeof ProcessInfoSchema>

/**
 * Hacking Session state payload.
 *
 * Use when:
 * - Broadcasting state changes via `electronHackingSessionStateChanged`
 * - Subscribing to state updates in renderer components
 *
 * Expects:
 * - `sessionId` is UUID v4 when active/starting, null when inactive/failed
 * - `state` follows 4-value FSM: inactive → starting → active/failed
 * - `processInfo` present when state is starting/active
 * - `lastError` present when state is failed
 */
export type HackingSessionStatePayload = InferOutput<typeof HackingSessionStatePayloadSchema>

/**
 * Activation response from HackingSessionService.
 *
 * Returns:
 * - `{ success: true, sessionId }` on successful activation
 * - `{ success: false, error }` on activation failure
 */
export type ActivationResponse = InferOutput<typeof ActivationResponseSchema>

/**
 * Deactivation response from HackingSessionService.
 *
 * Returns:
 * - `{ success: true }` on successful deactivation
 * - `{ success: false, error? }` on deactivation failure (rare)
 */
export type DeactivationResponse = InferOutput<typeof DeactivationResponseSchema>

/**
 * Summary metadata from Code execution.
 */
export type SummaryMetadata = InferOutput<typeof SummaryMetadataSchema>

/**
 * Code summary message payload.
 *
 * Use when:
 * - Broadcasting code summaries via `electronCodeSummaryReceived`
 * - TTS_Narrator subscribing to summary events for narration
 *
 * Expects:
 * - `sessionId` matches current active session (validation required)
 * - `text` is human-readable summary content
 * - `metadata` contains execution context (mode, model, tokens)
 */
export type CodeSummaryPayload = InferOutput<typeof CodeSummaryPayloadSchema>

// ============================================================================
// Eventa IPC Contracts
// ============================================================================

/**
 * Invoke event to activate Hacking Session.
 *
 * Use when:
 * - User clicks "Activate Hacking Mode" toggle in settings
 * - Keyboard shortcut (Ctrl+Shift+H) pressed while inactive/failed
 * - Retry button clicked after failure
 *
 * Expects:
 * - Optional `codeMode` to select Code operating mode (default: "vibe")
 * - Optional `providerConfig` to override AIRI provider settings
 *
 * Returns:
 * - `{ success: true, sessionId }` on successful activation
 * - `{ success: false, error }` on activation failure (port conflict, timeout, etc.)
 *
 * **Validates: Requirements 7.1**
 */
export const electronHackingSessionActivate = defineInvokeEventa<ActivationResponse, ActivationConfig>(
  'eventa:invoke:electron:hacking-session:activate',
)

/**
 * Invoke event to deactivate Hacking Session.
 *
 * Use when:
 * - User clicks "Deactivate Hacking Mode" toggle in settings
 * - Keyboard shortcut (Ctrl+Shift+H) pressed while active
 * - Process crash or fatal error triggers automatic deactivation
 *
 * Expects:
 * - No parameters (deactivates current session)
 *
 * Returns:
 * - `{ success: true }` on successful deactivation
 * - `{ success: false, error? }` on deactivation failure (should be rare)
 *
 * **Validates: Requirements 7.1**
 */
export const electronHackingSessionDeactivate = defineInvokeEventa<DeactivationResponse>(
  'eventa:invoke:electron:hacking-session:deactivate',
)

/**
 * Broadcast event when Hacking Session state changes.
 *
 * Use when:
 * - HackingSessionService transitions between states (inactive, starting, active, failed)
 * - Renderer components need to react to state changes (UI updates, input routing)
 *
 * Expects:
 * - `sessionId` is UUID v4 when starting/active, null when inactive/failed
 * - `state` follows FSM transitions
 * - `processInfo` present for starting/active states
 * - `lastError` present for failed state
 *
 * **Validates: Requirements 7.2, 1.9, 1.10**
 */
export const electronHackingSessionStateChanged = defineEventa<HackingSessionStatePayload>(
  'eventa:event:electron:hacking-session:state-changed',
)

/**
 * Broadcast event when Code module emits a summary.
 *
 * Use when:
 * - Code_Backend sends summary message via WebSocket /bridge
 * - CodeBridgeService validates sessionId and forwards to Eventa
 * - TTS_Narrator subscribes to narrate summaries in AIRI voice
 *
 * Expects:
 * - `sessionId` must match current active session (consumers must validate)
 * - `text` contains human-readable summary content
 * - `metadata` contains execution context (mode, model, tokens consumed)
 *
 * **Validates: Requirements 7.2, 3.7, 6.1**
 */
export const electronCodeSummaryReceived = defineEventa<CodeSummaryPayload>(
  'eventa:event:electron:hacking-session:code-summary-received',
)
