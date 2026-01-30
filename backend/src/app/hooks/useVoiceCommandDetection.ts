"use client";

import { useEffect, useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";

// Voice command patterns for agent switching
// Note: Since musicalCompanion is the only agent, these commands are kept for consistency
// but will always resolve to musicalCompanion
const VOICE_COMMANDS = {
  music: {
    patterns: [
      /go to music mode/i,
      /switch to music mode/i,
      /music mode/i,
      /activate music/i,
      /enable music/i,
      /go music/i,
    ],
    agentConfig: "musicalCompanion",
  },
};

export function useVoiceCommandDetection() {
  const { transcriptItems } = useTranscript();
  const processedItemsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Get the latest user messages that haven't been processed
    const userMessages = transcriptItems
      .filter(
        (item) =>
          item.type === "MESSAGE" &&
          item.role === "user" &&
          item.status === "DONE" &&
          !processedItemsRef.current.has(item.itemId)
      )
      .slice(-5); // Check last 5 user messages

    for (const message of userMessages) {
      const text = message.title || "";
      if (!text.trim()) continue;

      // Check each command category
      for (const [category, config] of Object.entries(VOICE_COMMANDS)) {
        for (const pattern of config.patterns) {
          if (pattern.test(text)) {
            console.log(
              `[Voice Command] Detected "${category}" command: "${text}"`
            );
            
            // Mark this item as processed
            processedItemsRef.current.add(message.itemId);

            // Update URL to switch agent config
            const currentUrl = new URL(window.location.toString());
            const currentConfig = currentUrl.searchParams.get("agentConfig");

            // Only switch if different
            if (currentConfig !== config.agentConfig) {
              console.log(
                `[Voice Command] Switching from ${currentConfig} to ${config.agentConfig}`
              );
              
              currentUrl.searchParams.set("agentConfig", config.agentConfig);
              window.location.replace(currentUrl.toString());
            }

            return; // Exit early after first match
          }
        }
      }

      // Mark as processed even if no command matched
      processedItemsRef.current.add(message.itemId);
    }
  }, [transcriptItems]);
}
