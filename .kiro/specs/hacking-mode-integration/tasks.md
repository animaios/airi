# Implementation Plan: Hacking Mode Integration

## Overview

This plan implements a distributed runtime orchestration layer that embeds the AnimAIOS Code module (standalone browser-based AI coding assistant) into the stage-tamagotchi Electron application as "Hacking Mode". The implementation follows a 3-service architecture with a 4-state FSM, 3-tier readiness progression, 8-step ordered teardown, and ephemeral session correlation using UUID v4 sessionIds.

Key architectural principles:
- Single source of truth (HackingSessionService owns all state)
- Deterministic failure handling (any failure triggers full teardown)
- No dual control planes (only HackingSessionService controls transitions)
- Single event path for summaries (WebSocket → Eventa → TTS)

## Tasks

- [ ] 1. Define core data models and Eventa IPC contracts
  - [ ] 1.1 Create TypeScript interfaces for HackingSessionState, ActivationConfig, SummaryMessage
    - Define `HackingSessionState` with fields: sessionId (string | null), state (4-value FSM), processInfo, lastError
    - Define `ActivationConfig` with codeMode and providerConfig fields
    - Define `SummaryMessage` with type, sessionId, text, metadata structure
    - _Requirements: 1.2, 1.3, 1.10, 13.1, 13.2_
  
  - [ ] 1.2 Define Eventa IPC contracts using @moeru/eventa
    - Create `apps/stage-tamagotchi/src/shared/ipc/hackingSession.ts`
    - Define invoke events: `electronHackingSessionActivate`, `electronHackingSessionDeactivate`
    - Define broadcast events: `electronHackingSessionStateChanged`, `electronCodeSummaryReceived`
    - Use Valibot or Zod for payload validation schemas
    - Follow existing Eventa naming convention (eventa:invoke:electron:*, eventa:broadcast:electron:*)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 2. Implement HackingSessionService (orchestrator)
  - [ ] 2.1 Create HackingSessionService class with state machine
    - Create `apps/stage-tamagotchi/src/main/services/hackingSession/HackingSessionService.ts`
    - Implement 4-state FSM: inactive, starting, active, failed
    - Add sessionId generation using `randomUUID()` from `node:crypto`
    - Implement state transition method with Eventa broadcast emission
    - Initialize state to "inactive" on construction
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 1.10, 13.1_
  
  - [ ]* 2.2 Write property test for state machine transitions
    - **Property 1: Single Authority** - verify only HackingSessionService can control transitions
    - **Property 14: No State Skipping** - verify transitions must go through starting state
    - **Validates: Requirements 1.7, 1.8, 1.5, 2.7**
  
  - [ ] 2.3 Implement activate() method with 3-tier readiness progression
    - Spawn Code_Process using `child_process.spawn()` with executable path `modules/code/apps/roo-code-standalone/dist/server.js`
    - Handle EADDRINUSE error (port 3210 conflict) with transition to failed state
    - Implement 3-tier readiness: process_started (PID available) → http_ready (GET /health returns 200 within 10s) → bridge_ready (WebSocket handshake completes within total 15s)
    - Transition to active state after bridge_ready, or failed state on timeout
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [ ]* 2.4 Write property test for readiness progression
    - **Property 8: Readiness Progression** - verify exactly 3 tiers in order
    - **Property 17: Activation Timeout** - verify 15s timeout enforced
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7**
  
  - [ ] 2.5 Implement deactivate() method with 8-step ordered teardown
    - Create private `executeOrderedTeardown()` method
    - Step 1: Stop Input_Gateway routing (immediate, synchronous flag)
    - Step 2: Blank BrowserView with about:blank (500ms timeout)
    - Step 3: Close WebSocket connection (1000ms timeout)
    - Step 4: Send SIGTERM to Code_Process (3000ms timeout)
    - Step 5: Send SIGKILL if process still alive (immediate)
    - Step 6: Detach and destroy BrowserView (500ms timeout)
    - Step 7: Set sessionId to null (immediate, synchronous)
    - Step 8: Emit state change event (immediate, synchronous)
    - Make teardown idempotent (safe to call multiple times)
    - _Requirements: 2.8, 2.9, 2.11, 19.1, 19.2, 19.3, 19.4, 19.5_
  
  - [ ]* 2.6 Write property test for ordered teardown
    - **Property 7: Ordered Teardown** - verify all 8 steps execute sequentially
    - **Property 15: Eventual Teardown** - verify bounded time completion
    - **Property 11: No Ghost States** - verify BrowserView blanked before destroy
    - **Validates: Requirements 2.11, 19.1, 19.2, 19.3, 19.5**
  
  - [ ] 2.7 Implement process crash detection and recovery
    - Listen for SIGCHLD signal and PID change detection
    - On crash/exit while state is "active", invalidate sessionId and execute teardown
    - Transition to failed state with lastError message
    - _Requirements: 2.10, 2.12_
  
  - [ ]* 2.8 Write property test for failure collapse
    - **Property 5: Failure Collapse** - verify any failure triggers full teardown
    - **Property 12: No Split Brain** - verify PID change invalidates sessionId
    - **Validates: Requirements 2.10, 2.11, 2.12, 19.1**
  
  - [ ] 2.9 Add structured logging with @guiiai/logg
    - Use namespace "hacking-session"
    - Log state transitions with from/to/reason fields
    - Log process lifecycle events (PID, port, startup duration)
    - Log errors with stack traces and context (sessionId, state, processInfo)
    - Write logs to ~/.kiro/logs/hacking-session.log with daily rotation
    - _Requirements: 2.13, 18.1, 18.2, 18.3, 18.4, 18.5, 18.9, 18.10_
  
  - [ ] 2.10 Register service in injeca container
    - Update `apps/stage-tamagotchi/src/main/index.ts`
    - Register HackingSessionService with dependencies: lifecycle, mainWindow, serverChannel
    - Export service for use by other components
    - _Requirements: 1.1_

- [ ] 3. Checkpoint - Ensure orchestrator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement CodeBridgeService (WebSocket + config management)
  - [ ] 4.1 Create CodeBridgeService class for WebSocket connection management
    - Create `apps/stage-tamagotchi/src/main/services/hackingSession/CodeBridgeService.ts`
    - Implement WebSocket connection to ws://localhost:3210/bridge
    - Send authentication handshake: `{ type: "auth", sessionId, token }`
    - Handle authentication failure (close code 4001) without retry
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 14.1, 14.3, 14.8_
  
  - [ ] 4.2 Implement summary message validation and routing
    - Validate incoming messages have structure: `{ type: "summary", sessionId, text, metadata }`
    - Check sessionId matches current HackingSessionState.sessionId
    - If mismatch, log warning "Received summary from stale session" and discard message
    - If valid, emit Eventa broadcast `electronCodeSummaryReceived`
    - Ignore all other summary sources (prevent duplication)
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 13.7_
  
  - [ ]* 4.3 Write property test for summary routing
    - **Property 3: One Event Path** - verify only WebSocket → CodeBridge → Eventa path exists
    - **Property 10: Mismatch Discard** - verify mismatched sessionIds are discarded
    - **Property 13: No Message Duplication** - verify exactly one path
    - **Validates: Requirements 3.6, 3.8, 6.1, 6.3, 13.7**
  
  - [ ] 4.4 Implement WebSocket reconnection with exponential backoff
    - Trigger reconnection on unexpected close while state is "active"
    - Use exponential backoff: base 1000ms, max 30000ms, max 5 attempts
    - On reconnect, send handshake with CURRENT sessionId (must match)
    - After 5 failed attempts, notify HackingSessionService to transition to failed
    - _Requirements: 3.11, 3.12, 3.13_
  
  - [ ]* 4.5 Write property test for reconnection
    - **Property 16: Reconnection Bounded** - verify max 5 attempts before failed transition
    - **Validates: Requirements 3.11, 3.13**
  
  - [ ] 4.6 Implement config sync via POST /config
    - Send config to http://localhost:3210/config with X-Session-ID header after bridge_ready
    - Include payload: `{ provider, mode, sessionId }`
    - If POST fails (500 response), log error but continue activation (Code uses stored settings)
    - _Requirements: 3.9, 3.10, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_
  
  - [ ] 4.7 Implement keepalive pings
    - Send ping messages every 30000ms to detect stale connections
    - _Requirements: 3.15_
  
  - [ ] 4.8 Implement graceful teardown
    - On deactivate() or failed transition, close WebSocket connection cleanly
    - Stop all reconnection attempts
    - _Requirements: 3.14_
  
  - [ ] 4.9 Add structured logging with namespace "hacking-session:bridge"
    - Log WebSocket state changes (connected, disconnected, error)
    - Log reconnection attempts with backoff delays
    - _Requirements: 18.6_

- [ ] 5. Implement UIAdapterLayer (BrowserView rendering)
  - [ ] 5.1 Create UIAdapterLayer class for BrowserView management
    - Create `apps/stage-tamagotchi/src/main/services/hackingSession/UIAdapterLayer.ts`
    - Implement createBrowserView() method triggered when state transitions to "active"
    - Load http://localhost:3210 with security settings: nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true
    - Use session partition "persist:hacking-mode" for isolation
    - Reject all origins except http://localhost:3210
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 5.2 Write property test for UI statelessness
    - **Property 4: UI Stateless** - verify BrowserView stores no state, triggers no transitions
    - **Validates: Requirements 4.1, 4.13**
  
  - [ ] 5.3 Implement BrowserView attachment and bounds management
    - Attach BrowserView to Main_Window with bounds matching chat content area (min 320x240px)
    - Update bounds on window resize within 16ms (60fps frame budget)
    - _Requirements: 4.6, 4.7_
  
  - [ ] 5.4 Implement load retry logic
    - If BrowserView load fails within 10000ms, retry once after 2000ms
    - If retry fails, notify HackingSessionService to transition to failed
    - _Requirements: 4.8, 4.9_
  
  - [ ] 5.5 Implement ordered destruction sequence
    - On state transition from "active", first blank BrowserView (load about:blank)
    - Wait for blanking to complete before detaching from Main_Window
    - Destroy BrowserView instance last
    - Ensure blanking happens BEFORE WebSocket close (prevent ghost UI)
    - _Requirements: 4.10, 4.11, 4.12, 19.3_
  
  - [ ] 5.6 Enforce no Electron API exposure
    - Do not create preload scripts exposing Electron APIs
    - _Requirements: 4.13_
  
  - [ ] 5.7 Add structured logging with namespace "hacking-session:ui"
    - Log BrowserView lifecycle events (create, destroy, blank)
    - Log BrowserView ID and bounds
    - _Requirements: 4.14, 18.7_

- [ ] 6. Checkpoint - Ensure core services tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement renderer integration (Input_Gateway, TTS_Narrator, state subscription)
  - [ ] 7.1 Create useHackingSession composable for state subscription
    - Create `apps/stage-tamagotchi/src/renderer/composables/useHackingSession.ts`
    - Subscribe to `electronHackingSessionStateChanged` broadcast event
    - Provide reactive state object with sessionId, state, processInfo, lastError
    - _Requirements: 12.1, 12.7_
  
  - [ ] 7.2 Implement Input_Gateway message routing
    - Create `apps/stage-tamagotchi/src/renderer/composables/useInputGateway.ts`
    - Accept normalized messages: `{ text: string, timestamp: number, sessionContext: string }`
    - When state is "inactive" or "failed", route to AIRI_Consumer
    - When state is "active", route to Code_Consumer (via WebSocket, NOT DOM injection)
    - Enforce max message size 10000 characters (truncate with warning)
    - Maintain separate in-memory histories (max 1000 messages each) for AIRI and Code
    - Preserve pending input in buffer during state transitions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12_
  
  - [ ]* 7.3 Write property test for session correlation
    - **Property 9: SessionId Correlation** - verify all messages tagged with sessionId
    - **Validates: Requirements 1.10, 3.5, 13.1, 13.2, 13.3, 13.4, 13.5**
  
  - [ ] 7.4 Implement TTS_Narrator for summary narration
    - Create `apps/stage-tamagotchi/src/renderer/composables/useTTSNarrator.ts` (or appropriate component)
    - Subscribe to `electronCodeSummaryReceived` broadcast event ONLY
    - Validate sessionId matches current HackingSession sessionId
    - If mismatch, log warning "Summary from stale session" and ignore
    - Send summary text to AIRI TTS pipeline using configured voice settings
    - Implement throttling: max 1 narration per 2000ms, queue excess
    - On TTS failure, log error with namespace "hacking-session:tts" but continue
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [ ] 7.5 Update Chat_Component for UI transitions
    - Update existing chat component (location TBD based on codebase structure)
    - Subscribe to `electronHackingSessionStateChanged`
    - When state is "inactive" or "failed", display AIRI chatbox, hide Code BrowserView overlay
    - When state is "active", hide AIRI chatbox, show Code BrowserView overlay
    - When state is "starting", display loading indicator: "Activating Hacking Mode..."
    - Use CSS transitions (300ms duration) for smooth visibility changes
    - Ensure only one interface visible at a time
    - Display visual badge when active: "Code Mode: <mode>"
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 12.8_

- [ ] 8. Implement Settings UI integration
  - [ ] 8.1 Create HackingModeToggle component
    - Create `apps/stage-tamagotchi/src/renderer/components/hackingMode/HackingModeToggle.vue`
    - Subscribe to `electronHackingSessionStateChanged` for state display
    - Display current state: "Inactive", "Starting...", "Active", or "Failed"
    - When active, display processInfo.pid and processInfo.port for debugging
    - When failed, display lastError with red/error styling
    - Provide toggle button: "Activate Hacking Mode" (inactive) / "Deactivate Hacking Mode" (active)
    - On activate click, invoke `electronHackingSessionActivate` with selected codeMode and providerConfig
    - On deactivate click, invoke `electronHackingSessionDeactivate`
    - Disable button while state is "starting" (prevent duplicate activation)
    - Show "Retry" button when state is "failed", invoke activate with same config (new sessionId)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.7, 10.8, 10.9_
  
  - [ ] 8.2 Add mode selection dropdown
    - Include dropdown with options: "Spec", "Vibe", "Boss", "Ask", "Debug" (default: "Vibe")
    - Persist selection to app config
    - Apply mode on next activation only (not hot-reload)
    - _Requirements: 9.9, 9.10_
  
  - [ ] 8.3 Add keyboard shortcut display
    - Display shortcut: "Ctrl+Shift+H (Cmd+Shift+H on macOS)" with explanatory text
    - _Requirements: 9.11_
  
  - [ ] 8.4 Integrate into Settings layout
    - Add HackingModeToggle to settings page (e.g., "Developer Tools" or "Advanced" category)
    - Ensure route is registered with settings layout
    - _Requirements: 9.1_

- [ ] 9. Implement keyboard shortcut controller
  - [ ] 9.1 Register global keyboard shortcut
    - Update existing shortcut service in `apps/stage-tamagotchi/src/main/` (locate appropriate service)
    - Register Ctrl+Shift+H (Cmd+Shift+H on macOS) for toggle
    - When pressed and state is "inactive", invoke activate
    - When pressed and state is "active", invoke deactivate
    - When pressed and state is "starting", do nothing (debounce)
    - When pressed and state is "failed", attempt activation (retry)
    - Make shortcut configurable via settings (stored as "hackingModeShortcut" in app config)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [ ] 9.2 Display notification on shortcut trigger
    - Show notification: "Activating Hacking Mode..." or "Deactivating Hacking Mode..."
    - _Requirements: 11.7_

- [ ] 10. Implement error handling and user notifications
  - [ ] 10.1 Add user-facing error notifications
    - When state transitions to "failed", display notification with title "Hacking Mode Failed" and lastError message
    - Include troubleshooting steps based on error type (port conflict, process crash, timeout)
    - _Requirements: 10.1, 10.2, 10.6_
  
  - [ ] 10.2 Implement automatic crash handling
    - On process crash while active, automatically transition to failed and deactivate
    - _Requirements: 10.3_
  
  - [ ] 10.3 Add comprehensive error logging
    - Log all errors to main process console with @guiiai/logg namespace "hacking-session" level "error"
    - Include timestamp, sessionId, state before error, error message, stack trace, processInfo
    - _Requirements: 10.4, 10.5_

- [ ] 11. Checkpoint - Ensure renderer integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement provider configuration mapping
  - [ ] 12.1 Create provider mapping logic
    - In HackingSessionService.activate(), read AIRI's current provider config from app config
    - Extract fields: name, apiKey, baseUrl, model, temperature, maxTokens
    - Map AIRI provider names to Code_Module names using lookup table (openai→openai, anthropic→anthropic, gemini→gemini, openrouter→openrouter)
    - If provider name not in table, pass unchanged and log warning
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [ ] 12.2 Construct and send config payload
    - Build config: `{ provider: { name, apiKey, baseUrl, model, temperature, maxTokens }, mode, sessionId }`
    - Send via CodeBridgeService POST /config after WebSocket handshake
    - If POST fails, log error but continue (Code uses stored settings)
    - Make mapping table configurable via app config for extensibility
    - _Requirements: 16.5, 16.6, 16.7, 16.8_

- [ ] 13. Implement graceful degradation and AIRI continuity
  - [ ] 13.1 Add startup failure handling
    - If Code_Process fails to start within 30000ms during app init, mark state as "failed" and continue AIRI startup
    - Ensure Main_Window loads normally regardless of Hacking_Session state
    - _Requirements: 17.1, 17.2_
  
  - [ ] 13.2 Ensure AIRI core features work in inactive/failed states
    - Verify Chat_Component displays AIRI chatbox and functions normally when state is "failed" or "inactive"
    - Verify Settings_Page displays error with "Retry" button when failed
    - Verify AIRI supports all core features in inactive state (text input, TTS, provider selection, history, settings)
    - _Requirements: 17.3, 17.4, 17.5, 17.6_
  
  - [ ] 13.3 Prevent blocking AIRI initialization
    - Ensure HackingSessionService does not block AIRI startup or operation
    - If state is "failed" at startup, log error to ~/.kiro/logs/hacking-session.log but do NOT show notification
    - _Requirements: 17.7, 17.8_

- [ ] 14. Implement Code_Backend modifications (WebSocket bridge, config, health endpoints)
  - [ ] 14.1 Add health endpoint to Code_Backend
    - Create `modules/code/apps/roo-code-standalone/src/backend/routes/health.ts`
    - Implement GET /health returning `{ status: "ok", version: "1.0.0" }`
    - Return HTTP 200 when ready, 500+ when not ready
    - _Requirements: 2.5, 14.1, 14.2_
  
  - [ ] 14.2 Add config endpoint to Code_Backend
    - Create `modules/code/apps/roo-code-standalone/src/backend/routes/config.ts`
    - Implement POST /config accepting JSON: `{ provider, mode, sessionId }`
    - Validate X-Session-ID header matches payload sessionId (return 400 if mismatch)
    - Apply provider config and mode to Code_Module runtime
    - Return `{ success: true, appliedConfig: { provider, mode } }` on success
    - Return HTTP 500 with error on failure
    - Do not persist config (ephemeral per session)
    - Support hot reload (accept updates while running)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_
  
  - [ ] 14.3 Add WebSocket bridge endpoint to Code_Backend
    - Create `modules/code/apps/roo-code-standalone/src/backend/routes/bridge.ts`
    - Implement WebSocket endpoint at ws://localhost:3210/bridge
    - On connection, expect handshake: `{ type: "auth", sessionId, token }`
    - Validate token against shared secret (env var CODE_BRIDGE_TOKEN or default "animaios-hacking-bridge")
    - If invalid token, close with code 4001 "Authentication failed"
    - If valid, store connection with sessionId mapping
    - _Requirements: 3.2, 3.3, 3.4, 14.3, 14.4, 14.5, 14.6_
  
  - [ ] 14.4 Implement summary emission via WebSocket bridge
    - When Code_Module completes task and generates summary, emit to all authenticated /bridge clients
    - Message format: `{ type: "summary", sessionId, text, metadata: { mode, model, tokens } }`
    - _Requirements: 3.5, 8.4, 14.7_
  
  - [ ] 14.5 Implement keepalive pings and graceful shutdown
    - Send keepalive pings every 30000ms to detect stale connections
    - Close connections gracefully on SIGTERM or SIGINT signals
    - _Requirements: 3.15, 14.8, 14.9_

- [ ]* 15. Write integration tests for full activation flow
  - Test full flow: inactive → starting → active (including all 3 readiness tiers)
  - Test summary flow: Code → WebSocket → CodeBridge → Eventa → TTS_Narrator
  - Test process crash recovery and teardown
  - Test WebSocket reconnection
  - Test config sync
  - _Requirements: All acceptance criteria_

- [ ]* 16. Write property-based tests for system-wide invariants
  - **Property 2: One Live Session** - verify at most one Code_Process with one sessionId exists
  - **Property 6: Session Ephemeral** - verify sessionId never persisted, invalidated on crash/restart
  - **Validates: Requirements 1.10, 2.10, 2.12, 13.1, 13.6**

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability (format: X.Y)
- The design defines 17 correctness properties that should be validated through property-based tests
- Checkpoints ensure incremental validation at key integration points
- Implementation follows TypeScript in a pnpm monorepo (stage-tamagotchi Electron app)
- Use @moeru/eventa for IPC, injeca for DI, @guiiai/logg for logging, Valibot/Zod for validation
- Core services (HackingSessionService, CodeBridgeService, UIAdapterLayer) live in `apps/stage-tamagotchi/src/main/services/hackingSession/`
- Renderer components and composables live in `apps/stage-tamagotchi/src/renderer/`
- Code_Backend modifications are in `modules/code/apps/roo-code-standalone/src/backend/`
- Follow existing project patterns for Electron IPC, Vue composables, and Vitest testing

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.10"]
    },
    {
      "id": 2,
      "tasks": ["2.2", "2.3", "2.9"]
    },
    {
      "id": 3,
      "tasks": ["2.4", "2.5"]
    },
    {
      "id": 4,
      "tasks": ["2.6", "2.7"]
    },
    {
      "id": 5,
      "tasks": ["2.8", "4.1"]
    },
    {
      "id": 6,
      "tasks": ["4.2", "4.6", "4.7", "4.9"]
    },
    {
      "id": 7,
      "tasks": ["4.3", "4.4", "4.8", "5.1"]
    },
    {
      "id": 8,
      "tasks": ["4.5", "5.2", "5.3", "5.6", "5.7"]
    },
    {
      "id": 9,
      "tasks": ["5.4", "5.5", "7.1"]
    },
    {
      "id": 10,
      "tasks": ["7.2", "7.4"]
    },
    {
      "id": 11,
      "tasks": ["7.3", "7.5", "8.1"]
    },
    {
      "id": 12,
      "tasks": ["8.2", "8.3", "8.4", "9.1"]
    },
    {
      "id": 13,
      "tasks": ["9.2", "10.1", "10.2", "10.3", "12.1"]
    },
    {
      "id": 14,
      "tasks": ["12.2", "13.1", "13.2", "13.3", "14.1"]
    },
    {
      "id": 15,
      "tasks": ["14.2", "14.3"]
    },
    {
      "id": 16,
      "tasks": ["14.4", "14.5"]
    },
    {
      "id": 17,
      "tasks": ["15", "16"]
    }
  ]
}
```
