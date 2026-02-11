/**
 * Bridge utilities for forwarding backend UI events to a parent window (e.g. Tauri frontend)
 * via postMessage.
 *
 * This is intentionally "client-only" usage (window APIs).
 */
export type BridgeLogLevel = "info" | "warn" | "error";

export type BridgeLogEvent = {
  type: "bridge_log";
  payload: {
    id: string;
    direction: "client" | "server";
    eventName: string;
    eventType?: string;
    timestamp: string;
    level: BridgeLogLevel;
    // Keep this intentionally minimal to avoid leaking secrets / large payloads.
    details?: {
      errorMessage?: string;
      errorType?: string;
      status?: number;
    };
  };
};

function safeParentOrigin(): string {
  // Prefer referrer origin when available; otherwise fall back to '*'
  try {
    if (typeof document === "undefined") return "*";
    if (!document.referrer) return "*";
    const origin = new URL(document.referrer).origin;
    return origin && origin !== "null" ? origin : "*";
  } catch {
    return "*";
  }
}

export function postBridgeMessage(message: BridgeLogEvent) {
  if (typeof window === "undefined") return;
  // Only forward when embedded (iframe/window parent differs).
  if (!window.parent || window.parent === window) return;

  const origin = safeParentOrigin();
  window.parent.postMessage(message, origin);
}

/**
 * Send a client action to the parent window (e.g. start_metronome).
 * Used by agent tools to trigger frontend behavior (metronome, etc.).
 */
export function postClientAction(type: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") {
    console.warn("[bridge] postClientAction skipped: no window (e.g. running in worker or Node)");
    return;
  }
  if (!window.parent || window.parent === window) {
    console.warn("[bridge] postClientAction skipped: not embedded in iframe (window.parent === window)");
    return;
  }

  const origin = safeParentOrigin();
  const message = { type, ...payload };
  window.parent.postMessage(message, origin);
  console.log("[bridge] postClientAction sent:", type, payload, "targetOrigin:", origin);
}

