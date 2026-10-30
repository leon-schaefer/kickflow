declare module 'libcurl.js' {
  interface HTTPSession {
    /** libcurl.js 0.7.5 cleanup workaround; see tunnelWasm.ts and browser regression test. */
    event_loop: number | null;
    fetch(url: string, options: RequestInit): Promise<Response>;
    close(): void;
  }
  export const libcurl: {
    load_wasm(url: string): Promise<void>;
    set_websocket(url: string): void;
    transport: 'wsproxy' | 'wisp';
    stdout: (text: string) => void;
    stderr: (text: string) => void;
    logger: (type: string, text: string) => void;
    HTTPSession: new (options: { enable_cookies: boolean }) => HTTPSession;
  };
}
