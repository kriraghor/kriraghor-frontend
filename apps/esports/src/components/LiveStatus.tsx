"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAccessToken } from "@kriraghor/session/auth";
import { publicEnv } from "@kriraghor/session/env";

type State = { connected: boolean; rooms: string[]; error?: string };

/**
 * Connects to the realtime service (Socket.IO on the API host, /socket.io) with the access token.
 * The server joins user:{id} (and staff for admin sockets). Tournament rooms come with M21.
 */
export function LiveStatus() {
  const t = useTranslations();
  const { status, audience } = useAuth();
  const [state, setState] = useState<State>({ connected: false, rooms: [] });

  useEffect(() => {
    if (status !== "signed_in") return;
    const socket = io(publicEnv().REALTIME_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: (cb) => cb({ token: getAccessToken(audience), audience }),
    });
    socket.on("ready", (info: { rooms: string[] }) => setState({ connected: true, rooms: info.rooms }));
    socket.on("connect_error", (err: Error & { data?: { code?: string } }) => setState({ connected: false, rooms: [], error: err.data?.code ?? err.message }));
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));
    return () => {
      socket.close();
    };
  }, [status, audience]);

  if (status !== "signed_in") return null;
  return (
    <p className="mt-6 flex items-center gap-2 text-sm" data-testid="live-status" data-connected={state.connected}>
      <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${state.connected ? "bg-brand" : "bg-line"}`} />
      {t("me.live")}: {state.connected ? `${t("me.liveOn")} (${state.rooms.join(", ")})` : `${t("me.liveOff")}${state.error ? ` (${state.error})` : ""}`}
    </p>
  );
}
