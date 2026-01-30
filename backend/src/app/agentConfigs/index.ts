import { musicalCompanionScenario } from './musicalCompanion';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  musicalCompanion: musicalCompanionScenario,
};

export const defaultAgentSetKey = 'musicalCompanion';
