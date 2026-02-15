import { tool } from '@openai/agents/realtime';

/** Base URL for the backend so search works in browser (iframe) and server contexts */
function getSearchApiUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/search`;
  }
  const base = process.env.BACKEND_PUBLIC_URL
    ? process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '')
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
  return `${base}/api/search`;
}

/**
 * Web search tool using Brave Search API
 * This tool allows agents to search the internet for current information
 */
export const webSearchTool = tool({
  name: 'search_web',
  description: 'Search the internet for current information, news, facts, or any topic. Use this when you need up-to-date information, recent events, or information that might not be in your training data. Always use this for questions about current events, recent news, or real-time information.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the internet. Be specific and clear.',
      },
      count: {
        type: 'number',
        description: 'Number of search results to return (default: 5, max: 20)',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const { query, count = 5 } = input as {
        query: string;
        count?: number;
      };

      if (!query || !query.trim()) {
        return {
          success: false,
          error: 'Search query is required',
        };
      }

      const searchUrl = getSearchApiUrl();
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          count: Math.min(Math.max(count, 1), 20), // Clamp between 1 and 20
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: errorData.error || `Search failed with status ${response.status}`,
        };
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Search failed',
        };
      }

      // Format the results for the agent
      const results = data.results || [];
      const formattedResults = results.map((result: any, index: number) => {
        return `${index + 1}. ${result.title || 'Untitled'}\n   ${result.url || ''}\n   ${result.description || result.snippet || 'No description available'}`;
      }).join('\n\n');

      return {
        success: true,
        query: query,
        resultsCount: results.length,
        results: formattedResults,
        rawResults: results, // Include raw results for detailed access
        message: `Found ${results.length} result(s) for "${query}"`,
      };
    } catch (error: any) {
      console.error('Web search error:', error);
      return {
        success: false,
        error: error.message || 'Failed to perform web search',
      };
    }
  },
});
