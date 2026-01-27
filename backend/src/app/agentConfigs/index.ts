import { simpleHandoffScenario } from './simpleHandoff';
import { musicalCompanionScenario } from './musicalCompanion';
import { generalAssistantScenario } from './generalAssistant';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  musicalCompanion: musicalCompanionScenario,
  generalAssistant: generalAssistantScenario,
};

export const defaultAgentSetKey = 'musicalCompanion';
