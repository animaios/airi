# Design Document: Hacking Mode Integration

## Overview

### Purpose

This document defines the system architecture for integrating the AnimAIOS Code module (a standalone browser-based AI coding assistant) into the stage-tamagotchi Electron application to implement "Hacking Mode" functionality.

### Scope

The integration embeds Code's UI inside AIRI's interface while maintaining Code's independence as a separate runtime. This is a distributed runtime orchestration layer managing an external AI runtime within an Electron host process.

### Key Goals

1. Provide seamless embedded Code experience within AIRI
2. Maintain Code module as independently usable standalone product
3. Implement deterministic failure handling and session correlation
4. Ensure single source of truth for all state management

## 1. Introduction

This document defines the system architecture for integrating the AnimAIOS Code module (a standalone browser-based AI coding assistant) into the stage-tamagotchi Electron application. This integration implements "Hacking Mode" - a feature that embeds Code's UI inside AIRI's interface while maintaining Code's independence as a separate runtime.

### 1.1 Architecture Classification

This is a **distributed runtime orchestration layer** - not a simple feature integration. The system behaves like a lightweight container orchestrator managing an external AI runtime within an Electron host process.

### 1.2 Design Constraints

1. **Code module independence**: Code must remain usable standalone; no AIRI-specific coupling
2. **Single source of truth**: All state owned by HackingSessionService in Electron main process
3. **Deterministic failure handling**: Any failure triggers complete teardown
4. **Session correlation**: All activity tagged with ephemeral sessionId
5. **No dual control planes**: Only HackingSessionService can control state transitions

### 1.3 Key Design Decisions

- **3-service architecture** replacing 6+ scattered controllers
- **4-state FSM** (inactive, starting, active, failed) with explicit transitions
- **Ephemeral sessions** (sessionId regenerated per activation, never persisted)
- **Ordered teardown** (8-step sequence preventing ghost states)
- **Single event path** for summaries (WebSocket → Eventa → TTS, no alternates)

---

## Architecture

### System Architecture Overview

The system implements a 3-service architecture with single control plane:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │         HackingSessionService (Orchestrator)          │    │
│  │  • Owns: HackingSessionState (sessionId, state, ...)  │    │
│  │  • Controls: lifecycle, activation, teardown          │    │
│  │  • Manages: Code_Process, CodeBridge, UIAdapter       │    │
│  └──────────┬────────────────────────┬───────────────────┘    │
│             │                        │                         │
│    ┌────────▼────────┐      ┌────────▼──────────┐            │
│    │ CodeBridgeService│      │  UIAdapterLayer   │            │
│    │ • WebSocket mgmt │      │ • BrowserView only│            │
│    │ • Config sync    │      │ • Rendering       │            │
│    │ • Summary stream │      │ • Resize handling │            │
│    └────────┬─────────┘      └────────┬──────────┘            │
│             │                         │                        │
│             │ WebSocket               │ UI Control             │
└─────────────┼─────────────────────────┼────────────────────────┘
              │                         │
              │ ws://localhost:{port}   │ WebContentsView
              │      /bridge            │   ↓
              │                    ┌────▼──────────────┐
              │                    │   Main_Window     │
              │                    │                   │
              │                    │ ┌───────────────┐ │
              └────────────────────┼─┤WebContentsView│ │
                                   │ │ (Code UI)     │ │
                                   │ └───────────────┘ │
                                   └───────────────────┘
              ┌────────────────────────────────────────┐
              │    Code_Process (External Runtime)    │
              │  ┌──────────────────────────────────┐ │
              │  │  Fastify Backend (dynamic port)  │ │
              │  │  • /health (HTTP GET)            │ │
              │  │  • /config (HTTP POST)           │ │
              │  │  • /bridge (WebSocket)           │ │
              │  │  • React SPA + LLM execution     │ │
              │  └──────────────────────────────────┘ │
              └────────────────────────────────────────┘

              ┌────────────────────────────────────────┐
              │         Eventa Event Bus               │
              │  (IPC between main ↔ renderer)         │
              │                                        │
              │  Invoke Events (renderer → main):     │
              │  • electronHackingSessionActivate      │
              │  • electronHackingSessionDeactivate    │
              │                                        │
              │  Broadcast Events (main → renderer):  │
              │  • electronHackingSessionStateChanged  │
              │  • electronCodeSummaryReceived         │
              └────────────────────────────────────────┘

              ┌────────────────────────────────────────┐
              │      Electron Renderer Process         │
              │                                        │
              │  ┌──────────────┐   ┌──────────────┐  │
              │  │ Settings UI  │   │ Chat Component│ │
              │  │ • Toggle btn │   │ • Input       │ │
              │  │ • Mode select│   │ • History     │ │
              │  └──────────────┘   └───────┬──────┘  │
              │                              │         │
              │  ┌────────────────────────────▼─────┐  │
              │  │      Input_Gateway               │  │
              │  │  • Routes to AIRI or Code        │  │
              │  │  • Based on HackingSession state │  │
              │  └──────────────────────────────────┘  │
              │                                        │
              │  ┌──────────────────────────────────┐  │
              │  │      TTS_Narrator                │  │
              │  │  • Subscribes to summaries       │  │
              │  │  • Validates sessionId           │  │
              │  │  • Narrates via AIRI voice       │  │
              │  └──────────────────────────────────┘  │
              └────────────────────────────────────────┘
```

---

## Components and Interfaces

### Core Services

- **Owns:** HackingSessionState, state machine logic, process lifecycle
- **Controls:** activation, deactivation, teardown coordination
- **Manages:** Code_Process, CodeBridgeService, UIAdapterLayer

#### CodeBridgeService

- **Manages:** WebSocket connection, config sync, summary streaming
- **Validates:** SessionId in all incoming messages
- **Handles:** Reconnection with exponential backoff

#### UIAdapterLayer

- **Renders:** WebContentsView (pure UI surface, no authority)
- **Handles:** Resize, load retry, teardown blanking
- **Forbidden:** State storage, IPC emission, backend communication

### Process Boundaries

| Process | Responsibility | Communication |
|---------|---------------|---------------|
| **Electron Main** | Orchestration, state management, IPC handling | Eventa IPC, child_process spawn, WebSocket client |
| **Electron Renderer** | UI rendering, user interaction, state subscription | Eventa IPC (subscribe to broadcasts) |
| **Code_Process** | LLM execution, code operations, summary generation | HTTP server, WebSocket server |

| **Electron Renderer** | UI rendering, user interaction, state subscription | Eventa IPC (subscribe to broadcasts) |

---

## Data Models

### HackingSessionState

```typescript
interface HackingSessionState {
  sessionId: string | null;          // UUID v4, null when inactive/failed
  state: "inactive" | "starting" | "active" | "failed";
  processInfo?: {
    pid: number;                     // Code_Process PID
    port: number;                    // Dynamically assigned port
  };
  lastError?: string;                // Human-readable error message
}
```

### ActivationConfig

```typescript
interface ActivationConfig {
  codeMode?: "spec" | "vibe" | "boss" | "ask" | "debug";
  providerConfig?: {
    name: string;                    // Provider name (e.g., "anthropic")
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}
```

### SummaryMessage

```typescript
interface SummaryMessage {
  type: "summary";
  sessionId: string;                 // Must match current session
  text: string;                      // Human-readable summary
  metadata: {
    mode: string;                    // Code mode that generated summary
    model: string;                   // LLM model used
    tokens: number;                  // Total tokens consumed
  };
}
```

### State Machine



1. **Activation**: User → Settings UI → IPC invoke → HackingSessionService → spawn Code_Process → 3-tier readiness → WebSocket handshake → BrowserView creation
2. **User Input**: User types → Input_Gateway → routes based on state → either AIRI chat OR Code WebSocket
3. **Summary**: Code execution → summary generated → WebSocket /bridge → CodeBridgeService → validate sessionId → Eventa broadcast → TTS_Narrator
4. **Deactivation**: User/crash → HackingSessionService → 8-step teardown → state transition

### State Machine

#### States and Transitions

**States:**
1. **inactive**: No Code_Process running, sessionId null
2. **starting**: Process spawning, progressing through readiness tiers
3. **active**: Fully operational, BrowserView mounted, WebSocket connected
4. **failed**: Error occurred, teardown completed, retry available

**Transition Rules:**
- `inactive → starting`: activate() called
- `starting → active`: bridge_ready achieved
- `starting → failed`: timeout or error
- `active → inactive`: deactivate() called
- `active → failed`: process crash or fatal error
- `failed → starting`: retry with new sessionId

#### Control Flow Patterns

1. **Activation**: User → Settings UI → IPC invoke → HackingSessionService → spawn Code_Process → 3-tier readiness (process_started, http_ready, bridge_ready) → WebSocket handshake → BrowserView creation
2. **User Input**: User types → Input_Gateway → routes based on state → either AIRI chat OR Code WebSocket
3. **Summary**: Code execution → summary generated → WebSocket /bridge → CodeBridgeService → validate sessionId → Eventa broadcast → TTS_Narrator
4. **Deactivation**: User/crash → HackingSessionService → 8-step teardown → state transition

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Single Authority

*For any* state transition in the Hacking Session lifecycle, only HackingSessionService SHALL have the authority to control and execute that transition.

**Validates: Requirements 1.7, 1.8**

### Property 2: One Live Session

*For any* point in time, at most one Code_Process with one active sessionId SHALL exist in the system.

**Validates: Requirements 1.10, 2.10**

### Property 3: One Event Path

*For all* summary messages from Code to AIRI, the path SHALL be: Code → WebSocket → CodeBridge → Eventa → TTS, with no alternate paths allowed.

**Validates: Requirements 3.8, 6.1**

### Property 4: UI Stateless

*For any* operation involving WebContentsView, the WebContentsView SHALL NOT store state or trigger state transitions; it is purely a rendering surface.

**Validates: Requirements 4.1, 4.13**

### Property 5: Failure Collapse

*For any* failure detected in Code_Process, WebSocket connection, or BrowserView, the system SHALL trigger full teardown with no partial state preservation.

**Validates: Requirements 2.10, 2.11, 19.1**

### Property 6: Session Ephemeral

*For any* sessionId, it SHALL never be persisted to disk and SHALL be invalidated immediately upon process crash or restart.

**Validates: Requirements 2.10, 2.12, 13.1, 13.6**

### Property 7: Ordered Teardown

*For any* teardown sequence, all 8 steps SHALL execute sequentially in the prescribed order, with the sequence being idempotent.

**Validates: Requirements 2.11, 19.1, 19.2**

### Property 8: Readiness Progression

*For any* activation sequence, the system SHALL progress through exactly three readiness tiers (process_started → http_ready → bridge_ready) before transitioning to active state.

**Validates: Requirements 2.3, 2.4, 2.5, 2.6**

### Property 9: SessionId Correlation

*For all* components and messages in the system, activity SHALL be tagged with the current sessionId for correlation and validation.

**Validates: Requirements 1.10, 3.5, 13.1, 13.2, 13.3, 13.4, 13.5**

### Property 10: Mismatch Discard

*For any* message received with a sessionId that does not match the current active sessionId, the message SHALL be logged and discarded without processing.

**Validates: Requirements 3.6, 6.3, 13.7**

### Property 11: No Ghost States

*For any* teardown operation, WebContentsView content SHALL be blanked (loaded to about:blank) before the instance is destroyed, preventing ghost UI execution.

**Validates: Requirements 4.10, 4.11, 19.3**

### Property 12: No Split Brain

*For any* Code_Process restart (detected by PID change), the current sessionId SHALL be invalidated immediately, preventing split-brain scenarios.

**Validates: Requirements 2.10, 2.12**

### Property 13: No Message Duplication

*For all* summary messages, exactly one path through the system SHALL exist, enforced by the architecture.

**Validates: Requirements 3.8, 6.1**

### Property 14: No State Skipping

*For any* transition to active state, the system SHALL transition through the starting state first; direct jumps are not permitted.

**Validates: Requirements 1.5, 2.7**

### Property 15: Eventual Teardown

*For any* teardown operation, all steps SHALL complete within bounded time limits, with each step having specific timeout constraints.

**Validates: Requirements 2.8, 19.2, 19.5**

### Property 16: Reconnection Bounded

*For any* WebSocket disconnection in active state, reconnection attempts SHALL be bounded to a maximum of 5 attempts before transitioning to failed state.

**Validates: Requirements 3.11, 3.13**

### Property 17: Activation Timeout

*For any* activation sequence, the transition from starting to active SHALL complete within 15 seconds, or the system SHALL transition to failed state.

**Validates: Requirements 2.7**

---

## Error Handling

### Failure Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Port conflict | spawn() EADDRINUSE | Find new port, user notification |
| Startup timeout | http_ready not in 10s | Kill process, transition to failed |
| Auth failure | WS close 4001 | Transition to failed, check token config |
| Process crash | SIGCHLD or PID change | Execute teardown, transition to failed |
| Parent death | Parent PID changes/becomes 1 | Code_Backend suicides (prevents zombies) |
| WS disconnect | Connection close | Reconnect with backoff (max 5 attempts) |
| Config sync fail | POST 500 | Log error, continue with stored settings |

### Teardown Contract

**8-Step Ordered Sequence:**
1. Stop Input_Gateway routing (immediate)
2. Blank BrowserView (500ms timeout)
3. Close WebSocket (1000ms timeout)
4. SIGTERM Code_Process (3000ms timeout)
5. SIGKILL if needed (immediate)
6. Destroy BrowserView (500ms timeout)
7. Null sessionId (immediate)
8. Emit state change (immediate)

**Properties:** Idempotent, best-effort completion, sequential execution

---

## Testing Strategy

### Unit Tests

- State machine transitions (all paths)
- Session generation and invalidation
- Teardown idempotence
- Message routing based on state
- SessionId validation logic

### Integration Tests

- Full activation flow (inactive → active)
- Summary flow end-to-end (Code → TTS)
- Process crash recovery
- WebSocket reconnection
- Config sync

### Property-Based Tests

- State machine invariants hold under random event sequences
- SessionId uniqueness across activations
- Teardown always completes

---

## 3. Detailed Architecture

### 3.1 Component Diagram


```
                    ┌──────────────┐
                    │   inactive   │ ◄─────────┐
                    └──────┬───────┘           │
                           │                    │
            activate()     │                    │
                           ▼                    │
                    ┌──────────────┐           │
                    │   starting   │           │
                    └──────┬───────┘           │
                           │                    │
        bridge_ready       │  timeout/error    │
                           │     ├─────────────┘
                           ▼     ▼
                    ┌──────────────┐
                    │    active    │
                    └──────┬───────┘
                           │
      deactivate()         │
      OR process crash     │
      OR fatal error       │
                           ▼
                    ┌──────────────┐
                    │    failed    │
                    └──────┬───────┘
                           │
                    retry() (generates new sessionId)
                           │
                           └─────► starting
```

### 3.2 State Transition Table

| From State | Trigger | To State | Side Effects |
|-----------|---------|----------|--------------|
| inactive | `activate()` called | starting | Generate sessionId, spawn Code_Process, start readiness checks |
| starting | bridge_ready achieved | active | Create BrowserView, emit state change event |
| starting | timeout OR error | failed | Execute teardown, emit state change with error |
| active | `deactivate()` called | inactive | Execute ordered teardown, null sessionId |
| active | Process crash OR fatal error | failed | Execute teardown, invalidate sessionId |
| failed | `activate()` (retry) | starting | Generate NEW sessionId, retry with same config |

### 3.3 Readiness Progression

The `starting` state progresses through three internal readiness tiers:

```
starting
  ├─ process_started    (PID available)
  ├─ http_ready         (GET /health returns 200)
  └─ bridge_ready       (WebSocket handshake completes)
                         ↓
                      active
```

**Timing constraints:**
- `http_ready`: Must be reached within 10000ms of process start
- `bridge_ready`: Must be reached within 15000ms total
- Failure to meet any constraint → transition to `failed`

### 3.4 Invariants

1. **At most one live session**: Only one Code_Process with one sessionId can exist
2. **State owns sessionId lifecycle**: sessionId created on `inactive → starting`, nulled on `active → inactive/failed`
3. **Teardown is atomic**: Once teardown starts, it runs to completion (idempotent, best-effort)
4. **No state skipping**: Must progress through starting to reach active

---

## 4. Sequence Diagrams

### 4.1 Activation Flow

```
User          Settings UI    HackingSession   Code_Process   CodeBridge   UIAdapter
  │                │              Service          (Fastify)      Service      Layer
  │                │                 │                 │             │           │
  │  Click toggle  │                 │                 │             │           │
  ├───────────────►│                 │                 │             │           │
  │                │ IPC: activate() │                 │             │           │
  │                ├────────────────►│                 │             │           │
  │                │                 │ Generate UUID   │             │           │
  │                │                 │ sessionId       │             │           │
  │                │                 │                 │             │           │
  │                │                 │ spawn process   │             │           │
  │                │                 ├────────────────►│             │           │
  │                │                 │                 │             │           │
  │                │                 │ [wait: process_started]       │           │
  │                │                 │◄────────────────┤             │           │
  │                │                 │ PID available   │             │           │
  │                │                 │                 │             │           │
  │                │                 │ GET /health     │             │           │
  │                │                 ├────────────────►│             │           │
  │                │                 │◄────────────────┤             │           │
  │                │                 │ 200 OK          │             │           │
  │                │                 │ [http_ready]    │             │           │
  │                │                 │                 │             │           │
  │                │                 │ Create CodeBridge             │           │
  │                │                 ├──────────────────────────────►│           │
  │                │                 │                 │             │           │
  │                │                 │                 │ WebSocket   │           │
  │                │                 │                 │ /bridge     │           │
  │                │                 │                 ◄─────────────┤           │
  │                │                 │                 │             │           │
  │                │                 │                 │ auth msg    │           │
  │                │                 │                 │ {sessionId} │           │
  │                │                 │                 ├────────────►│           │
  │                │                 │                 │◄────────────┤           │
  │                │                 │                 │ auth OK     │           │
  │                │                 │                 │             │           │
  │                │                 │ [bridge_ready]  │             │           │
  │                │                 │                 │             │           │
  │                │                 │ POST /config    │             │           │
  │                │                 ├────────────────►│             │           │
  │                │                 │◄────────────────┤             │           │
  │                │                 │ 200 OK          │             │           │
  │                │                 │                 │             │           │
  │                │                 │ Create BrowserView            │           │
  │                │                 ├──────────────────────────────────────────►│
  │                │                 │                 │             │           │
  │                │                 │                 │             │  Load UI  │
  │                │                 │                 │             │  http://  │
  │                │                 │                 │             │  :3210    │
  │                │                 │                 │             │◄──────────┤
  │                │                 │                 │             │           │
  │                │                 │ state = active  │             │           │
  │                │                 │                 │             │           │
  │                │ Broadcast:      │                 │             │           │
  │                │ StateChanged    │                 │             │           │
  │                ◄────────────────┤                 │             │           │
  │                │ {state:active}  │                 │             │           │
  │  UI updates    │                 │                 │             │           │
  │◄───────────────┤                 │                 │             │           │
```

### 4.2 Summary Flow

```
Code_Process   CodeBridge    HackingSession   Eventa Bus   TTS_Narrator   AIRI Voice
  (Execution)     Service         Service                                    
      │             │                │                │               │           │
      │ Task        │                │                │               │           │
      │ completes   │                │                │               │           │
      │             │                │                │               │           │
      │ Generate    │                │                │               │           │
      │ summary     │                │                │               │           │
      │             │                │                │               │           │
      │ WebSocket   │                │                │               │           │
      │ /bridge     │                │                │               │           │
      ├────────────►│                │                │               │           │
      │ {type:      │                │                │               │           │
      │  summary,   │                │                │               │           │
      │  sessionId, │                │                │               │           │
      │  text,      │                │                │               │           │
      │  metadata}  │                │                │               │           │
      │             │                │                │               │           │
      │             │ Validate       │                │               │           │
      │             │ sessionId      │                │               │           │
      │             │ matches current│                │               │           │
      │             │                │                │               │           │
      │             │ Emit Eventa    │                │               │           │
      │             │ broadcast      │                │               │           │
      │             ├────────────────┼───────────────►│               │           │
      │             │                │                │               │           │
      │             │                │                │ Subscribe     │           │
      │             │                │                ├──────────────►│           │
      │             │                │                │ {sessionId,   │           │
      │             │                │                │  text,        │           │
      │             │                │                │  metadata}    │           │
      │             │                │                │               │           │
      │             │                │                │               │ Validate  │
      │             │                │                │               │ sessionId │
      │             │                │                │               │           │
      │             │                │                │               │ Send to   │
      │             │                │                │               │ TTS       │
      │             │                │                │               ├──────────►│
      │             │                │                │               │           │
      │             │                │                │               │    Narrate│
      │             │                │                │               │◄──────────┤
```

### 4.3 Failure and Teardown Flow

```
Code_Process   HackingSession   CodeBridge   UIAdapter   Input_Gateway   Eventa
    (crash)       Service         Service      Layer                      Bus
      │               │              │            │             │           │
      X  Process      │              │            │             │           │
         dies         │              │            │             │           │
      │               │              │            │             │           │
      │  Detect crash │              │            │             │           │
      │  (PID change  │              │            │             │           │
      │   or SIGCHLD) │              │            │             │           │
      ├──────────────►│              │            │             │           │
      │               │              │            │             │           │
      │               │ Invalidate   │            │             │           │
      │               │ sessionId    │            │             │           │
      │               │              │            │             │           │
      │               │ TEARDOWN SEQUENCE:        │             │           │
      │               │                           │             │           │
      │               │ 1. Stop routing           │             │           │
      │               ├───────────────────────────────────────►│           │
      │               │                           │             │           │
      │               │ 2. Blank BrowserView      │             │           │
      │               ├───────────────────────────────────────►│           │
      │               │                           │ about:blank │           │
      │               │◄──────────────────────────────────────┤           │
      │               │                           │             │           │
      │               │ 3. Close WebSocket        │             │           │
      │               ├──────────────►│           │             │           │
      │               │                │ close()  │             │           │
      │               │                │ (1000ms) │             │           │
      │               │◄───────────────┤          │             │           │
      │               │                           │             │           │
      │               │ 4. SIGTERM process        │             │           │
      │   SIGTERM     │                           │             │           │
      ◄───────────────┤                           │             │           │
      │  (wait 3s)    │                           │             │           │
      │               │                           │             │           │
      │  (if needed)  │ 5. SIGKILL               │             │           │
      ◄───────────────┤                           │             │           │
      │               │                           │             │           │
      │               │ 6. Destroy BrowserView    │             │           │
      │               ├───────────────────────────────────────►│           │
      │               │                           │  detach +   │           │
      │               │                           │  destroy    │           │
      │               │◄──────────────────────────────────────┤           │
      │               │                           │             │           │
      │               │ 7. sessionId = null       │             │           │
      │               │                           │             │           │
      │               │ 8. Emit state change      │             │           │
      │               ├───────────────────────────────────────────────────►│
      │               │ {state: failed, error}    │             │           │
```

---


## 5. Module Boundaries

### 5.1 HackingSessionService

**Owns:**
- HackingSessionState: `{ sessionId, state, processInfo, lastError }`
- State machine logic
- Process lifecycle (spawn, monitor, kill)
- Activation/deactivation coordination

**Produces Events:**
- `electronHackingSessionStateChanged` (Eventa broadcast)

**Consumes Events:**
- `electronHackingSessionActivate` (Eventa invoke - from renderer)
- `electronHackingSessionDeactivate` (Eventa invoke - from renderer)
- Process exit signals (SIGCHLD)

**Dependencies:**
- `lifecycle` (injeca)
- `mainWindow` (injeca)
- `serverChannel` (injeca)
- CodeBridgeService (instantiated internally)
- UIAdapterLayer (instantiated internally)

**Forbidden Operations:**
- MUST NOT subscribe to renderer events other than activate/deactivate
- MUST NOT directly manipulate BrowserView (delegates to UIAdapterLayer)
- MUST NOT send messages via WebSocket (delegates to CodeBridgeService)

### 5.2 CodeBridgeService

**Owns:**
- WebSocket connection to Code_Backend
- Reconnection state and backoff timer
- Message validation logic

**Produces Events:**
- `electronCodeSummaryReceived` (Eventa broadcast - after sessionId validation)

**Consumes Events:**
- Summary messages from Code_Backend WebSocket
- Teardown commands from HackingSessionService

**Dependencies:**
- WebSocket client library (ws or native WebSocket)
- HTTP client (fetch or axios) for /config POST

**Forbidden Operations:**
- MUST NOT create new sessionId (only validates)
- MUST NOT trigger state transitions (reports errors to HackingSessionService)
- MUST NOT interact with BrowserView


### 5.3 UIAdapterLayer

**Owns:**
- BrowserView instance
- Resize calculation logic
- Load retry logic

**Produces Events:**
- Load success/failure (internal to HackingSessionService)

**Consumes Events:**
- Create/destroy commands from HackingSessionService
- Window resize events

**Dependencies:**
- Electron BrowserView API
- Main_Window reference

**Forbidden Operations:**
- MUST NOT store session state
- MUST NOT emit Eventa events
- MUST NOT communicate with Code_Backend
- MUST NOT trigger state transitions

### 5.4 Input_Gateway (Renderer)

**Owns:**
- Message routing logic
- In-memory message histories (AIRI vs Code)
- Pending input buffer

**Produces Events:**
- Messages to AIRI chat pipeline OR Code WebSocket (never both)

**Consumes Events:**
- `electronHackingSessionStateChanged` (subscribes to determine routing)
- User input from chat component

**Dependencies:**
- AIRI chat processing pipeline
- WebSocket connection to Code (when active)

**Forbidden Operations:**
- MUST NOT store session state
- MUST NOT trigger activation/deactivation
- MUST NOT directly manipulate UI visibility

### 5.5 TTS_Narrator (Renderer)

**Owns:**
- Throttle state (1 narration per 2000ms)
- Narration queue


**Produces Events:**
- TTS requests to AIRI voice pipeline

**Consumes Events:**
- `electronCodeSummaryReceived` (ONLY source of summaries)

**Dependencies:**
- AIRI TTS pipeline

**Forbidden Operations:**
- MUST NOT subscribe to any other summary sources
- MUST NOT validate or filter summary content (only sessionId)

---

## 6. Communication Contracts

### 6.1 HTTP Endpoints (Code_Backend)

#### GET /health
**Purpose:** Process readiness check  
**Request:** None  
**Response:** 
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```
**Status Codes:**
- 200: Process ready
- 500+: Process not ready

#### POST /config
**Purpose:** Sync provider configuration from AIRI  
**Headers:**
```
X-Session-ID: <UUID>
Content-Type: application/json
```
**Request Body:**
```json
{
  "provider": {
    "name": "anthropic",
    "apiKey": "sk-...",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "mode": "vibe",
  "sessionId": "<UUID>"
}
```
**Response:**
```json
{
  "success": true,
  "appliedConfig": {
    "provider": "anthropic",
    "mode": "vibe"
  }
}
```
**Status Codes:**
- 200: Config applied
- 400: SessionId mismatch
- 500: Application error


### 6.2 WebSocket Protocol (/bridge)

#### Connection
**URL:** `ws://localhost:3210/bridge`

#### Handshake (Client → Server)
```json
{
  "type": "auth",
  "sessionId": "<UUID>",
  "token": "<shared-secret>"
}
```

**Authentication Response:**
- Success: Connection stays open
- Failure: Close with code 4001 "Authentication failed"

#### Summary Message (Server → Client)
```json
{
  "type": "summary",
  "sessionId": "<UUID>",
  "text": "Task completed: Added user authentication endpoint",
  "metadata": {
    "mode": "vibe",
    "model": "claude-3-5-sonnet-20241022",
    "tokens": 1523
  }
}
```

#### Keepalive (Server → Client)
```json
{
  "type": "ping"
}
```
**Expected Response:** Client should respond with pong (or rely on TCP keepalive)

### 6.3 Eventa IPC Contracts

#### Invoke: electronHackingSessionActivate
**Direction:** Renderer → Main  
**Parameters:**
```typescript
{
  codeMode?: "spec" | "vibe" | "boss" | "ask" | "debug";
  providerConfig?: {
    name: string;
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}
```
**Returns:**
```typescript
{
  success: boolean;
  sessionId?: string;
  error?: string;
}
```


#### Invoke: electronHackingSessionDeactivate
**Direction:** Renderer → Main  
**Parameters:** None  
**Returns:**
```typescript
{
  success: boolean;
}
```

#### Broadcast: electronHackingSessionStateChanged
**Direction:** Main → Renderer  
**Payload:**
```typescript
{
  sessionId: string | null;
  state: "inactive" | "starting" | "active" | "failed";
  processInfo?: {
    pid: number;
    port: number;
  };
  lastError?: string;
}
```

#### Broadcast: electronCodeSummaryReceived
**Direction:** Main → Renderer  
**Payload:**
```typescript
{
  sessionId: string;
  text: string;
  metadata: {
    mode: string;
    model: string;
    tokens: number;
  };
}
```

---

## 7. Session Identity Model

### 7.1 Session Lifecycle

```
activate() called
    ↓
Generate sessionId (UUID v4)
    ↓
Include in:
  • WebSocket handshake
  • HTTP /config header
  • All log entries
  • Eventa events
    ↓
Process running, state = active
    ↓
Deactivate OR crash
    ↓
sessionId = null
```

### 7.2 Session Correlation

All components tag activity with sessionId:


| Component | How SessionId is Used |
|-----------|-----------------------|
| **HackingSessionService** | Generates, stores in state, nulls on teardown |
| **CodeBridgeService** | Sends in WS handshake, validates in incoming summaries |
| **Code_Backend** | Receives in handshake, includes in all summary messages |
| **TTS_Narrator** | Validates matches current before narrating |
| **Logs** | Included as structured field in all log entries |

### 7.3 Mismatch Handling

**Scenario:** WebSocket receives summary with sessionId that doesn't match current HackingSessionState.sessionId

**Action:**
1. Log warning: `"Received summary from stale session: expected ${current}, got ${received}"`
2. Discard message (do NOT emit Eventa event)
3. Continue operation (do not trigger teardown)

**Why:** Allows graceful handling of messages from previous sessions that arrive after reconnect

### 7.4 Invalidation Rules

**Session is invalidated immediately when:**
1. Code_Process exits (crash or clean shutdown)
2. Code_Process PID changes (detected restart)
3. User calls deactivate()
4. Fatal error during activation (timeout, auth failure)

**Session is NOT preserved across:**
- Process restarts
- Network reconnects
- Application restarts

**Retry generates NEW session:** Each activation attempt gets a fresh UUID, even if retrying after failure

---

## 8. Teardown Contract

### 8.1 Ordered Teardown Sequence

**Triggered by:** State transition from `active` to `failed` OR `inactive`

**8-Step Sequence:**

```
1. Stop Input_Gateway routing
   └─ Prevent new user messages from being processed
   └─ Timeout: immediate (synchronous flag set)

2. Blank BrowserView content
   └─ Load about:blank to halt JavaScript execution
   └─ Timeout: 500ms


3. Close WebSocket connection
   └─ Send close frame, wait for acknowledgment
   └─ Timeout: 1000ms (force close if not acknowledged)

4. Send SIGTERM to Code_Process
   └─ Graceful shutdown signal
   └─ Timeout: 3000ms

5. Send SIGKILL to Code_Process (if still alive)
   └─ Force termination
   └─ Timeout: immediate

6. Detach and destroy BrowserView
   └─ Remove from Main_Window, destroy instance
   └─ Timeout: 500ms

7. Set sessionId = null
   └─ Invalidate session in HackingSessionState
   └─ Timeout: immediate (synchronous)

8. Emit electronHackingSessionStateChanged
   └─ Broadcast new state to renderer
   └─ Timeout: immediate (synchronous)
```

### 8.2 Teardown Properties

**Idempotent:** Can be called multiple times safely (checks existence before each step)

**Best-effort:** If a step times out or fails, log warning and proceed to next step

**Sequential:** Each step completes before next begins (no parallel teardown)

**Guaranteed completion:** Teardown MUST run to step 8, even if earlier steps fail

### 8.3 Critical Ordering Rationale

**Why blank BrowserView BEFORE closing WebSocket?**
- Prevents JavaScript in BrowserView from processing WebSocket close events
- Eliminates ghost UI state where view appears active but backend is disconnected

**Why close WebSocket BEFORE killing process?**
- Allows graceful connection close
- Prevents orphaned WebSocket connections on Code_Backend

**Why SIGTERM before SIGKILL?**
- Gives Code_Backend chance to flush logs, close files, cleanup state
- Standard Unix process shutdown pattern

**Why destroy BrowserView AFTER process dies?**
- Ensures no race between UI trying to reconnect and process shutdown
- View is already blanked (step 2), so no user-visible impact

---

## 9. Failure Model

### 9.1 Failure Scenarios and Recovery

| Scenario | Detection | Recovery Action |
|----------|-----------|-----------------|
| **Port 3210 in use** | Process spawn fails with EADDRINUSE | Transition to failed, notify user "Port conflict", require manual resolution |
| **Process startup timeout** | http_ready not reached in 10s | Kill process, transition to failed, retry available |
| **WebSocket auth failure** | Code_Backend closes with 4001 | Transition to failed, check token configuration |
| **Process crash during active** | SIGCHLD or PID change detected | Execute teardown, transition to failed, notify user |
| **WebSocket disconnect** | Connection close event | Attempt reconnection with exponential backoff (max 5 attempts) |
| **Config sync failure** | POST /config returns 500 | Log error, continue with Code's stored settings |
| **BrowserView load timeout** | Load event not fired in 10s | Retry once, if fails again transition to failed |

### 9.2 Reconnection Strategy

**Trigger:** WebSocket connection closes unexpectedly while state = active

**Algorithm:**
```typescript
attempt = 0
baseDelay = 1000ms
maxDelay = 30000ms

while (attempt < 5 && state === "active") {
  delay = min(baseDelay * 2^attempt, maxDelay)
  wait(delay)
  
  try {
    connect()
    sendHandshake(currentSessionId)
    if (success) break
  } catch {
    attempt++
  }
}

if (attempt >= 5) {
  // Exceeded retry limit
  notifyHackingSessionService("reconnect_failed")
  // Service will transition to failed and execute teardown
}
```

**Key points:**
- Reconnection uses CURRENT sessionId (must match or fail)
- After 5 failed attempts, trigger full teardown
- Each attempt includes full handshake validation


### 9.3 Session Invalidation Matrix

| Event | SessionId Action | State Transition | BrowserView Action | WebSocket Action |
|-------|------------------|------------------|-------------------|------------------|
| User deactivate | Set to null | active → inactive | Destroy | Close |
| Process crash | Set to null | active → failed | Destroy | Close (if open) |
| Activation timeout | Set to null | starting → failed | N/A (not created) | Close (if open) |
| Auth failure | Set to null | starting → failed | N/A | Already closed |
| User retry | Generate NEW | failed → starting | Create new | Open new |

### 9.4 Error Notification Strategy

**User-facing notifications:**
- Shown when state transitions to `failed`
- Include human-readable error and troubleshooting steps
- Provide "Retry" button in Settings UI

**Developer-facing logs:**
- All errors logged to ~/.kiro/logs/hacking-session.log
- Include: timestamp, sessionId, state, PID, error, stack trace
- Log level: `error` for failures, `warn` for retries, `info` for transitions

---

## 10. Implementation Guidance

### 10.1 File Structure

```
apps/stage-tamagotchi/src/main/
├── services/
│   └── hackingSession/
│       ├── index.ts                    # Service registration
│       ├── HackingSessionService.ts    # Main orchestrator
│       ├── CodeBridgeService.ts        # WebSocket + config
│       ├── UIAdapterLayer.ts           # BrowserView management
│       └── types.ts                    # State types
│
apps/stage-tamagotchi/src/shared/
├── ipc/
│   └── hackingSession.ts               # Eventa contracts
│
apps/stage-tamagotchi/src/renderer/
├── composables/
│   ├── useHackingSession.ts            # State subscription
│   └── useInputGateway.ts              # Message routing
├── components/
│   └── hackingMode/
│       ├── HackingModeToggle.vue       # Settings UI
│       └── HackingModeIndicator.vue    # Active state badge
│
modules/code/apps/roo-code-standalone/src/backend/
├── routes/
│   ├── health.ts                       # GET /health
│   ├── config.ts                       # POST /config
│   └── bridge.ts                       # WebSocket /bridge
└── middleware/
    └── sessionValidation.ts            # Validate X-Session-ID header
```

### 10.2 Service Registration (injeca)

```typescript
// apps/stage-tamagotchi/src/main/index.ts

import { createHackingSessionService } from './services/hackingSession'

const container = createContainer({
  // ... existing services
  hackingSession: createHackingSessionService({
    lifecycle: deps.lifecycle,
    mainWindow: deps.mainWindow,
    serverChannel: deps.serverChannel
  })
})
```

### 10.3 Eventa Contract Definition

```typescript
// apps/stage-tamagotchi/src/shared/ipc/hackingSession.ts

import { defineEventaContract } from '@moeru/eventa'

export const hackingSessionContracts = {
  // Invoke events (renderer → main)
  activate: defineEventaContract({
    name: 'eventa:invoke:electron:hacking-session:activate',
    input: z.object({
      codeMode: z.enum(['spec', 'vibe', 'boss', 'ask', 'debug']).optional(),
      providerConfig: z.object({
        name: z.string(),
        apiKey: z.string(),
        model: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional()
      }).optional()
    }),
    output: z.object({
      success: z.boolean(),
      sessionId: z.string().optional(),
      error: z.string().optional()
    })
  }),

  deactivate: defineEventaContract({
    name: 'eventa:invoke:electron:hacking-session:deactivate',
    output: z.object({
      success: z.boolean()
    })
  }),

  // Broadcast events (main → renderer)
  stateChanged: defineEventaContract({
    name: 'eventa:broadcast:electron:hacking-session:state-changed',
    payload: z.object({
      sessionId: z.string().nullable(),
      state: z.enum(['inactive', 'starting', 'active', 'failed']),
      processInfo: z.object({
        pid: z.number(),
        port: z.number()
      }).optional(),
      lastError: z.string().optional()
    })
  }),

  summaryReceived: defineEventaContract({
    name: 'eventa:broadcast:electron:code-summary-received',
    payload: z.object({
      sessionId: z.string(),
      text: z.string(),
      metadata: z.object({
        mode: z.string(),
        model: z.string(),
        tokens: z.number()
      })
    })
  })
}
```

### 10.4 State Machine Implementation Pattern

```typescript
// HackingSessionService.ts (excerpt)

type State = 'inactive' | 'starting' | 'active' | 'failed'

interface HackingSessionState {
  sessionId: string | null
  state: State
  processInfo?: { pid: number; port: number }
  lastError?: string
}

class HackingSessionService {
  private state: HackingSessionState = {
    sessionId: null,
    state: 'inactive'
  }

  async activate(config: ActivationConfig): Promise<ActivationResult> {
    if (this.state.state !== 'inactive') {
      throw new Error(`Cannot activate from state: ${this.state.state}`)
    }

    // Generate new session
    const sessionId = randomUUID()
    this.transitionTo('starting', { sessionId })

    try {
      // Spawn process
      const process = await this.spawnCodeProcess()
      
      // Wait for readiness tiers
      await this.waitForHttpReady(process, 10000)
      await this.waitForBridgeReady(sessionId, 5000)
      
      // Create UI
      await this.uiAdapter.createBrowserView()
      
      this.transitionTo('active', { 
        processInfo: { pid: process.pid, port: 3210 }
      })
      
      return { success: true, sessionId }
    } catch (error) {
      await this.executeOrderedTeardown()
      this.transitionTo('failed', { 
        lastError: errorMessageFrom(error) ?? 'Unknown error'
      })
      return { success: false, error: this.state.lastError }
    }
  }

  private transitionTo(newState: State, updates: Partial<HackingSessionState>) {
    const oldState = this.state.state
    this.state = { ...this.state, state: newState, ...updates }
    
    this.logger.info('State transition', {
      from: oldState,
      to: newState,
      sessionId: this.state.sessionId
    })
    
    // Emit Eventa broadcast
    this.eventa.broadcast('hackingSessionStateChanged', this.state)
  }
}
```

### 10.5 Testing Strategy

**Unit Tests:**
```typescript
// HackingSessionService.test.ts

describe('HackingSessionService', () => {
  describe('State Machine', () => {
    it('should transition inactive → starting → active on successful activation', async () => {
      const service = createTestService()
      const states: State[] = []
      
      service.on('stateChange', (state) => states.push(state))
      
      await service.activate(mockConfig)
      
      expect(states).toEqual(['starting', 'active'])
    })

    it('should transition to failed and execute teardown on process crash', async () => {
      const service = createTestService()
      await service.activate(mockConfig)
      
      // Simulate crash
      mockProcess.emit('exit', 1)
      
      expect(service.getState().state).toBe('failed')
      expect(mockTeardown).toHaveBeenCalledTimes(1)
    })
  })

  describe('Session Identity', () => {
    it('should generate new sessionId on each activation', async () => {
      const service = createTestService()
      
      const result1 = await service.activate(mockConfig)
      await service.deactivate()
      const result2 = await service.activate(mockConfig)
      
      expect(result1.sessionId).not.toBe(result2.sessionId)
    })

    it('should invalidate sessionId on process restart', async () => {
      const service = createTestService()
      await service.activate(mockConfig)
      
      const originalSessionId = service.getState().sessionId
      
      // Simulate process restart (PID change)
      mockProcess.kill()
      mockProcess = spawnMockProcess()
      
      expect(service.getState().sessionId).toBeNull()
      expect(service.getState().state).toBe('failed')
    })
  })
})
```

**Integration Tests:**
```typescript
// hackingSession.integration.test.ts

describe('Hacking Session Integration', () => {
  it('should complete full activation flow', async () => {
    const { service, codeBackend } = await setupIntegrationTest()
    
    const result = await service.activate({
      codeMode: 'vibe',
      providerConfig: { name: 'anthropic', apiKey: 'test-key' }
    })
    
    expect(result.success).toBe(true)
    expect(codeBackend.isRunning()).toBe(true)
    expect(codeBackend.receivedConfig).toMatchObject({
      provider: { name: 'anthropic' },
      mode: 'vibe'
    })
  })

  it('should handle summary flow end-to-end', async () => {
    const { service, codeBackend, ttsNarrator } = await setupIntegrationTest()
    await service.activate(mockConfig)
    
    const summaryPromise = new Promise((resolve) => {
      ttsNarrator.once('narrate', resolve)
    })
    
    // Code backend emits summary
    codeBackend.emitSummary({
      text: 'Task completed',
      metadata: { mode: 'vibe', model: 'claude', tokens: 100 }
    })
    
    const narrated = await summaryPromise
    expect(narrated.text).toBe('Task completed')
  })
})
```

---


## 11. Code Module Integration Points

### 11.1 Required Backend Modifications

The Code module backend (`modules/code/apps/roo-code-standalone/src/backend/`) requires three new endpoints:

#### 11.1.1 Health Endpoint

**File:** `routes/health.ts`

```typescript
import { FastifyPluginAsync } from 'fastify'

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', version: '1.0.0' }
  })
}
```

**Purpose:** Allow HackingSessionService to verify backend is ready

**Called:** During `starting` state, after process spawn

#### 11.1.2 Config Endpoint

**File:** `routes/config.ts`

```typescript
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const configSchema = z.object({
  provider: z.object({
    name: z.string(),
    apiKey: z.string(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional()
  }),
  mode: z.enum(['spec', 'vibe', 'boss', 'ask', 'debug']),
  sessionId: z.string()
})

export const configRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/config', async (request, reply) => {
    const sessionIdHeader = request.headers['x-session-id']
    const body = configSchema.parse(request.body)
    
    if (sessionIdHeader !== body.sessionId) {
      return reply.code(400).send({ 
        error: 'Session ID mismatch' 
      })
    }
    
    // Apply config to Code module runtime
    await applyProviderConfig(body.provider)
    await applyModeSelection(body.mode)
    
    return {
      success: true,
      appliedConfig: {
        provider: body.provider.name,
        mode: body.mode
      }
    }
  })
}
```

**Purpose:** Sync AIRI provider settings to Code module

**Called:** After WebSocket bridge_ready, before transition to active


#### 11.1.3 Bridge WebSocket Endpoint

**File:** `routes/bridge.ts`

```typescript
import { FastifyPluginAsync } from 'fastify'
import { WebSocket } from 'ws'

const BRIDGE_TOKEN = process.env.CODE_BRIDGE_TOKEN || 'animaios-hacking-bridge'

interface BridgeClient {
  sessionId: string
  ws: WebSocket
}

const clients = new Map<string, BridgeClient>()

export const bridgeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/bridge', { websocket: true }, (connection, request) => {
    const ws = connection.socket
    let authenticated = false
    let sessionId: string | null = null

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())

        if (!authenticated) {
          // Handle auth handshake
          if (message.type === 'auth') {
            if (message.token !== BRIDGE_TOKEN) {
              ws.close(4001, 'Authentication failed')
              return
            }
            sessionId = message.sessionId
            authenticated = true
            clients.set(sessionId, { sessionId, ws })
            return
          }
          ws.close(4000, 'Not authenticated')
          return
        }

        // Handle other message types if needed
      } catch (error) {
        ws.close(4002, 'Invalid message format')
      }
    })

    ws.on('close', () => {
      if (sessionId) {
        clients.delete(sessionId)
      }
    })
  })
}

// Called by Code module when task completes
export function emitSummary(summary: {
  text: string
  metadata: { mode: string; model: string; tokens: number }
}) {
  const message = JSON.stringify({
    type: 'summary',
    sessionId: getCurrentSessionId(), // From current Code execution context
    text: summary.text,
    metadata: summary.metadata
  })

  // Broadcast to all authenticated clients
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message)
    }
  }
}
```

**Purpose:** Stream task summaries from Code to AIRI

**Called:** When Code module completes tasks and generates summaries


### 11.2 Code Module Execution Hooks

To emit summaries, Code module needs hooks at task completion points:

```typescript
// Pseudocode showing where to integrate

async function executeTask(task: Task) {
  const result = await runLLMExecution(task)
  
  // Generate summary
  const summary = generateTaskSummary(result)
  
  // Emit via bridge (if connected)
  emitSummary({
    text: summary.text,
    metadata: {
      mode: currentMode,
      model: currentModel,
      tokens: result.usage.totalTokens
    }
  })
  
  return result
}
```

### 11.3 Backward Compatibility

All three endpoints are **opt-in**:
- Code module works standalone without them
- Endpoints only used when embedded in AIRI
- No AIRI-specific dependencies in Code module code

---

## 12. Security Considerations

### 12.1 BrowserView Isolation

**Threat:** Malicious code in Code_Module UI could escape sandbox

**Mitigation:**
- `nodeIntegration: false` prevents Node.js access
- `contextIsolation: true` isolates renderer context
- `sandbox: true` enables OS-level sandboxing
- No preload scripts exposing Electron APIs
- Separate session partition prevents cookie/storage leakage

### 12.2 WebSocket Authentication

**Threat:** Unauthorized clients connecting to /bridge

**Mitigation:**
- Shared secret token (environment variable)
- Token validated on handshake
- Invalid auth → close with 4001
- SessionId included in all messages for correlation

### 12.3 Process Isolation

**Threat:** Code_Process compromise affecting AIRI

**Mitigation:**
- Code runs as separate process (not thread)
- Communicates only via HTTP/WebSocket (no shared memory)
- Process killed on any suspicious behavior
- No filesystem access to AIRI config/data directories


### 12.4 SessionId as Capability Token

**Threat:** Replay attacks using old sessionIds

**Mitigation:**
- SessionId is ephemeral (dies with process)
- Mismatch messages discarded with logging
- New sessionId on every activation
- No session persistence across restarts

---

## 13. Performance Considerations

### 13.1 Startup Latency

**Expected timeline:**
- Process spawn: 200-500ms
- HTTP ready: 2-5s (depends on Node.js + Fastify cold start)
- WebSocket handshake: 100-200ms
- BrowserView creation: 500ms-1s
- **Total: 3-7s from activate() to active state**

**Optimization opportunities:**
- Pre-warm Code process on AIRI startup (keep in background)
- Use faster process spawn (consider worker_threads if feasible)
- Lazy-load Code UI assets

### 13.2 Memory Footprint

**Components:**
- Code_Process (Fastify + React SPA): ~150-300MB
- BrowserView (Chromium renderer): ~100-200MB
- HackingSessionService overhead: ~5-10MB
- **Total additional: ~255-510MB when active**

### 13.3 WebSocket Message Throughput

**Typical load:**
- Summaries: 1-10 per minute
- Keepalive pings: 1 per 30s
- **Peak: ~1 message/3s**

**Throttling:**
- Summary emission limited to 1/second by Code_Backend
- TTS narration throttled to 1/2s by TTS_Narrator
- Prevents audio overlap and message storms

---

## 14. Observability

### 14.1 Metrics to Expose

```typescript
interface HackingSessionMetrics {
  // State tracking
  currentState: State
  currentSessionId: string | null
  uptimeMs: number
  
  // Activation metrics
  totalActivations: number
  successfulActivations: number
  failedActivations: number
  averageActivationTimeMs: number
  
  // Summary metrics
  summariesReceived: number
  summariesNarrated: number
  summariesDiscarded: number // sessionId mismatch
  
  // Process metrics
  processRestarts: number
  processKills: number
  
  // WebSocket metrics
  wsReconnects: number
  wsConnectionDurationMs: number
}
```


### 14.2 Structured Logging Format

```json
{
  "timestamp": "2026-06-17T19:45:23.123Z",
  "level": "info",
  "namespace": "hacking-session",
  "message": "State transition",
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "from": "starting",
  "to": "active",
  "metadata": {
    "pid": 12345,
    "port": 3210,
    "activationTimeMs": 4523
  }
}
```

### 14.3 Debug Mode

**Enable:** `HACKING_SESSION_DEBUG=1`

**Additional logging:**
- WebSocket message payloads
- BrowserView load events
- Process stdout/stderr
- Readiness tier progression
- Teardown step timing

---

## 15. Future Enhancements

### 15.1 Multi-Session Support (Not in Scope)

Current design: one session at a time  
Future: multiple Code processes with different modes/providers

**Changes required:**
- sessionId → sessionId array
- State machine per session
- UI tabs for session switching

### 15.2 Session Persistence (Not in Scope)

Current: ephemeral sessions  
Future: restore session after AIRI restart

**Changes required:**
- SQLite storage for session state
- Process resurrection logic
- History replay on restore

### 15.3 Hot Reload (Not in Scope)

Current: full restart on config change  
Future: update config without tearing down session

**Changes required:**
- Dynamic config application in Code_Backend
- Reload trigger via WebSocket message
- Minimal disruption UX

---

## 16. Appendix: Architecture Invariants

These invariants MUST be maintained across all implementations:

1. **Single Authority Rule**: Only HackingSessionService can activate, deactivate, or mark failed
2. **One Live Session Rule**: At most one Code_Process per sessionId at any time
3. **One Event Path Rule**: Code → WS → CodeBridge → Eventa → TTS (no alternate paths)
4. **UI Stateless Rule**: BrowserView cannot store state, define logic, or trigger transitions
5. **Failure Collapse Rule**: Any failure triggers full teardown (8-step sequence)
6. **Session Ephemeral Rule**: sessionId generated per activation, never persisted, invalidated on crash
7. **Ordered Teardown Rule**: Steps 1-8 execute sequentially, no skipping, best-effort completion
8. **Readiness Progression Rule**: Must progress through process_started → http_ready → bridge_ready
9. **SessionId Correlation Rule**: All components tag activity with sessionId for tracing
10. **Mismatch Discard Rule**: Messages with mismatched sessionId logged and discarded, never processed

---

## 17. Glossary

| Term | Definition |
|------|------------|
| **Activation** | Process of transitioning from inactive to active state |
| **Bridge** | WebSocket endpoint (/bridge) for summary streaming |
| **Code_Backend** | Fastify server running on port 3210 |
| **Code_Process** | Child process executing Code_Backend |
| **Deactivation** | Process of transitioning from active to inactive state |
| **Ephemeral Session** | Session that exists only during process lifetime, not persisted |
| **Failed State** | Terminal error state requiring user retry |
| **Hacking Mode** | User-facing name for the embedded Code experience |
| **Readiness Tier** | One of three progressive readiness checks (process, HTTP, bridge) |
| **SessionId** | UUID v4 identifying one activation-to-teardown lifecycle |
| **Starting State** | Transient state during activation, progressing through readiness tiers |
| **Teardown** | 8-step ordered cleanup sequence |
| **Three-Tier Readiness** | process_started → http_ready → bridge_ready progression |

---

## 18. References

### 18.1 External Dependencies

- **Electron BrowserView API**: https://www.electronjs.org/docs/latest/api/browser-view
- **Eventa (IPC framework)**: `@moeru/eventa` package
- **injeca (DI framework)**: Used for service registration
- **Fastify**: Code_Backend web framework
- **WebSocket (ws)**: WebSocket library

### 18.2 Related Documentation

- `requirements.md`: Detailed acceptance criteria for each component
- `/home/vi/animaios2/AGENTS.md`: AIRI development guidelines
- `/home/vi/animaios2/modules/code/README.md`: Code module architecture

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-17  
**Status:** Ready for Implementation
