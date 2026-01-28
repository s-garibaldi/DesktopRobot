"use client";

import React, { createContext, useContext, useState, FC, PropsWithChildren } from "react";
import { v4 as uuidv4 } from "uuid";
import { LoggedEvent } from "@/app/types";
import { postBridgeMessage, type BridgeLogLevel } from "@/app/lib/bridge";

type EventContextValue = {
  loggedEvents: LoggedEvent[];
  logClientEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  logServerEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  logHistoryItem: (item: any) => void;
  toggleExpand: (id: number | string) => void;
};

const EventContext = createContext<EventContextValue | undefined>(undefined);

export const EventProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);

  function deriveBridgeDetails(eventData: Record<string, any>) {
    // Best-effort extraction of error info without shipping full payloads.
    const details: { errorMessage?: string; errorType?: string; status?: number } = {};

    const status = eventData?.response?.status;
    if (typeof status === "number") details.status = status;

    const statusError = eventData?.response?.status_details?.error;
    if (statusError) {
      if (typeof statusError?.message === "string") details.errorMessage = statusError.message;
      if (typeof statusError?.type === "string") details.errorType = statusError.type;
    }

    const topLevelError = eventData?.error;
    if (typeof topLevelError === "string" && !details.errorMessage) {
      details.errorMessage = topLevelError;
    }

    const msg = eventData?.message;
    if (typeof msg === "string" && !details.errorMessage) {
      details.errorMessage = msg;
    }

    return Object.keys(details).length ? details : undefined;
  }

  function deriveBridgeLevel(eventName: string, eventData: Record<string, any>): BridgeLogLevel {
    const lower = (eventName || "").toLowerCase();
    if (lower.includes("error") || lower.includes("failed")) return "error";
    if (eventData?.response?.status_details?.error != null) return "error";
    if (lower.includes("warn")) return "warn";
    return "info";
  }

  function addLoggedEvent(direction: "client" | "server", eventName: string, eventData: Record<string, any>) {
    const id = eventData.event_id || uuidv4();
    setLoggedEvents((prev) => [
      ...prev,
      {
        id,
        direction,
        eventName,
        eventData,
        timestamp: new Date().toLocaleTimeString(),
        expanded: false,
      },
    ]);

    // Forward a minimal, sanitized version to the parent (Tauri frontend) when embedded.
    postBridgeMessage({
      type: "bridge_log",
      payload: {
        id,
        direction,
        eventName,
        eventType: typeof eventData?.type === "string" ? eventData.type : undefined,
        timestamp: new Date().toLocaleTimeString(),
        level: deriveBridgeLevel(eventName, eventData),
        details: deriveBridgeDetails(eventData),
      },
    });
  }

  const logClientEvent: EventContextValue["logClientEvent"] = (eventObj, eventNameSuffix = "") => {
    const name = `${eventObj.type || ""} ${eventNameSuffix || ""}`.trim();
    addLoggedEvent("client", name, eventObj);
  };

  const logServerEvent: EventContextValue["logServerEvent"] = (eventObj, eventNameSuffix = "") => {
    const name = `${eventObj.type || ""} ${eventNameSuffix || ""}`.trim();
    addLoggedEvent("server", name, eventObj);
  };

  const logHistoryItem: EventContextValue['logHistoryItem'] = (item) => {
    let eventName = item.type;
    if (item.type === 'message') {
      eventName = `${item.role}.${item.status}`;
    }
    if (item.type === 'function_call') {
      eventName = `function.${item.name}.${item.status}`;
    }
    addLoggedEvent('server', eventName, item);
  };

  const toggleExpand: EventContextValue['toggleExpand'] = (id) => {
    setLoggedEvents((prev) =>
      prev.map((log) => {
        if (log.id === id) {
          return { ...log, expanded: !log.expanded };
        }
        return log;
      })
    );
  };


  return (
    <EventContext.Provider
      value={{ loggedEvents, logClientEvent, logServerEvent, logHistoryItem, toggleExpand }}
    >
      {children}
    </EventContext.Provider>
  );
};

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}