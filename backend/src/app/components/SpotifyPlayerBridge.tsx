"use client";

/**
 * Runs the Spotify Web Playback SDK inside the backend iframe.
 * Realtime AI audio already works here (same document), so Spotify should too.
 * Receives token + commands via postMessage from the parent (Tauri frontend).
 * The backend iframe has allow="autoplay" and plays Realtime AI audio - Spotify uses the same context.
 */
import { useEffect, useRef, useState } from "react";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

/** Fix iframe audio - same approach as frontend but backend iframe is the parent. */
function fixSpotifyIframeAudio() {
  if (typeof document === "undefined") return;
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="sdk.scdn.co"], iframe[src*="spotify.com"]');
  iframes.forEach((iframe) => {
    iframe.setAttribute("allow", "encrypted-media; autoplay");
    iframe.style.setProperty("display", "block", "important");
    iframe.style.setProperty("position", "fixed", "important");
    iframe.style.setProperty("bottom", "0", "important");
    iframe.style.setProperty("right", "0", "important");
    iframe.style.setProperty("width", "1px", "important");
    iframe.style.setProperty("height", "1px", "important");
    iframe.style.setProperty("opacity", "0.01", "important");
    iframe.style.setProperty("pointer-events", "none", "important");
  });
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => {
        connect: () => Promise<boolean>;
        disconnect: () => void;
        addListener: (event: string, cb: (s?: unknown) => void) => void;
        getCurrentState: () => Promise<{
          track_window?: { current_track?: { name?: string; uri?: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } } };
          position?: number;
          duration?: number;
          paused?: boolean;
        } | null>;
        setVolume: (n: number) => Promise<void>;
        pause: () => Promise<void>;
        resume: () => Promise<void>;
        seek: (ms: number) => Promise<void>;
        activateElement: () => Promise<void>;
      };
    };
  }
}

type SpotifySdkState = {
  track_window?: {
    current_track?: {
      name?: string;
      uri?: string;
      artists?: { name: string }[];
      album?: { images?: { url: string }[] };
    };
  };
  position?: number;
  duration?: number;
  paused?: boolean;
} | null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postToParent(type: string, payload?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.parent && window.parent !== window) {
    window.parent.postMessage({ type, ...payload }, "*");
  }
}

export function SpotifyPlayerBridge() {
  const tokenRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const observePlaybackReasonRef = useRef<"play" | "resume" | null>(null);
  const observePlaybackRemainingRef = useRef(0);
  const autoResumeAttemptsRef = useRef(0);
  const monitorAutoResumeUntilRef = useRef(0);
  const stuckPausedPositionRef = useRef<number | null>(null);
  const stuckPausedCountRef = useRef(0);
  const playerRef = useRef<{
    connect: () => Promise<boolean>;
    disconnect: () => void;
    addListener: (event: string, cb: (s?: unknown) => void) => void;
    getCurrentState: () => Promise<unknown>;
    setVolume: (n: number) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    seek: (ms: number) => Promise<void>;
    activateElement?: () => Promise<void>;
  } | null>(null);
  const [hasToken, setHasToken] = useState(false);

  const startPlaybackViaApi = async (uris?: string[]) => {
    const token = tokenRef.current;
    if (!token) return false;
    const devId = deviceIdRef.current;
    const playUrl = devId
      ? `https://api.spotify.com/v1/me/player/play?device_id=${devId}`
      : "https://api.spotify.com/v1/me/player/play";

    const body = uris?.length ? { uris, position_ms: 0 } : {};
    const sendPlay = () =>
      fetch(playUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

    let res = await sendPlay();
    if (res.ok || !devId) return res.ok;

    await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_ids: [devId], play: true }),
    }).catch(() => undefined);

    await sleep(600);
    res = await sendPlay();
    return res.ok;
  };

  const ensurePlaybackStarted = async (expectedUri?: string, uris?: string[]) => {
    const player = playerRef.current;
    if (!player) return false;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await player.activateElement?.();
        await player.resume?.();
      } catch {
        // ignore and fall back to Web API replay below
      }

      await sleep(250);

      const state = (await player.getCurrentState?.().catch(() => null)) as SpotifySdkState;
      const currentUri = state?.track_window?.current_track?.uri ?? null;
      const isExpectedTrack = !expectedUri || currentUri === expectedUri;
      if (isExpectedTrack && state?.paused === false) {
        return true;
      }

      const shouldReplay =
        !state ||
        !currentUri ||
        !isExpectedTrack ||
        state.paused === true;

      if (shouldReplay) {
        const ok = await startPlaybackViaApi(uris).catch(() => false);
        if (!ok) continue;
      }
    }

    return false;
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const d = event.data;
      if (!d?.type?.startsWith("spotify_")) return;

      switch (d.type) {
        case "spotify_set_token": {
          const t = typeof d.token === "string" ? d.token : null;
          tokenRef.current = t;
          setHasToken(!!t);
          postToParent("spotify_token_received", { hasToken: !!t });
          break;
        }

        case "spotify_play": {
          const uri = d.uri;
          const queueUris = Array.isArray(d.queueUris) ? d.queueUris : undefined;
          if (!tokenRef.current || typeof uri !== "string") {
            postToParent("spotify_play_result", { ok: false });
            return;
          }
          const uris = queueUris?.length ? [uri, ...queueUris] : [uri];
          try {
            observePlaybackReasonRef.current = "play";
            observePlaybackRemainingRef.current = 12;
            autoResumeAttemptsRef.current = 0;
            monitorAutoResumeUntilRef.current = Date.now() + 15000;
            stuckPausedPositionRef.current = null;
            stuckPausedCountRef.current = 0;
            await playerRef.current?.activateElement?.();
            const started = await startPlaybackViaApi(uris);
            const resumed = started ? await ensurePlaybackStarted(uri, uris) : false;
            postToParent("spotify_play_result", { ok: started && resumed });
          } catch {
            postToParent("spotify_play_result", { ok: false });
          }
          break;
        }

        case "spotify_activate":
          try {
            await playerRef.current?.activateElement?.();
          } catch {
            // ignore
          }
          break;

        case "spotify_pause":
          try {
            monitorAutoResumeUntilRef.current = 0;
            stuckPausedPositionRef.current = null;
            stuckPausedCountRef.current = 0;
            await playerRef.current?.pause?.();
          } catch {
            // ignore
          }
          break;

        case "spotify_resume":
          try {
            observePlaybackReasonRef.current = "resume";
            observePlaybackRemainingRef.current = 12;
            monitorAutoResumeUntilRef.current = Date.now() + 8000;
            stuckPausedPositionRef.current = null;
            stuckPausedCountRef.current = 0;
            await playerRef.current?.activateElement?.();
            await playerRef.current?.resume?.();
            const state = (await playerRef.current?.getCurrentState?.()) as SpotifySdkState;
            const isStuckPausedZero =
              Boolean(state?.track_window?.current_track?.uri) &&
              state?.paused === true &&
              (state?.position ?? 0) === 0;
            if (isStuckPausedZero) {
              try {
                await playerRef.current?.pause?.();
                await playerRef.current?.activateElement?.();
                await playerRef.current?.resume?.();
              } catch {
                // ignore and try Web API wake below
              }
              const token = tokenRef.current;
              const devId = deviceIdRef.current;
              if (token) {
                const wakeUrl = devId
                  ? `https://api.spotify.com/v1/me/player/play?device_id=${devId}`
                  : "https://api.spotify.com/v1/me/player/play";
                try {
                  await fetch(wakeUrl, {
                    method: "PUT",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                  });
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ignore
          }
          break;

        case "spotify_seek":
          try {
            await playerRef.current?.seek?.(Number(d.positionMs) || 0);
          } catch {
            // ignore
          }
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const updateState = async () => {
      const p = playerRef.current;
      if (!p || cancelled) return;
      try {
        const state = (await p.getCurrentState()) as SpotifySdkState;
        if (!state || cancelled) return;
        const track = state.track_window?.current_track;
        const position = state.position ?? 0;
        if (
          monitorAutoResumeUntilRef.current > Date.now() &&
          Boolean(track?.uri) &&
          state.paused === true
        ) {
          if (stuckPausedPositionRef.current === position) {
            stuckPausedCountRef.current += 1;
          } else {
            stuckPausedPositionRef.current = position;
            stuckPausedCountRef.current = 1;
          }
        } else {
          stuckPausedPositionRef.current = null;
          stuckPausedCountRef.current = 0;
        }
        if (
          observePlaybackReasonRef.current === "play" &&
          autoResumeAttemptsRef.current < 2 &&
          Boolean(track?.uri) &&
          state.paused === true &&
          (position === 0 || stuckPausedCountRef.current >= 2)
        ) {
          autoResumeAttemptsRef.current += 1;
          try {
            await p.activateElement?.();
            await p.resume?.();
          } catch {
            // ignore and fall back to Web API wake below
          }
          const token = tokenRef.current;
          const devId = deviceIdRef.current;
          if (token) {
            const wakeUrl = devId
              ? `https://api.spotify.com/v1/me/player/play?device_id=${devId}`
              : "https://api.spotify.com/v1/me/player/play";
            try {
              await fetch(wakeUrl, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
              });
            } catch {
              // ignore
            }
          }
          observePlaybackReasonRef.current = "resume";
          observePlaybackRemainingRef.current = Math.max(observePlaybackRemainingRef.current, 4);
        }
        if (
          monitorAutoResumeUntilRef.current > Date.now() &&
          autoResumeAttemptsRef.current < 2 &&
          Boolean(track?.uri) &&
          state.paused === true &&
          (position === 0 || stuckPausedCountRef.current >= 2)
        ) {
          autoResumeAttemptsRef.current += 1;
          try {
            await p.activateElement?.();
            await p.resume?.();
          } catch {
            // ignore and try API wake below
          }
          const token = tokenRef.current;
          const devId = deviceIdRef.current;
          if (token) {
            const wakeUrl = devId
              ? `https://api.spotify.com/v1/me/player/play?device_id=${devId}`
              : "https://api.spotify.com/v1/me/player/play";
            try {
              await fetch(wakeUrl, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
              });
            } catch {
              // ignore
            }
          }
          observePlaybackReasonRef.current = "resume";
          observePlaybackRemainingRef.current = Math.max(observePlaybackRemainingRef.current, 12);
          if (autoResumeAttemptsRef.current >= 2) {
            monitorAutoResumeUntilRef.current = 0;
          }
        }
        if (observePlaybackRemainingRef.current > 0) {
          observePlaybackRemainingRef.current -= 1;
          if (observePlaybackRemainingRef.current === 0) {
            observePlaybackReasonRef.current = null;
          }
        }
        if (monitorAutoResumeUntilRef.current > 0 && monitorAutoResumeUntilRef.current <= Date.now()) {
          monitorAutoResumeUntilRef.current = 0;
        }
        postToParent("spotify_playback_state", {
          trackName: track?.name ?? null,
          trackUri: track?.uri ?? null,
          artistNames: track?.artists?.map((a) => a.name).join(", ") ?? "",
          albumImageUrl: track?.album?.images?.[0]?.url ?? null,
          position: state.position ?? 0,
          duration: state.duration ?? 0,
          paused: state.paused ?? true,
        });
      } catch {
        // ignore
      }
    };

    const initPlayer = () => {
      if (!window.Spotify || cancelled) return;
      const player = new window.Spotify.Player({
        name: "Desktop Robot (Backend)",
        getOAuthToken: (cb) => {
          const t = tokenRef.current;
          if (t && !cancelled) cb(t);
        },
        volume: 0.5,
      });

      player.addListener("ready", (state?: unknown) => {
        const { device_id } = (state ?? {}) as { device_id?: string };
        if (!cancelled && device_id) {
          deviceIdRef.current = device_id;
          fixSpotifyIframeAudio();
          postToParent("spotify_ready", { deviceId: device_id });
          updateState();
          setTimeout(fixSpotifyIframeAudio, 300);
          pollInterval = setInterval(updateState, 1000);
        }
      });

      player.addListener("not_ready", () => {
        if (!cancelled) deviceIdRef.current = null;
      });

      player.addListener("player_state_changed", () => {
        if (!cancelled) {
          fixSpotifyIframeAudio();
          updateState();
        }
      });

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      initPlayer();
      return () => {
        cancelled = true;
        if (pollInterval) clearInterval(pollInterval);
        playerRef.current?.disconnect?.();
        playerRef.current = null;
      };
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (!cancelled) initPlayer();
    };

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
      window.onSpotifyWebPlaybackSDKReady = undefined;
      if (pollInterval) clearInterval(pollInterval);
      playerRef.current?.disconnect?.();
      playerRef.current = null;
    };
  }, [hasToken]);

  return null;
}
