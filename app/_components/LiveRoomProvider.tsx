'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionState, DisconnectReason, Room, RoomEvent } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';

/// Mounts a single LiveKit Room at the patient-layout level so the room
/// connection survives sub-tab navigation (Live ↔ Cameras ↔ Detectors ↔
/// Settings). Before this lived inside `<VideoGrid>` (Live page only), so
/// leaving Live tore the room down and returning paid the full WebRTC
/// handshake again (~1-2s black screen). With it hoisted here, switching
/// sub-tabs preserves the layout (and this room) — only the page swaps.
///
/// We own the `Room` IMPERATIVELY (instead of `<LiveKitRoom>`) so we can
/// RECONNECT it in place when Privacy mode flips, WITHOUT remounting the
/// React subtree. Privacy severs/restores the caregiver's `can_subscribe`
/// grant inside the minted token; the SDK reuses its token across an
/// existing connection, so a freshly minted token alone never takes
/// effect — the participant has to reconnect. Remounting `<LiveKitRoom>`
/// via a `key` did reconnect, but it tore down whatever page the caregiver
/// was on (a settings toggle flashed the whole page and scrolled to top).
/// Reconnecting the Room object directly keeps every child mounted: no
/// flash, no scroll jump.
///
/// We (re)connect on mount, when the token first becomes available, and
/// when `privacyMode` changes — NOT on every `token` change, because
/// `router.refresh()` mints a fresh JWT each time and reconnecting on
/// unrelated refreshes would needlessly blip the feed. A privacy toggle is
/// the one case the grants actually change, and the layout re-mints
/// `token` to match in the same render, so we reconnect THEN with the
/// current token (read via a ref so it isn't an effect dependency).
///
/// When `token` is null (mint failed in the layout) we render children
/// raw — no RoomContext — and `useTracks()` returns an empty list, which
/// `<VideoGrid>` renders as its error/placeholder state.
///
/// AUTO-RECONNECT: the LiveKit SDK gives up reconnecting after a few
/// attempts, which would strand the dashboard until a manual refresh if
/// the LiveKit server ever restarts (e.g. a cloud deploy). We listen for
/// the SDK's `Disconnected` event and re-`connect()` the SAME Room with
/// capped backoff (NOT a remount — that would flash the page, see above),
/// mirroring the gateway's own reconnect backstop so a server blip
/// self-heals with no refresh. The SDK only fires `Disconnected` after its
/// OWN internal retries are exhausted, so this engages only for real
/// outages. We skip CLIENT_INITIATED disconnects, so the backoff retry
/// never fights the privacy-toggle reconnect or the unmount teardown.
export function LiveRoomProvider({
  token,
  serverUrl,
  privacyMode,
  children,
}: {
  token: string | null;
  serverUrl: string;
  privacyMode: boolean;
  children: React.ReactNode;
}) {
  const [room] = useState(() => new Room());
  const tokenRef = useRef(token);
  const hasToken = token != null;

  // Keep the latest token in a ref WITHOUT making it a dependency of the
  // reconnect effect below (so routine token refreshes don't reconnect).
  // Declared first so it runs before the reconnect effect in commit order.
  useEffect(() => {
    tokenRef.current = token;
  });

  // Auto-reconnect backoff state (outage recovery, see docstring). Held in
  // refs + a self-referencing ref so a failed retry can re-arm itself
  // without a re-render.
  const backoffRef = useRef(1000); // ms; doubles per failure, capped at 8s
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    if (timerRef.current) return; // one pending reconnect at a time
    const delay = backoffRef.current;
    backoffRef.current = Math.min(backoffRef.current * 2, 8000);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const current = tokenRef.current;
      // Bail if we lost the token, or the room already came back (e.g. a
      // privacy toggle reconnected it while this retry was pending).
      if (!current || room.state !== ConnectionState.Disconnected) return;
      void room.connect(serverUrl, current).catch(() => {
        scheduleRef.current(); // still down → retry with the next backoff
      });
    }, delay);
  }, [room, serverUrl]);
  scheduleRef.current = scheduleReconnect;

  // Connect on mount / first token / privacy flip. Privacy severs or
  // restores the caregiver's grant, so we reconnect with the freshly minted
  // token THEN (not on unrelated refreshes — hence the token ref).
  useEffect(() => {
    const current = tokenRef.current;
    if (!current) return;
    let cancelled = false;
    void (async () => {
      try {
        if (room.state !== ConnectionState.Disconnected) {
          await room.disconnect();
        }
        // Default connect options (autoSubscribe=true), so a fresh
        // connection re-subscribes to whatever the camera is already
        // publishing — exactly what restores the feed when privacy clears.
        if (!cancelled) await room.connect(serverUrl, current);
      } catch {
        // Surface failures via the grid placeholder (empty useTracks),
        // never a thrown render.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room, serverUrl, privacyMode, hasToken]);

  // Outage auto-reconnect + backoff reset, bound to the SAME room object.
  useEffect(() => {
    const onDisconnected = (reason?: DisconnectReason) => {
      // Skip OUR OWN disconnects (the privacy toggle's disconnect-before-
      // reconnect, and the unmount teardown) — they report CLIENT_INITIATED.
      // Only a real outage (server restart, signal lost after the SDK gave
      // up) should arm the backoff retry.
      if (reason === DisconnectReason.CLIENT_INITIATED) return;
      scheduleReconnect();
    };
    const onConnected = () => {
      backoffRef.current = 1000; // healthy again → reset backoff
    };
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.Connected, onConnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.Connected, onConnected);
    };
  }, [room, scheduleReconnect]);

  // Tear the room down when the layout unmounts (leaving the patient).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void room.disconnect();
    };
  }, [room]);

  if (!token) {
    return <>{children}</>;
  }

  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
}
