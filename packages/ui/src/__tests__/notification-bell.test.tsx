import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The realtime socket and the API are stand-ins: the test drives events and server counts.
const h = vi.hoisted(() => {
  type Handler = (payload?: unknown) => void;
  const handlers = new Map<string, Set<Handler>>();
  const socket = {
    connected: false,
    on: (type: string, fn: Handler) => void (handlers.get(type) ?? handlers.set(type, new Set()).get(type)!).add(fn),
    off: (type: string, fn: Handler) => void handlers.get(type)?.delete(fn),
    emit: (type: string, payload?: unknown) => handlers.get(type)?.forEach((fn) => fn(payload)),
    reset() {
      handlers.clear();
      this.connected = false;
    },
  };
  const server = { unread: 0, items: [] as { id: string; title: string; body: string; readAt: string | null; createdAt: string }[], fail: false };
  return { socket, server };
});

vi.mock("@kriraghor/api-client/notifications", () => ({
  realtimeSocket: () => h.socket,
  listNotifications: vi.fn(async () => {
    if (h.server.fail) throw new Error("offline");
    return { items: h.server.items, unreadCount: h.server.unread, nextCursor: null };
  }),
  markRead: vi.fn(async () => ({ updated: 0, unreadCount: 0 })),
  relativeTime: () => "now",
  badgeText: (n: number) => (n <= 0 ? null : n > 99 ? "99+" : String(n)),
}));
vi.mock("../auth", () => ({ useAuth: () => ({ status: "signed_in", audience: "api" }) }));
vi.mock("../i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@kriraghor/session/env", () => ({ publicEnv: () => ({}) }));
vi.mock("../notifications/sound", async (importActual) => ({
  ...(await importActual<typeof import("../notifications/sound")>()),
  playChime: vi.fn(() => true),
  armAudioOnGesture: vi.fn(),
}));

const { NotificationBell } = await import("../notifications/NotificationBell");
const { playChime, writeSoundSetting, resetSoundForTests } = await import("../notifications/sound");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const messages = {
  notifications: {
    bell: "Updates",
    bellUnread: "Updates, {count} unread",
    title: "Updates",
    all: "All",
    unread: "Unread",
    unreadLabel: "unread",
    loading: "Loading updates",
    error: "Couldn't load updates.",
    retry: "Retry",
    empty: "No updates yet.",
    markAllRead: "Mark all read",
    seeAll: "See all",
    settings: "Settings",
    sound: { label: "Play a sound for new notifications" },
    newOne: "New notification: {title}",
    newGeneric: "You have a new notification.",
  },
};

let host: HTMLDivElement;
let root: Root;
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => new Promise((r) => setTimeout(r, 0)));
};
const announced = () => host.querySelector('[data-testid="notification-announcer"]')!.textContent;
const item = (id: string, title: string) => ({ id, title, body: "", readAt: null, createdAt: "2026-10-22T08:00:00Z" });

async function mount() {
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } } })}>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Dhaka">
          <NotificationBell centreHref="/me/notifications" />
        </NextIntlClientProvider>
      </QueryClientProvider>
    )
  );
  await flush();
}

beforeEach(() => {
  h.socket.reset();
  h.server.unread = 2;
  h.server.items = [item("n1", "Booking confirmed"), item("n2", "Payout sent")];
  h.server.fail = false;
  vi.mocked(playChime).mockClear();
  resetSoundForTests();
  window.localStorage.clear();
  document.title = "Kriraghor";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

describe("NotificationBell: noticing new notifications (M08 §4.1)", () => {
  it("stays quiet on first load, then chimes once for a realtime notification.created and announces its title", async () => {
    await mount();
    expect(host.querySelector('[data-testid="notification-badge"]')!.textContent).toBe("2");
    expect(playChime).not.toHaveBeenCalled();

    h.server.unread = 3;
    h.server.items = [item("n3", "New hire request from Rafi"), ...h.server.items];
    act(() => h.socket.emit("notification.created", { notificationId: "n3", unreadCount: 3 }));
    await flush();

    // One chime: the event's count, and the re-read showing the same count stays quiet.
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="notification-badge"]')!.textContent).toBe("3");
    expect(announced()).toBe("New notification: New hire request from Rafi");
  });

  it("chimes when an event without a count leads to a re-read showing more unread", async () => {
    await mount();
    h.server.unread = 3;
    h.server.items = [item("n3", "New message"), ...h.server.items];
    act(() => h.socket.emit("notification.created", { notificationId: "n3", unreadCount: null }));
    await flush();
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(announced()).toBe("New notification: New message");
  });

  it("announces generically when the list cannot be re-read after the event", async () => {
    await mount();
    h.server.fail = true;
    act(() => h.socket.emit("notification.created", { notificationId: "n3", unreadCount: 3 }));
    await flush();
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(announced()).toBe("You have a new notification.");
  });

  it("does not chime when the count goes down", async () => {
    await mount();
    h.server.unread = 0;
    act(() => h.socket.emit("notification.read", { unreadCount: 0 }));
    await flush();
    expect(playChime).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="notification-badge"]')).toBeNull();
  });

  it("without a socket connection, re-reads on focus and chimes for a rise; not once the socket is connected", async () => {
    await mount();
    h.server.unread = 3;
    h.server.items = [item("n3", "New hire request"), ...h.server.items];
    act(() => void window.dispatchEvent(new Event("focus")));
    await flush();
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(announced()).toBe("New notification: New hire request");

    h.socket.connected = true;
    act(() => h.socket.emit("connect"));
    await flush();
    h.server.unread = 4;
    act(() => void window.dispatchEvent(new Event("focus")));
    await flush();
    // The connect re-read already saw 3; focus no longer re-reads while realtime is up.
    expect(host.querySelector('[data-testid="notification-badge"]')!.textContent).toBe("3");
    expect(playChime).toHaveBeenCalledTimes(1);
  });

  it("respects the sound switch, and puts the count in a hidden tab's title until it is visible", async () => {
    writeSoundSetting(false);
    await mount();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    h.server.unread = 5;
    act(() => h.socket.emit("notification.created", { notificationId: "n9", unreadCount: 5 }));
    await flush();
    expect(playChime).not.toHaveBeenCalled();
    expect(document.title).toBe("(5) Kriraghor");

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(document.title).toBe("Kriraghor");
  });
});
