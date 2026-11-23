// Deterministic browser coordination primitives for jsdom. Playwright uses the real APIs.
export class TestBroadcastChannel {
  static channels = new Set<TestBroadcastChannel>()
  name: string
  onmessage?: (event: { data: unknown }) => void
  constructor(name: string) {
    this.name = name
    TestBroadcastChannel.channels.add(this)
  }
  postMessage(data: unknown) {
    for (const peer of TestBroadcastChannel.channels) {
      if (peer !== this && peer.name === this.name)
        queueMicrotask(() => peer.onmessage?.({ data }))
    }
  }
  close() {
    TestBroadcastChannel.channels.delete(this)
  }
}
let queue: Promise<unknown> = Promise.resolve()
export const testLocks = {
  request: <T>(_: string, work: () => Promise<T>) => {
    const result = queue.then(work)
    queue = result.catch(() => undefined)
    return result
  },
}
