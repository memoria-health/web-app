'use client';

import { useEffect } from 'react';

/// First visit to Live used to flash: the page's server parts (alerts feed)
/// painted instantly while the heavy LiveKit client chunk downloaded and
/// hydrated the video grid. Warm those chunks during idle time right after
/// sign-in, so the FIRST Live click behaves like every later one.
export function WarmLiveChunks() {
  useEffect(() => {
    const idle = (cb: () => void) =>
      'requestIdleCallback' in window
        ? (window as unknown as { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void })
            .requestIdleCallback(cb, { timeout: 3000 })
        : setTimeout(cb, 1200);
    idle(() => {
      import('livekit-client').catch(() => {});
      import('@/app/_components/VideoGrid').catch(() => {});
      import('@/app/_components/LiveRoomProvider').catch(() => {});
      import('@/app/_components/EventsFeed').catch(() => {});
    });
  }, []);
  return null;
}
