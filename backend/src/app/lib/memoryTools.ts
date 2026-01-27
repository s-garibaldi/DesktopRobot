import { tool } from '@openai/agents/realtime';
import { saveMemory, getMemories, type MemoryItem } from './memoryStorage';

/**
 * Tool for agents to store important information in memory
 */
export const storeMemoryTool = tool({
  name: 'store_memory',
  description: 'Store an important fact, preference, or piece of information to remember for future conversations. Use this when the user shares personal information, preferences, or facts that should be remembered.',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Category of memory (e.g., "preference", "fact", "context", "personal_info")',
      },
      content: {
        type: 'string',
        description: 'The information to remember. Be concise but clear.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization (e.g., ["music", "guitar", "chords"])',
      },
    },
    required: ['topic', 'content'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const { topic, content, tags } = input as {
        topic: string;
        content: string;
        tags?: string[];
      };

      // Determine agent type from context (will be set when tool is created)
      const agentType = (input as any).agentType || 'generalAssistant';

      const memoryId = await saveMemory({
        agent_type: agentType,
        topic,
        content,
        tags,
      });

      return {
        success: true,
        memoryId,
        message: `Memory stored successfully: ${content}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to store memory',
      };
    }
  },
});

/**
 * Tool for agents to retrieve stored memories
 */
export const retrieveMemoriesTool = tool({
  name: 'retrieve_memories',
  description: 'Retrieve stored memories to recall information from previous conversations. Use this when the user asks about something that might have been mentioned before, or when you need context about the user.',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Optional: Filter memories by topic (e.g., "preference", "fact")',
      },
      limit: {
        type: 'number',
        description: 'Optional: Maximum number of memories to retrieve (default: 10)',
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const { topic, limit } = input as {
        topic?: string;
        limit?: number;
      };

      // Determine agent type from context
      const agentType = (input as any).agentType || 'generalAssistant';

      const memories = await getMemories({
        agentType,
        topic,
        limit: limit || 10,
      });

      if (memories.length === 0) {
        return {
          success: true,
          memories: [],
          message: 'No memories found matching the criteria.',
        };
      }

      return {
        success: true,
        memories: memories.map((m) => ({
          topic: m.topic,
          content: m.content,
          tags: m.tags,
          timestamp: m.timestamp,
        })),
        message: `Found ${memories.length} memory/memories.`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to retrieve memories',
        memories: [],
      };
    }
  },
});

/**
 * Create memory tools with agent type context
 */
export function createMemoryTools(agentType: string) {
  // Create new tool instances with agent type bound to execute functions
  const storeMemoryWithContext = tool({
    name: 'store_memory',
    description: 'Store an important fact, preference, or piece of information to remember for future conversations. Use this when the user shares personal information, preferences, or facts that should be remembered.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Category of memory (e.g., "preference", "fact", "context", "personal_info")',
        },
        content: {
          type: 'string',
          description: 'The information to remember. Be concise but clear.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization (e.g., ["music", "guitar", "chords"])',
        },
      },
      required: ['topic', 'content'],
      additionalProperties: false,
    },
    execute: async (input: any) => {
      try {
        const { topic, content, tags } = input as {
          topic: string;
          content: string;
          tags?: string[];
        };

        const memoryId = await saveMemory({
          agent_type: agentType,
          topic,
          content,
          tags,
        });

        return {
          success: true,
          memoryId,
          message: `Memory stored successfully: ${content}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to store memory',
        };
      }
    },
  });

  const retrieveMemoriesWithContext = tool({
    name: 'retrieve_memories',
    description: 'Retrieve stored memories to recall information from previous conversations. Use this when the user asks about something that might have been mentioned before, or when you need context about the user.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Optional: Filter memories by topic (e.g., "preference", "fact")',
        },
        limit: {
          type: 'number',
          description: 'Optional: Maximum number of memories to retrieve (default: 10)',
        },
      },
      required: [],
      additionalProperties: false,
    },
    execute: async (input: any) => {
      try {
        const { topic, limit } = input as {
          topic?: string;
          limit?: number;
        };

        const memories = await getMemories({
          agentType,
          topic,
          limit: limit || 10,
        });

        if (memories.length === 0) {
          return {
            success: true,
            memories: [],
            message: 'No memories found matching the criteria.',
          };
        }

        return {
          success: true,
          memories: memories.map((m) => ({
            topic: m.topic,
            content: m.content,
            tags: m.tags,
            timestamp: m.timestamp,
          })),
          message: `Found ${memories.length} memory/memories.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to retrieve memories',
          memories: [],
        };
      }
    },
  });

  return [storeMemoryWithContext, retrieveMemoriesWithContext];
}
