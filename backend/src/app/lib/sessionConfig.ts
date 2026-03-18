/**
 * Session config for OpenAI Realtime API.
 * Exports instructions and tools in API format so the session is created with
 * full agent capabilities (including Spotify queue tools) from the start.
 */
import { musicalCompanionAgent } from '../agentConfigs/musicalCompanion';

/** Convert SDK tool to Realtime API format (name, description, parameters only). */
function toolToApiFormat(t: { name?: string; description?: string; parameters?: unknown }): {
  type: 'function';
  name: string;
  description: string;
  parameters: unknown;
} {
  return {
    type: 'function',
    name: t.name ?? 'unknown',
    description: typeof t.description === 'string' ? t.description : '',
    parameters: t.parameters ?? { type: 'object', properties: {} },
  };
}

/** Instructions string for the session (system prompt). */
export function getSessionInstructions(): string {
  const instr = musicalCompanionAgent.instructions;
  return typeof instr === 'string' ? instr : '';
}

/** Tools in Realtime API format for session creation. */
export function getSessionTools(): Array<{ type: 'function'; name: string; description: string; parameters: unknown }> {
  const tools = musicalCompanionAgent.tools ?? [];
  return tools.map((t: unknown) => toolToApiFormat(t as { name?: string; description?: string; parameters?: unknown }));
}
