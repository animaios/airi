import { describe, expect, it } from 'vitest'
import type { ActivationConfig, HackingSessionState, SummaryMessage } from './hacking-session'

describe('HackingSessionState interface', () => {
  it('should allow inactive state with null sessionId', () => {
    const state: HackingSessionState = {
      sessionId: null,
      state: 'inactive',
    }

    expect(state.sessionId).toBeNull()
    expect(state.state).toBe('inactive')
    expect(state.processInfo).toBeUndefined()
    expect(state.lastError).toBeUndefined()
  })

  it('should allow starting state with sessionId and processInfo', () => {
    const state: HackingSessionState = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      state: 'starting',
      processInfo: {
        pid: 12345,
        port: 3210,
      },
    }

    expect(state.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(state.state).toBe('starting')
    expect(state.processInfo).toEqual({ pid: 12345, port: 3210 })
    expect(state.lastError).toBeUndefined()
  })

  it('should allow active state with sessionId and processInfo', () => {
    const state: HackingSessionState = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      state: 'active',
      processInfo: {
        pid: 12345,
        port: 3210,
      },
    }

    expect(state.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(state.state).toBe('active')
    expect(state.processInfo).toEqual({ pid: 12345, port: 3210 })
  })

  it('should allow failed state with null sessionId and lastError', () => {
    const state: HackingSessionState = {
      sessionId: null,
      state: 'failed',
      lastError: 'Port 3210 is already in use',
    }

    expect(state.sessionId).toBeNull()
    expect(state.state).toBe('failed')
    expect(state.lastError).toBe('Port 3210 is already in use')
    expect(state.processInfo).toBeUndefined()
  })

  it('should support all four FSM states', () => {
    const states: Array<HackingSessionState['state']> = ['inactive', 'starting', 'active', 'failed']

    states.forEach((stateValue) => {
      const state: HackingSessionState = {
        sessionId: stateValue === 'inactive' || stateValue === 'failed' ? null : 'test-id',
        state: stateValue,
      }

      expect(['inactive', 'starting', 'active', 'failed']).toContain(state.state)
    })
  })
})

describe('ActivationConfig interface', () => {
  it('should allow empty config (all fields optional)', () => {
    const config: ActivationConfig = {}

    expect(config.codeMode).toBeUndefined()
    expect(config.providerConfig).toBeUndefined()
  })

  it('should allow config with only codeMode', () => {
    const config: ActivationConfig = {
      codeMode: 'vibe',
    }

    expect(config.codeMode).toBe('vibe')
    expect(config.providerConfig).toBeUndefined()
  })

  it('should allow config with providerConfig', () => {
    const config: ActivationConfig = {
      providerConfig: {
        name: 'anthropic',
        apiKey: 'sk-ant-test123',
      },
    }

    expect(config.providerConfig?.name).toBe('anthropic')
    expect(config.providerConfig?.apiKey).toBe('sk-ant-test123')
  })

  it('should allow full config with all fields', () => {
    const config: ActivationConfig = {
      codeMode: 'spec',
      providerConfig: {
        name: 'anthropic',
        apiKey: 'sk-ant-test123',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096,
      },
    }

    expect(config.codeMode).toBe('spec')
    expect(config.providerConfig?.name).toBe('anthropic')
    expect(config.providerConfig?.model).toBe('claude-3-5-sonnet-20241022')
    expect(config.providerConfig?.temperature).toBe(0.7)
    expect(config.providerConfig?.maxTokens).toBe(4096)
  })

  it('should support all five code modes', () => {
    const modes: Array<ActivationConfig['codeMode']> = ['spec', 'vibe', 'boss', 'ask', 'debug']

    modes.forEach((mode) => {
      const config: ActivationConfig = { codeMode: mode }
      expect(['spec', 'vibe', 'boss', 'ask', 'debug']).toContain(config.codeMode)
    })
  })
})

describe('SummaryMessage interface', () => {
  it('should require all fields', () => {
    const summary: SummaryMessage = {
      type: 'summary',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      text: 'Refactored authentication module',
      metadata: {
        mode: 'vibe',
        model: 'claude-3-5-sonnet-20241022',
        tokens: 2847,
      },
    }

    expect(summary.type).toBe('summary')
    expect(summary.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(summary.text).toBe('Refactored authentication module')
    expect(summary.metadata.mode).toBe('vibe')
    expect(summary.metadata.model).toBe('claude-3-5-sonnet-20241022')
    expect(summary.metadata.tokens).toBe(2847)
  })

  it('should have type discriminator as literal "summary"', () => {
    const summary: SummaryMessage = {
      type: 'summary',
      sessionId: 'test-session',
      text: 'Test summary',
      metadata: {
        mode: 'vibe',
        model: 'test-model',
        tokens: 100,
      },
    }

    // Type should be exactly "summary"
    const typeCheck: 'summary' = summary.type
    expect(typeCheck).toBe('summary')
  })

  it('should contain all required metadata fields', () => {
    const summary: SummaryMessage = {
      type: 'summary',
      sessionId: 'test-session',
      text: 'Test',
      metadata: {
        mode: 'spec',
        model: 'gpt-4',
        tokens: 500,
      },
    }

    expect(summary.metadata).toHaveProperty('mode')
    expect(summary.metadata).toHaveProperty('model')
    expect(summary.metadata).toHaveProperty('tokens')
    expect(typeof summary.metadata.mode).toBe('string')
    expect(typeof summary.metadata.model).toBe('string')
    expect(typeof summary.metadata.tokens).toBe('number')
  })
})

describe('Interface integration', () => {
  it('should correlate sessionId between HackingSessionState and SummaryMessage', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'

    const state: HackingSessionState = {
      sessionId,
      state: 'active',
      processInfo: { pid: 12345, port: 3210 },
    }

    const summary: SummaryMessage = {
      type: 'summary',
      sessionId,
      text: 'Task completed',
      metadata: { mode: 'vibe', model: 'test', tokens: 100 },
    }

    // SessionIds should match for correlation
    expect(state.sessionId).toBe(summary.sessionId)
  })

  it('should represent a complete activation flow', () => {
    // 1. Start with inactive state
    const inactiveState: HackingSessionState = {
      sessionId: null,
      state: 'inactive',
    }
    expect(inactiveState.state).toBe('inactive')

    // 2. Prepare activation config
    const config: ActivationConfig = {
      codeMode: 'vibe',
      providerConfig: {
        name: 'anthropic',
        apiKey: 'sk-ant-test',
        model: 'claude-3-5-sonnet-20241022',
      },
    }
    expect(config.codeMode).toBe('vibe')

    // 3. Transition to starting state
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const startingState: HackingSessionState = {
      sessionId,
      state: 'starting',
      processInfo: { pid: 12345, port: 3210 },
    }
    expect(startingState.state).toBe('starting')
    expect(startingState.sessionId).not.toBeNull()

    // 4. Transition to active state
    const activeState: HackingSessionState = {
      sessionId,
      state: 'active',
      processInfo: { pid: 12345, port: 3210 },
    }
    expect(activeState.state).toBe('active')

    // 5. Receive summary
    const summary: SummaryMessage = {
      type: 'summary',
      sessionId,
      text: 'Completed refactoring',
      metadata: {
        mode: config.codeMode!,
        model: config.providerConfig!.model!,
        tokens: 2847,
      },
    }
    expect(summary.sessionId).toBe(activeState.sessionId)
  })
})
