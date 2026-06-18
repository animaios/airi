/**
 * Type definitions and data models for Hacking Mode integration.
 *
 * These interfaces define the core data structures used by HackingSessionService
 * and related components. They represent the canonical shape of the state machine,
 * activation parameters, and summary messages.
 *
 * Use when:
 * - Implementing HackingSessionService state management
 * - Defining internal service state and methods
 * - Working with summary messages from Code_Backend
 *
 * Expects:
 * - sessionId is ephemeral (UUID v4), never persisted to disk
 * - State transitions follow 4-state FSM: inactive → starting → active → failed
 * - All messages are tagged with sessionId for correlation and validation
 *
 * **Note:** For IPC payload types and Eventa contracts, see `shared/ipc/hackingSession.ts`
 */

/**
 * Canonical state object owned by HackingSessionService representing
 * the current integration state of the Code module within AIRI.
 *
 * Use when:
 * - Broadcasting state changes to renderer processes
 * - Making control decisions based on current mode
 * - Validating incoming messages against active session
 *
 * Expects:
 * - sessionId is null when state is "inactive" or "failed"
 * - processInfo is only present when Code_Process is running (starting/active states)
 * - lastError is only present when state is "failed"
 *
 * @example
 * ```typescript
 * const state: HackingSessionState = {
 *   sessionId: '550e8400-e29b-41d4-a716-446655440000',
 *   state: 'active',
 *   processInfo: { pid: 12345, port: 3210 }
 * }
 * ```
 */
export interface HackingSessionState {
  /**
   * Unique session identifier (UUID v4) correlating AIRI and Code_Module activity.
   * Null when inactive or after teardown.
   *
   * @default null
   */
  sessionId: string | null

  /**
   * Current state in the finite state machine.
   * - inactive: No Code_Process running
   * - starting: Process spawning, progressing through readiness tiers
   * - active: Fully operational, WebContentsView mounted, WebSocket connected
   * - failed: Error occurred, teardown completed, retry available
   */
  state: 'inactive' | 'starting' | 'active' | 'failed'

  /**
   * Code_Process runtime information. Only present in starting/active states.
   */
  processInfo?: {
    /** Process ID of the Code_Backend child process */
    pid: number
    /** Dynamically assigned port number for Code_Backend HTTP/WebSocket server */
    port: number
  }

  /**
   * Human-readable error message describing why activation failed.
   * Only present when state is "failed".
   */
  lastError?: string
}

/**
 * Configuration parameters for activating Hacking Mode.
 *
 * Use when:
 * - User activates Hacking Mode from Settings UI
 * - Keyboard shortcut triggers activation
 * - Retrying after failed activation
 *
 * Expects:
 * - providerConfig is mapped from AIRI's provider settings
 * - codeMode is one of the supported Code module modes
 *
 * @example
 * ```typescript
 * const config: ActivationConfig = {
 *   codeMode: 'vibe',
 *   providerConfig: {
 *     name: 'anthropic',
 *     apiKey: 'sk-ant-...',
 *     model: 'claude-3-5-sonnet-20241022',
 *     temperature: 0.7
 *   }
 * }
 * ```
 */
export interface ActivationConfig {
  /**
   * Code module operating mode.
   * - spec: Spec-driven development mode
   * - vibe: Conversational coding mode
   * - boss: High-level task delegation mode
   * - ask: Question-answering mode
   * - debug: Debugging assistance mode
   *
   * @default 'vibe'
   */
  codeMode?: 'spec' | 'vibe' | 'boss' | 'ask' | 'debug'

  /**
   * LLM provider configuration mapped from AIRI settings.
   * Contains provider-specific credentials and parameters.
   */
  providerConfig?: {
    /** Provider name (e.g., 'anthropic', 'openai', 'gemini') */
    name: string
    /** API key or authentication token */
    apiKey: string
    /** Optional custom API base URL */
    baseUrl?: string
    /** Model identifier (e.g., 'claude-3-5-sonnet-20241022') */
    model?: string
    /** Sampling temperature (0.0 - 1.0) */
    temperature?: number
    /** Maximum tokens to generate */
    maxTokens?: number
  }
}

/**
 * Summary message emitted by Code_Backend via WebSocket bridge.
 *
 * Use when:
 * - Code_Module completes a task and generates progress summary
 * - Validating incoming WebSocket messages before TTS narration
 * - Correlating summaries with active Hacking Session
 *
 * Expects:
 * - sessionId must match current HackingSessionState.sessionId
 * - text is human-readable summary suitable for TTS
 * - metadata contains execution context for logging and debugging
 *
 * @example
 * ```typescript
 * const summary: SummaryMessage = {
 *   type: 'summary',
 *   sessionId: '550e8400-e29b-41d4-a716-446655440000',
 *   text: 'Refactored authentication module and added tests.',
 *   metadata: {
 *     mode: 'vibe',
 *     model: 'claude-3-5-sonnet-20241022',
 *     tokens: 2847
 *   }
 * }
 * ```
 */
export interface SummaryMessage {
  /** Message type discriminator */
  type: 'summary'

  /**
   * Session identifier for correlation and validation.
   * Must match current HackingSessionState.sessionId or message is discarded.
   */
  sessionId: string

  /** Human-readable summary text for TTS narration */
  text: string

  /** Execution context metadata */
  metadata: {
    /** Code mode that generated this summary */
    mode: string
    /** LLM model identifier */
    model: string
    /** Total tokens consumed during execution */
    tokens: number
  }
}
