import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentManager } from '../document-manager'

function flushAsyncWork(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve())
}

describe('DocumentManager autosave failures', () => {
  const path = '/vault/note.md'
  const initialMtime = '2026-03-30T00:00:00.000Z'

  const createFs = () => ({
    readFile: vi.fn().mockResolvedValue('# Note'),
    getFileMtime: vi.fn().mockResolvedValue(initialMtime),
    writeFile: vi.fn()
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the document dirty when autosave fails instead of losing the failure in the timer', async () => {
    const fs = createFs()
    fs.writeFile.mockRejectedValueOnce(new Error('disk full'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const manager = new DocumentManager(fs as never)

    await manager.open(path)
    manager.update(path, '# Changed')

    await vi.advanceTimersByTimeAsync(1000)
    await flushAsyncWork()

    expect(fs.writeFile).toHaveBeenCalledWith(path, '# Changed')
    expect(manager.getContent(path)?.dirty).toBe(true)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('can recover with a later save after an autosave failure', async () => {
    const fs = createFs()
    fs.writeFile.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined)
    const manager = new DocumentManager(fs as never)

    await manager.open(path)
    manager.update(path, '# Changed')

    await vi.advanceTimersByTimeAsync(1000)
    await flushAsyncWork()

    await manager.save(path)

    expect(fs.writeFile).toHaveBeenCalledTimes(2)
    expect(manager.getContent(path)?.dirty).toBe(false)
  })
})
