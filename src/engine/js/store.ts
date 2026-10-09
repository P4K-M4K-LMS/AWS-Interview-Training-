/**
 * The server drills' simulated datastore: an async key-value store where
 * every call takes a few milliseconds on the run's tracked timers, so
 * concurrent requests interleave at their awaits exactly as they would
 * against a real database. Values are copied in and out.
 */
export const STORE_LATENCY_MS = 10;

export function createStore(setTimer: (fn: () => void, ms: number) => unknown) {
  const data = new Map<string, unknown>();
  const wait = () => new Promise<void>((resolve) => setTimer(resolve, STORE_LATENCY_MS));
  const copy = <T>(v: T): T => (v === undefined ? v : structuredClone(v));
  return {
    async get(key: string) {
      await wait();
      return copy(data.get(String(key)));
    },
    async set(key: string, value: unknown) {
      await wait();
      data.set(String(key), copy(value));
    },
    async delete(key: string) {
      await wait();
      return data.delete(String(key));
    },
    async keys() {
      await wait();
      return [...data.keys()];
    },
  };
}
