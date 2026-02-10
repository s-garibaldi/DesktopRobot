"use client";

import { useEffect, useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { saveMemory } from "../lib/memoryStorage";

interface MemoryExtractionOptions {
  agentType: string;
  enabled?: boolean;
}

/**
 * Hook to automatically extract and store important information from conversations
 */
export function useMemoryExtraction({ agentType, enabled = true }: MemoryExtractionOptions) {
  const { transcriptItems } = useTranscript();
  const processedItemsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    // Get recent user messages that haven't been processed
    const userMessages = transcriptItems
      .filter(
        (item) =>
          item.type === "MESSAGE" &&
          item.role === "user" &&
          item.status === "DONE" &&
          !processedItemsRef.current.has(item.itemId)
      )
      .slice(-3); // Check last 3 user messages

    for (const message of userMessages) {
      const text = message.title || "";
      if (!text.trim()) {
        processedItemsRef.current.add(message.itemId);
        continue;
      }

      // Pattern matching for common memory-worthy information
      const memoryPatterns = [
        // Name patterns
        {
          pattern: /(?:my name is|i'm|i am|call me|i go by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
          topic: "personal_info",
          extract: (match: RegExpMatchArray) => `User's name: ${match[1]}`,
          tags: ["name", "personal"],
        },
        // Favorite/preference patterns
        {
          pattern: /(?:my favorite|i love|i like|i prefer|i enjoy)\s+([^.!?]+)/i,
          topic: "preference",
          extract: (match: RegExpMatchArray) => `Favorite: ${match[1].trim()}`,
          tags: ["preference", "favorite"],
        },
        // Skill level patterns
        {
          pattern: /(?:i'm|i am)\s+(?:a|an)\s+([^.!?]+?)\s+(?:player|musician|guitarist)/i,
          topic: "context",
          extract: (match: RegExpMatchArray) => `Skill level: ${match[1].trim()}`,
          tags: ["skill", "level"],
        },
        // Working on patterns
        {
          pattern: /(?:i'm|i am)\s+working on\s+([^.!?]+)/i,
          topic: "context",
          extract: (match: RegExpMatchArray) => `Currently working on: ${match[1].trim()}`,
          tags: ["project", "current"],
        },
        // Genre/style preferences
        {
          pattern: /(?:i (?:love|like|prefer|enjoy|play))\s+([^.!?]+?)\s+(?:music|genre|style)/i,
          topic: "preference",
          extract: (match: RegExpMatchArray) => `Musical preference: ${match[1].trim()}`,
          tags: ["music", "genre", "preference"],
        },
      ];

      // Try to extract memory from text
      for (const { pattern, topic, extract, tags } of memoryPatterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            const content = extract(match);
            
            // Check if similar memory already exists to avoid duplicates
            // (In a full implementation, you'd query existing memories)
            
            saveMemory({
              agent_type: agentType,
              topic,
              content,
              tags,
            }).then((memoryId) => {
              console.log(`[Memory Extraction] Stored memory: ${content} (ID: ${memoryId})`);
            }).catch((error) => {
              console.warn(`[Memory Extraction] Failed to store memory: ${error}`);
            });

            // Mark as processed and break to avoid multiple extractions from same message
            processedItemsRef.current.add(message.itemId);
            break;
          } catch (error) {
            console.warn(`[Memory Extraction] Error extracting memory: ${error}`);
          }
        }
      }

      // Mark as processed even if no pattern matched
      if (!processedItemsRef.current.has(message.itemId)) {
        processedItemsRef.current.add(message.itemId);
      }
    }
  }, [transcriptItems, agentType, enabled]);
}
