"use client";

/**
 * Runs the Spotify Web Playback SDK inside the backend iframe.
 * Realtime AI audio already works here (same document), so Spotify should too.
 * Receives token + commands via postMessage from the parent (Tauri frontend).
 * The backend iframe has allow="autoplay" and plays Realtime AI audio - Spotify uses the same context.
 */
import React, { useEffect, useRef, useState } from "react";

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

function getSpotifyIframeDebugInfo() {
  if (typeof document === "undefined") {
    return { count: 0, allowValues: [] as string[] };
  }
  const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[src*="sdk.scdn.co"], iframe[src*="spotify.com"]'));
  return {
    count: iframes.length,
    allowValues: iframes.map((iframe) => iframe.getAttribute("allow") ?? ""),
  };
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
  const autoResumeAfterPlayAttemptedRef = useRef(false);
  const monitorAutoResumeUntilRef = useRef(0);
  const playerRef = useRef<{
    connect: () => Promise<boolean>;
    disconnect: () => void;
    addListener: (event: string, cb: (s?: unknown) => void) => void;
    getCurrentState: () => Promise<unknown>;
    getVolume?: () => Promise<number>;
    setVolume: (n: number) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    seek: (ms: number) => Promise<void>;
    activateElement?: () => Promise<void>;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

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
          const token = tokenRef.current;
          const devId = deviceIdRef.current;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H5',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:99',message:'backend spotify_play received',data:{hasToken:Boolean(token),hasDeviceId:Boolean(devId),queueLength:queueUris?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (!token || typeof uri !== "string") {
            postToParent("spotify_play_result", { ok: false });
            return;
          }
          const uris = queueUris?.length ? [uri, ...queueUris] : [uri];
          try {
            observePlaybackReasonRef.current = "play";
            observePlaybackRemainingRef.current = 12;
            autoResumeAfterPlayAttemptedRef.current = false;
            monitorAutoResumeUntilRef.current = Date.now() + 15000;
            await playerRef.current?.activateElement?.();
            const url = devId
              ? `https://api.spotify.com/v1/me/player/play?device_id=${devId}`
              : "https://api.spotify.com/v1/me/player/play";
            const res = await fetch(url, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris, position_ms: 0 }),
            });
            if (!res.ok && devId) {
              await fetch("https://api.spotify.com/v1/me/player", {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ device_ids: [devId], play: true }),
              });
              await new Promise((r) => setTimeout(r, 600));
              const retry = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ uris, position_ms: 0 }),
              });
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H5',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:136',message:'backend spotify_play retry completed',data:{initialStatus:res.status,retryStatus:retry.status,ok:retry.ok},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
              postToParent("spotify_play_result", { ok: retry.ok });
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H5',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:138',message:'backend spotify_play initial completed',data:{status:res.status,ok:res.ok},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
              postToParent("spotify_play_result", { ok: res.ok });
            }
          } catch {
            postToParent("spotify_play_result", { ok: false });
          }
          break;
        }

        case "spotify_activate":
          try {
            await playerRef.current?.activateElement?.();
            const state = await playerRef.current?.getCurrentState?.();
            const track = state?.track_window?.current_track;
            const volume = await playerRef.current?.getVolume?.().catch?.(() => null);
            const iframeInfo = getSpotifyIframeDebugInfo();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H13',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:146',message:'backend spotify_activate invoked',data:{ok:true,hasPlayer:Boolean(playerRef.current),hasDeviceId:Boolean(deviceIdRef.current),paused:state?.paused ?? null,hasTrack:Boolean(track?.uri),position:state?.position ?? null,volume:typeof volume === "number" ? volume : null,iframeCount:iframeInfo.count,iframeAllows:iframeInfo.allowValues},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          } catch {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H13',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:146',message:'backend spotify_activate invoked',data:{ok:false,hasPlayer:Boolean(playerRef.current),hasDeviceId:Boolean(deviceIdRef.current)},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          }
          break;

        case "spotify_pause":
          try {
            await playerRef.current?.pause?.();
            const state = await playerRef.current?.getCurrentState?.();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H9',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:159',message:'backend spotify_pause handled',data:{paused:state?.paused ?? null,position:state?.position ?? null,hasTrack:Boolean(state?.track_window?.current_track?.uri)},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          } catch {
            // ignore
          }
          break;

        case "spotify_resume":
          try {
            observePlaybackReasonRef.current = "resume";
            observePlaybackRemainingRef.current = 12;
            monitorAutoResumeUntilRef.current = 0;
            await playerRef.current?.activateElement?.();
            await playerRef.current?.resume?.();
            const state = await playerRef.current?.getCurrentState?.();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H9',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:169',message:'backend spotify_resume handled',data:{paused:state?.paused ?? null,position:state?.position ?? null,hasTrack:Boolean(state?.track_window?.current_track?.uri)},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
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
        const state = await p.getCurrentState();
        if (!state || cancelled) return;
        const track = state.track_window?.current_track;
        if (
          observePlaybackReasonRef.current === "play" &&
          !autoResumeAfterPlayAttemptedRef.current &&
          Boolean(track?.uri) &&
          state.paused === true &&
          (state.position ?? 0) === 0
        ) {
          autoResumeAfterPlayAttemptedRef.current = true;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H12',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:279',message:'backend auto resume triggered after play collapsed to paused zero',data:{paused:state.paused ?? null,position:state.position ?? null,hasTrack:Boolean(track?.uri)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
          !autoResumeAfterPlayAttemptedRef.current &&
          Boolean(track?.uri) &&
          state.paused === true &&
          (state.position ?? 0) === 0
        ) {
          autoResumeAfterPlayAttemptedRef.current = true;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H12',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:268',message:'backend auto resume triggered after play collapsed to paused zero',data:{paused:state.paused ?? null,position:state.position ?? null,hasTrack:Boolean(track?.uri)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
          monitorAutoResumeUntilRef.current = 0;
        }
        const volume = await playerRef.current?.getVolume?.().catch?.(() => null);
        const iframeInfo = getSpotifyIframeDebugInfo();
        if (observePlaybackRemainingRef.current > 0) {
          observePlaybackRemainingRef.current -= 1;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'spotify-autoplay-debug',hypothesisId:'H14',location:'backend/src/app/components/SpotifyPlayerBridge.tsx:274',message:'backend observed playback state after command',data:{reason:observePlaybackReasonRef.current,paused:state.paused ?? null,position:state.position ?? null,duration:state.duration ?? null,hasTrack:Boolean(track?.uri),volume:typeof volume === "number" ? volume : null,iframeCount:iframeInfo.count,iframeAllows:iframeInfo.allowValues},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
          setReady(true);
          fixSpotifyIframeAudio();
          postToParent("spotify_ready", { deviceId: device_id });
          updateState();
          setTimeout(fixSpotifyIframeAudio, 300);
          pollInterval = setInterval(updateState, 1000);
        }
      });

      player.addListener("not_ready", () => {
        if (!cancelled) setReady(false);
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
