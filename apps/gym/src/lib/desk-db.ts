import type { WaitingItem } from "./desk-offline";

/**
 * M24 §22: items the desk took without a connection wait here until they are sent (IndexedDB `kg-desk`,
 * store `items`, keyed by client id). They survive a reload and signing out, and are never deleted by
 * themselves: only a successful send, or a person removing one the server refused, takes one out (FR-146).
 * When IndexedDB is not available (a private window that blocks it) they are kept in memory and the screens
 * say so. Changes notify subscribers, so every open screen shows the same count.
 */
const DB = "kg-desk";
const STORE = "items";
let memory: Map<string, WaitingItem> | null = null;
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

/** Subscribe to changes (useSyncExternalStore). */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
export const changeVersion = () => version;

function open(): Promise<IDBDatabase | null> {
  if (memory || typeof indexedDB === "undefined") {
    memory ??= new Map();
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, 1);
    } catch {
      memory = new Map();
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "body.clientId" });
      store.createIndex("gymId", "gymId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      memory = new Map();
      resolve(null);
    };
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (db) =>
      db &&
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Is the queue only in memory (lost if the page closes)? */
export const inMemoryOnly = async () => (await open()) === null;

/** Every waiting item of a gym, oldest first. */
export async function waiting(gymId: string): Promise<WaitingItem[]> {
  const db = await open();
  const all = db ? ((await run("readonly", (s) => s.index("gymId").getAll(gymId))) ?? []) : [...(memory?.values() ?? [])].filter((i) => i.gymId === gymId);
  return [...all].sort((a, b) => a.takenAtIso.localeCompare(b.takenAtIso));
}

export async function put(item: WaitingItem) {
  if (await open()) await run("readwrite", (s) => s.put(item));
  else memory?.set(item.body.clientId, item);
  notify();
}

export async function remove(clientId: string) {
  if (await open()) await run("readwrite", (s) => s.delete(clientId));
  else memory?.delete(clientId);
  notify();
}
