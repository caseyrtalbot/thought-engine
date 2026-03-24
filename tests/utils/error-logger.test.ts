import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logError, notifyError, setErrorNotifier } from '../../src/renderer/src/utils/error-logger'

describe('error-logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setErrorNotifier(() => {})
  })

  describe('logError', () => {
    it('logs Error instances with context prefix', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      logError('test-context', new Error('boom'))
      expect(spy).toHaveBeenCalledWith('[test-context]', 'boom')
    })

    it('logs non-Error values as strings', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      logError('ctx', 'string-error')
      expect(spy).toHaveBeenCalledWith('[ctx]', 'string-error')
    })

    it('handles null/undefined errors', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      logError('ctx', null)
      expect(spy).toHaveBeenCalledWith('[ctx]', null)
    })
  })

  describe('notifyError', () => {
    it('logs and calls the registered notifier', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const notifier = vi.fn()
      setErrorNotifier(notifier)

      notifyError('save-ctx', new Error('disk full'))

      expect(spy).toHaveBeenCalledWith('[save-ctx]', 'disk full')
      expect(notifier).toHaveBeenCalledWith('save-ctx: disk full')
    })

    it('uses custom user message when provided', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const notifier = vi.fn()
      setErrorNotifier(notifier)

      notifyError('save-ctx', new Error('ENOSPC'), 'Failed to save workspace')

      expect(notifier).toHaveBeenCalledWith('Failed to save workspace')
    })

    it('works without a registered notifier (no-op default)', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      // Should not throw even with no notifier registered
      expect(() => notifyError('ctx', new Error('test'))).not.toThrow()
    })
  })

  describe('setErrorNotifier', () => {
    it('replaces the previous notifier', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const first = vi.fn()
      const second = vi.fn()

      setErrorNotifier(first)
      notifyError('ctx', new Error('a'))
      expect(first).toHaveBeenCalledTimes(1)

      setErrorNotifier(second)
      notifyError('ctx', new Error('b'))
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
    })
  })
})
