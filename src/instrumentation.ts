// Polyfill localStorage for server-side rendering
// This fixes the "localStorage.getItem is not a function" error
// that occurs when the @ai-sdk/react package tries to access localStorage on the server

export async function register() {
  if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage?.getItem !== 'function') {
    const storage = new Map<string, string>();

    // @ts-ignore
    globalThis.localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() { return storage.size; },
    };
  }
}
