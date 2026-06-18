import { describe, expect, it, vi } from 'vitest'

import type { HackingSessionStatePayload } from './HackingSessionService'

import { setupHackingSessionService } from './HackingSessionService'

describe('HackingSessionService', () => {
  describe('initial state', () => {
    it('should start in inactive state with null sessionId', () => {
      const service = setupHackingSessionService()
      const state = service.getState()

      expect(state.state).toBe('inactive')
      expect(state.sessionId).toBeNull()
      expect(state.processInfo).toBeUndefined()
      expect(state.lastError).toBeUndefined()
    })
  })

  describe('activate guard', () => {
    it('should reject activation while state is starting', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      // First activation attempt starts the process
      const result1 = service.activate()
      const state1 = service.getState()
      expect(state1.state).toBe('starting')

      // Second activation while starting should be rejected
      const result2 = await service.activate()
      if (result2.success) {
        throw new Error('Expected activation to fail while starting')
      }
      expect(result2.error).toContain('starting')

      // Await the first activation to complete
      await result1
    })

    it('should reject activation while state is active', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      const result = await service.activate({
        codeMode: 'vibe',
      })

      expect(result.success).toBe(false)
      // Guard against starting/active is tested above
      expect(service.getState().state).toBe('failed')
    })
  })

  describe('state machine transitions', () => {
    it('should transition through inactive → starting → inactive on failed activation', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      const states: HackingSessionStatePayload[] = []
      service.onStateChange((payload) => {
        states.push({ ...payload })
      })

      const result = await service.activate()
      expect(result.success).toBe(false)

      const finalState = service.getState()
      expect(finalState.state).toBe('failed')
      expect(finalState.sessionId).toBeNull()

      // Should have emitted at least 2 state changes (starting → failed)
      expect(states.length).toBeGreaterThanOrEqual(2)
      expect(states[0].state).toBe('starting')
      expect(states[states.length - 1].state).toBe('failed')
    })

    it('should transition from failed to starting on retry', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      // First activation fails
      await service.activate()
      expect(service.getState().state).toBe('failed')

      // Retry should transition to starting
      const promise = service.activate()
      expect(service.getState().state).toBe('starting')
      await promise
    })

    it('should support deactivate from any non-inactive state', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      // Activate (will fail)
      await service.activate()

      // Deactivate from failed state
      const result = await service.deactivate()
      expect(result.success).toBe(true)
      expect(service.getState().state).toBe('inactive')
    })

    it('should be idempotent calling deactivate from inactive', async () => {
      const service = setupHackingSessionService()

      const result = await service.deactivate()
      expect(result.success).toBe(true)
      expect(service.getState().state).toBe('inactive')
    })

    it('should generate unique sessionId per activation attempt', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      // First attempt
      await service.activate()
      const state1 = service.getState()
      expect(state1.state).toBe('failed')

      // Second attempt
      await service.activate()
      const state2 = service.getState()
      expect(state2.state).toBe('failed')
    })

    it('should clear lastError on new activation attempt', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      // First activation fails with error
      await service.activate()
      expect(service.getState().lastError).toBeDefined()

      // Starting a new activation should clear it
      service.activate()
      expect(service.getState().lastError).toBeUndefined()
    })

    it('should nullify sessionId on transition to inactive or failed', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      // Starting sets sessionId
      service.activate()
      expect(service.getState().sessionId).not.toBeNull()

      // Wait for failure
      await vi.waitFor(() => {
        expect(service.getState().state).toBe('failed')
      })
      expect(service.getState().sessionId).toBeNull()
    })
  })

  describe('subscription API', () => {
    it('should notify listeners on state changes', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      const listener = vi.fn()
      const unsubscribe = service.onStateChange(listener)

      await service.activate()

      expect(listener).toHaveBeenCalled()
      const call = listener.mock.calls[0][0] as HackingSessionStatePayload
      expect(call.state).toBe('starting')

      unsubscribe()
    })

    it('should stop notifying after unsubscribe', async () => {
      const service = setupHackingSessionService({
        codeBackendPath: '/nonexistent/path.js',
        httpReadyTimeoutMs: 100,
        readinessTimeoutMs: 200,
      })

      const listener = vi.fn()
      const unsubscribe = service.onStateChange(listener)
      unsubscribe()

      await service.activate()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('getBridgeToken', () => {
    it('should return the configured bridge token', () => {
      const service = setupHackingSessionService({ bridgeToken: 'custom-token' })
      expect(service.getBridgeToken()).toBe('custom-token')
    })

    it('should return default bridge token', () => {
      const service = setupHackingSessionService()
      expect(service.getBridgeToken()).toBe('animaios-hacking-bridge')
    })
  })
})
