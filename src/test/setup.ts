class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverMock

// Node 26 exposes a global localStorage accessor that is unavailable unless
// started with --localstorage-file. Keep Vitest on in-memory storage instead.
class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value))
  }
}

const testStorage = new MemoryStorage()

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: testStorage,
  writable: true,
})

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: testStorage,
  writable: true,
})
