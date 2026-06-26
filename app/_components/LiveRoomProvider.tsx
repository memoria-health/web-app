'use client';

import { useEffect, useRef, useState } from 'react';
import { ConnectionState, Room } from 'livekit-client';
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

  // Tear the room down when the layout unmounts (leaving the patient).
  useEffect(() => {
    return () => {
      void room.disconnect();
    };
  }, [room]);

  if (!token) {
    return <>{children}</>;
  }
  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
}
