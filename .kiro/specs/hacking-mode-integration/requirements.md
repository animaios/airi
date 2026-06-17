# Requirements Document

## Introduction

This document defines requirements for integrating the AnimAIOS Code module (a standalone browser-based AI coding assistant) into the stage-tamagotchi Electron application to implement "Hacking Mode" functionality. The Code module is a fork of Roo Code that runs as a self-contained React SPA with a Fastify backend at localhost:3210. Hacking Mode enables AIRI to activate Code inside the AIRI interface via BrowserView, transforming the AIRI chatbox into the Code interface while AIRI narrates Code's summaries via TTS.

The integration must preserve the Code module's independence (it remains a standalone product) while creating a seamless embedded experience where AIRI acts as the host and Code provides the coding intelligence on demand.

## Glossary

- **AIRI**: The AI companion personality that hosts the stage-tamagotchi Electron application
- **Code_Module**: The standalone browser-based AI coding assistant (AnimAIOS Code fork of Roo Code)
- **Hacking_Mode**: The integration state where Code_Module runs embedded inside AIRI's interface
- **Normal_Mode**: The default state where users interact directly with AIRI without Code_Module visible
- **BrowserView**: Electron's component for embedding web content within application windows
- **Code_Backend**: The Fastify server (port 3210) that serves Code_Module's React SPA and handles WebSocket streaming
- **Code_Process**: The child process running Code_Backend
- **Main_Window**: The primary stage-tamagotchi Electron window
- **AIRI_Chatbox**: The user input interface in Normal_Mode
- **Code_Interface**: The embedded Code_Module UI visible during Hacking_Mode
- **TTS_Narration**: Text-to-speech output for Code_Module summaries delivered through AIRI's voice
- **IPC_Bridge**: The inter-process communication layer connecting Code_Backend to Electron main process
- **Eventa**: The type-safe IPC/RPC framework used for all communication contracts

## Requirements

### Requirement 1: Code Backend Process Lifecycle Management

**User Story:** As an AIRI user, I want the Code backend to start automatically when needed and shut down cleanly when the app closes, so that Hacking Mode is always available without manual intervention.

#### Acceptance Criteria

1. WHEN the Electron app starts, THE Process_Manager SHALL spawn Code_Process running Code_Backend on localhost:3210
2. WHEN Code_Process initialization completes, THE Process_Manager SHALL verify Code_Backend responds to health checks within 5000ms
3. IF Code_Process fails to start or respond, THEN THE Process_Manager SHALL log the error and set Hacking_Mode availability to degraded
4. WHEN the Electron app quits, THE Process_Manager SHALL send SIGTERM to Code_Process and wait up to 3000ms for graceful shutdown
5. IF Code_Process does not exit within timeout, THEN THE Process_Manager SHALL send SIGKILL to force termination
6. WHEN Code_Process crashes unexpectedly, THE Process_Manager SHALL emit a status event indicating degraded state
7. THE Process_Manager SHALL expose the Code_Process PID for monitoring and debugging

### Requirement 2: BrowserView Embedding and Lifecycle

**User Story:** As an AIRI user, I want the Code interface to appear seamlessly inside the AIRI window when Hacking Mode activates, so that I experience a unified application rather than separate windows.

#### Acceptance Criteria

1. WHEN Hacking_Mode activates, THE BrowserView_Controller SHALL create a BrowserView instance loading http://localhost:3210
2. THE BrowserView_Controller SHALL attach the BrowserView to Main_Window with bounds matching the chat content area
3. WHILE Hacking_Mode is active, THE BrowserView_Controller SHALL update BrowserView bounds whenever Main_Window resizes
4. WHEN Main_Window resizes, THE BrowserView_Controller SHALL recalculate and apply new bounds within 16ms (one frame at 60fps)
5. WHEN Hacking_Mode deactivates, THE BrowserView_Controller SHALL detach the BrowserView from Main_Window
6. WHEN BrowserView detaches, THE BrowserView_Controller SHALL destroy the BrowserView instance to free resources
7. THE BrowserView_Controller SHALL prevent BrowserView creation if Code_Backend health check fails

### Requirement 3: Mode Transition and State Management

**User Story:** As an AIRI user, I want to smoothly transition between Normal Mode and Hacking Mode with clear visual feedback, so that I understand which system (AIRI or Code) is handling my input.

#### Acceptance Criteria

1. THE Mode_Controller SHALL maintain a mode state of either "normal" or "hacking"
2. WHEN a user activates Hacking_Mode, THE Mode_Controller SHALL transition from "normal" to "hacking" state
3. WHEN transitioning to "hacking", THE Mode_Controller SHALL hide AIRI_Chatbox and show Code_Interface
4. WHEN transitioning to "normal", THE Mode_Controller SHALL hide Code_Interface and show AIRI_Chatbox
5. THE Mode_Controller SHALL persist the current mode state to local storage
6. WHEN the app restarts, THE Mode_Controller SHALL restore the previously active mode
7. WHILE in "hacking" mode, THE Mode_Controller SHALL route all user messages to Code_Interface

### Requirement 4: User Input Routing

**User Story:** As an AIRI user, I want my messages to go to the correct system (AIRI or Code) based on the current mode, so that my input is processed by the appropriate AI assistant.

#### Acceptance Criteria

1. WHILE Mode_Controller state is "normal", THE Input_Router SHALL send user messages to AIRI's chat processing pipeline
2. WHILE Mode_Controller state is "hacking", THE Input_Router SHALL forward user messages to Code_Interface
3. WHEN Code_Interface receives a message, THE Code_Module SHALL process it as if typed directly in the standalone browser interface
4. THE Input_Router SHALL prevent message duplication across AIRI and Code_Module
5. WHEN a user switches modes with pending input, THE Input_Router SHALL preserve the input text for the new mode
6. THE Input_Router SHALL maintain separate message histories for AIRI and Code_Module
7. WHEN transitioning between modes, THE Input_Router SHALL restore the appropriate message history

### Requirement 5: Code Summary Extraction and TTS Narration

**User Story:** As an AIRI user, I want AIRI to narrate Code's progress summaries in her voice, so that I receive audio feedback about coding activities without reading text.

#### Acceptance Criteria

1. THE Summary_Extractor SHALL establish a WebSocket connection to Code_Backend's streaming endpoint
2. WHEN Code_Module generates a task completion summary, THE Summary_Extractor SHALL extract the summary text
3. WHEN summary text is extracted, THE Summary_Extractor SHALL emit a "code-summary-ready" event with the text payload
4. WHEN a "code-summary-ready" event is emitted, THE TTS_Bridge SHALL send the summary text to AIRI's TTS pipeline
5. THE TTS_Bridge SHALL use AIRI's configured voice settings for narration
6. IF TTS generation fails, THEN THE TTS_Bridge SHALL log the error and continue without blocking Code_Module
7. THE Summary_Extractor SHALL handle WebSocket reconnection if the connection drops

### Requirement 6: Eventa IPC Contracts for Hacking Mode

**User Story:** As a developer, I want type-safe IPC contracts for all Hacking Mode operations, so that renderer and main process communication is reliable and maintainable.

#### Acceptance Criteria

1. THE IPC_Contracts SHALL define an `electronHackingModeActivate` invoke event returning activation status
2. THE IPC_Contracts SHALL define an `electronHackingModeDeactivate` invoke event returning deactivation status
3. THE IPC_Contracts SHALL define an `electronHackingModeGetStatus` invoke event returning current mode and backend health
4. THE IPC_Contracts SHALL define an `electronHackingModeStatusChanged` broadcast event with mode and health payload
5. THE IPC_Contracts SHALL define an `electronCodeSummaryReceived` broadcast event with summary text payload
6. THE IPC_Contracts SHALL include TypeScript interfaces for all payload structures
7. ALL IPC contracts SHALL follow the existing Eventa naming convention (eventa:invoke:electron:hacking-mode:*)

### Requirement 7: Code Backend Health Monitoring

**User Story:** As an AIRI user, I want the system to detect when the Code backend is unhealthy and inform me gracefully, so that I know Hacking Mode is unavailable without experiencing silent failures.

#### Acceptance Criteria

1. THE Health_Monitor SHALL ping Code_Backend HTTP endpoint every 5000ms
2. WHEN Code_Backend responds with HTTP 200, THE Health_Monitor SHALL mark status as "healthy"
3. IF Code_Backend fails to respond within 2000ms, THEN THE Health_Monitor SHALL mark status as "degraded"
4. IF three consecutive health checks fail, THEN THE Health_Monitor SHALL mark status as "error"
5. WHEN status changes from "healthy" to "degraded" or "error", THE Health_Monitor SHALL emit status change event
6. WHEN status changes to "error", THE Health_Monitor SHALL prevent Hacking_Mode activation attempts
7. THE Health_Monitor SHALL expose current health status via `electronHackingModeGetStatus` IPC contract

### Requirement 8: Settings UI Integration

**User Story:** As an AIRI user, I want to configure Hacking Mode settings from the settings UI, so that I can control when and how Code integration activates.

#### Acceptance Criteria

1. THE Settings_Page SHALL include a "Hacking Mode" section in the appropriate settings category
2. THE Settings_Page SHALL display current Hacking_Mode status (active/inactive) and backend health (healthy/degraded/error)
3. THE Settings_Page SHALL provide a toggle to activate or deactivate Hacking_Mode
4. WHEN the toggle is activated, THE Settings_Page SHALL invoke `electronHackingModeActivate` and show loading state
5. WHEN activation completes, THE Settings_Page SHALL update the UI to reflect active state
6. THE Settings_Page SHALL display Code_Backend PID when available for debugging
7. THE Settings_Page SHALL show the last error message if Code_Backend health is degraded or error

### Requirement 9: Error Handling and User Feedback

**User Story:** As an AIRI user, I want clear error messages when Hacking Mode fails, so that I understand what went wrong and can take corrective action or report issues.

#### Acceptance Criteria

1. IF Code_Backend fails to start, THEN THE Error_Handler SHALL display a notification with the error message
2. IF BrowserView fails to load Code_Interface, THEN THE Error_Handler SHALL retry once after 2000ms
3. IF retry fails, THEN THE Error_Handler SHALL show a "Hacking Mode Unavailable" message with troubleshooting steps
4. WHEN Code_Process crashes during active Hacking_Mode, THE Error_Handler SHALL automatically deactivate Hacking_Mode
5. WHEN automatic deactivation occurs, THE Error_Handler SHALL show a notification explaining the crash and transition to Normal_Mode
6. THE Error_Handler SHALL log all errors to the main process console with stack traces
7. THE Error_Handler SHALL include the Code_Backend port and PID in error logs for debugging

### Requirement 10: Keyboard Shortcuts for Mode Switching

**User Story:** As an AIRI user, I want a keyboard shortcut to toggle between Normal Mode and Hacking Mode, so that I can quickly switch contexts without using the mouse.

#### Acceptance Criteria

1. THE Shortcut_Controller SHALL register Ctrl+Shift+H (Cmd+Shift+H on macOS) as the Hacking_Mode toggle shortcut
2. WHEN the toggle shortcut is pressed in Normal_Mode, THE Shortcut_Controller SHALL activate Hacking_Mode
3. WHEN the toggle shortcut is pressed in Hacking_Mode, THE Shortcut_Controller SHALL deactivate Hacking_Mode
4. THE Shortcut_Controller SHALL prevent toggle during mode transition (debounce 500ms)
5. IF Code_Backend health is "error", THEN THE Shortcut_Controller SHALL show an error notification instead of activating
6. THE Shortcut_Controller SHALL use the existing global shortcut service pattern
7. THE toggle shortcut SHALL be configurable via settings UI

### Requirement 11: Dependency Injection and Service Architecture

**User Story:** As a developer, I want Hacking Mode services to integrate with the existing injeca dependency injection system, so that service lifecycle is managed consistently with other AIRI modules.

#### Acceptance Criteria

1. THE Hacking_Mode_Service SHALL be registered in the injeca container in `src/main/index.ts`
2. THE Hacking_Mode_Service SHALL depend on { lifecycle, mainWindow, serverChannel }
3. WHEN injeca starts, THE Hacking_Mode_Service SHALL initialize Code_Process_Manager
4. WHEN injeca stops, THE Hacking_Mode_Service SHALL shutdown Code_Process gracefully
5. THE Hacking_Mode_Service SHALL expose public methods: activate(), deactivate(), getStatus()
6. THE BrowserView_Controller SHALL be a private implementation detail within Hacking_Mode_Service
7. THE Hacking_Mode_Service SHALL follow the existing service pattern used by MCP, widgets, and godot-stage

### Requirement 12: Code Module Configuration Management

**User Story:** As an AIRI user, I want the Code module to use my preferred LLM provider configuration, so that Hacking Mode uses the same AI model settings as the rest of AIRI.

#### Acceptance Criteria

1. THE Config_Sync SHALL read AIRI's current LLM provider settings from the app config
2. WHEN Hacking_Mode activates, THE Config_Sync SHALL send provider configuration to Code_Backend via HTTP POST
3. THE Code_Backend SHALL accept provider configuration and update Code_Module settings
4. WHEN AIRI's provider settings change, THE Config_Sync SHALL push updated config to Code_Backend if Hacking_Mode is active
5. THE Config_Sync SHALL map AIRI provider config format to Code_Module's expected format
6. IF config sync fails, THEN THE Config_Sync SHALL log the error but allow Hacking_Mode to continue with Code_Module's stored settings
7. THE Config_Sync SHALL support all providers that both AIRI and Code_Module have in common

### Requirement 13: WebSocket Bridge for Real-time Communication

**User Story:** As a developer, I want a WebSocket bridge between Code Backend and Electron main process, so that real-time events (summaries, status changes) flow efficiently from Code to AIRI.

#### Acceptance Criteria

1. THE WebSocket_Bridge SHALL establish a WebSocket connection from Electron main to Code_Backend at ws://localhost:3210/bridge
2. WHEN connection is established, THE WebSocket_Bridge SHALL send an authentication message with a shared token
3. WHEN Code_Backend generates a summary, THE WebSocket_Bridge SHALL receive a "summary" message with text payload
4. WHEN a "summary" message is received, THE WebSocket_Bridge SHALL emit `electronCodeSummaryReceived` event
5. THE WebSocket_Bridge SHALL handle connection close events and attempt reconnection with exponential backoff
6. THE WebSocket_Bridge SHALL close the connection when Hacking_Mode deactivates
7. THE WebSocket_Bridge SHALL use a maximum backoff of 30000ms for reconnection attempts

### Requirement 14: Code Backend Custom Endpoint for Summary Streaming

**User Story:** As a developer, I want Code Backend to expose a dedicated endpoint for streaming summaries to Electron, so that AIRI can receive Code's output without polling the UI state.

#### Acceptance Criteria

1. THE Code_Backend SHALL implement a `/bridge` WebSocket endpoint for Electron connections
2. WHEN a WebSocket client connects to `/bridge`, THE Code_Backend SHALL validate authentication token
3. IF authentication fails, THEN THE Code_Backend SHALL close the WebSocket with 4001 code
4. WHEN Code_Module generates a task summary, THE Code_Backend SHALL emit a "summary" message to all authenticated `/bridge` clients
5. THE Code_Backend SHALL include task metadata (mode, model, tokens) in summary messages
6. THE Code_Backend SHALL throttle summary messages to max 1 per second per client
7. THE Code_Backend SHALL implement keepalive pings every 30000ms to detect stale connections

### Requirement 15: BrowserView Isolation and Security

**User Story:** As a developer, I want BrowserView to run Code Module in an isolated context with appropriate security settings, so that Code operations cannot interfere with AIRI's main renderer or compromise user data.

#### Acceptance Criteria

1. THE BrowserView SHALL be created with `nodeIntegration: false` and `contextIsolation: true`
2. THE BrowserView SHALL enable `sandbox: true` for additional isolation
3. THE BrowserView SHALL use a separate session partition "persist:hacking-mode"
4. THE BrowserView SHALL disable `webSecurity: false` to prevent bypassing CORS for localhost
5. THE BrowserView SHALL set `allowRunningInsecureContent: false` to prevent mixed content
6. THE BrowserView_Controller SHALL not expose any Electron APIs to Code_Module via preload scripts
7. THE BrowserView SHALL load content only from http://localhost:3210 and reject other origins

### Requirement 16: Logging and Debugging Support

**User Story:** As a developer, I want comprehensive logging for Hacking Mode operations, so that I can diagnose issues in production and development environments.

#### Acceptance Criteria

1. THE Hacking_Mode_Service SHALL use `@guiiai/logg` for all logging with namespace "hacking-mode"
2. WHEN Code_Process starts, THE Service SHALL log PID, port, and startup duration
3. WHEN BrowserView is created or destroyed, THE Service SHALL log BrowserView ID and bounds
4. WHEN mode transitions occur, THE Service SHALL log previous state, new state, and transition reason
5. WHEN errors occur, THE Service SHALL log error messages with stack traces and context
6. THE Service SHALL log WebSocket connection state changes with timestamp
7. THE Service SHALL log health check results every 30000ms when in debug mode

### Requirement 17: Code Module Mode Selection Integration

**User Story:** As an AIRI user, I want to select which Code mode (Spec, Vibe, Boss, Ask, Debug) to use when Hacking Mode activates, so that I can choose the appropriate coding workflow for my task.

#### Acceptance Criteria

1. THE Settings_Page SHALL include a dropdown for selecting Code_Module mode (Spec, Vibe, Boss, Ask, Debug)
2. WHEN mode selection changes, THE Settings_Page SHALL persist the choice to app config
3. WHEN Hacking_Mode activates, THE Mode_Controller SHALL send the selected mode to Code_Backend via HTTP POST
4. THE Code_Backend SHALL apply the mode selection to Code_Module's active instance
5. THE Settings_Page SHALL display a description of each mode (taken from Code module documentation)
6. THE Settings_Page SHALL default to "Vibe" mode if no selection is stored
7. THE mode selection SHALL only take effect on next Hacking_Mode activation

### Requirement 18: Graceful Degradation When Code Module Unavailable

**User Story:** As an AIRI user, I want AIRI to continue working normally if Code Module fails to start, so that a Hacking Mode issue doesn't prevent me from using AIRI's core features.

#### Acceptance Criteria

1. IF Code_Backend fails to start, THEN THE Process_Manager SHALL log the error and mark status as "unavailable"
2. WHEN status is "unavailable", THE Hacking_Mode UI controls SHALL be disabled with a tooltip explaining the issue
3. THE Main_Window SHALL load and function normally regardless of Code_Backend status
4. THE Settings_Page SHALL show Code_Backend status as "Unavailable" with last error message
5. THE Settings_Page SHALL provide a "Retry" button to attempt Code_Backend restart
6. WHEN retry is clicked, THE Process_Manager SHALL attempt to start Code_Process again
7. THE AIRI chat interface SHALL remain fully functional in Normal_Mode regardless of Hacking_Mode availability

