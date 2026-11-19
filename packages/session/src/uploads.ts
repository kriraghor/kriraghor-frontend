/**
 * Upload progress for every file the apps send (tester feedback, 19 Nov 2026). The API client sends a
 * request whose body is a file (an image, a PDF, a spreadsheet) through XMLHttpRequest, which reports
 * upload progress, instead of fetch, which does not. Each upload is a row in a small store the upload
 * tray shows: what it is, the bytes sent of the total, and Cancel.
 */
export type UploadKind = "photo" | "document" | "file";
export type Upload = { id: number; kind: UploadKind; loaded: number; total: number; status: "uploading" | "done" | "failed" | "cancelled"; cancel: () => void };

type Listener = () => void;
let uploads: Upload[] = [];
const listeners = new Set<Listener>();
let seq = 0;

const emit = () => listeners.forEach((l) => l());
const set = (next: Upload[]) => {
  uploads = next;
  emit();
};
const patch = (id: number, change: Partial<Upload>) => set(uploads.map((u) => (u.id === id ? { ...u, ...change } : u)));

export const uploadStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => uploads,
  dismiss: (id: number) => set(uploads.filter((u) => u.id !== id)),
};

/** File bodies go through the progress path; JSON and form bodies stay on fetch. */
const FILE_TYPES = /^(image\/|video\/|audio\/|text\/csv|application\/(pdf|octet-stream|zip|vnd\.))/i;
export const isFileUpload = (method: string, contentType: string | null) => method !== "GET" && method !== "HEAD" && FILE_TYPES.test(contentType ?? "");

export const kindOf = (contentType: string): UploadKind => (/^image\//i.test(contentType) ? "photo" : /pdf|vnd\.|csv/i.test(contentType) ? "document" : "file");

/** "status: value" lines of XHR response headers → Headers. */
export function parseHeaders(raw: string): Headers {
  const h = new Headers();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const i = line.indexOf(":");
    if (i > 0) h.append(line.slice(0, i).trim(), line.slice(i + 1).trim());
  }
  return h;
}

/** Bytes as people read them: 820 KB, 3.4 MB. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const NO_BODY = new Set([101, 204, 205, 304]);
const DONE_LINGER_MS = 2500;

/**
 * A fetch for the API client: a file body is sent with XMLHttpRequest and tracked in the store; any
 * other request goes to `fetchImpl` unchanged.
 */
export function createUploadFetch(fetchImpl: typeof fetch = fetch) {
  return async function uploadFetch(input: Request): Promise<Response> {
    const type = input.headers.get("content-type");
    if (typeof XMLHttpRequest === "undefined" || !isFileUpload(input.method, type)) return fetchImpl(input);
    const body = await input.blob();
    const id = (seq += 1);
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(input.method, input.url);
      input.headers.forEach((value, key) => xhr.setRequestHeader(key, value));
      xhr.withCredentials = input.credentials === "include";
      xhr.responseType = "blob";
      set([...uploads, { id, kind: kindOf(type ?? ""), loaded: 0, total: body.size, status: "uploading", cancel: () => xhr.abort() }]);
      xhr.upload.onprogress = (e) => patch(id, { loaded: e.loaded, total: e.lengthComputable ? e.total : body.size });
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        patch(id, { status: ok ? "done" : "failed", loaded: ok ? body.size : uploads.find((u) => u.id === id)?.loaded ?? 0 });
        if (ok) setTimeout(() => uploadStore.dismiss(id), DONE_LINGER_MS);
        resolve(new Response(NO_BODY.has(xhr.status) ? null : xhr.response, { status: xhr.status, statusText: xhr.statusText, headers: parseHeaders(xhr.getAllResponseHeaders()) }));
      };
      xhr.onerror = () => {
        patch(id, { status: "failed" });
        reject(new TypeError("Network request failed"));
      };
      xhr.onabort = () => {
        patch(id, { status: "cancelled" });
        setTimeout(() => uploadStore.dismiss(id), DONE_LINGER_MS);
        reject(new DOMException("The upload was cancelled", "AbortError"));
      };
      xhr.send(body);
    });
  };
}
