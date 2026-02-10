/**
 * Check if Tauri API is available
 */
function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && 
         (window as any).__TAURI__ !== undefined &&
         (window as any).__TAURI_INTERNALS__ !== undefined;
}

/**
 * Get Tauri invoke function if available
 */
async function getTauriInvoke(): Promise<((cmd: string, args?: any) => Promise<any>) | null> {
  if (!isTauriAvailable()) {
    return null;
  }
  
  try {
    const { invoke } = await import('@tauri-apps/api/tauri');
    return invoke;
  } catch (error) {
    console.warn('[Memory] Failed to import Tauri API:', error);
    return null;
  }
}

export interface MemoryItem {
  id: string;
  timestamp: number;
  agent_type: string;
  topic: string;
  content: string;
  tags?: string[];
}

export interface MemoryFilters {
  agentType?: string;
  topic?: string;
  limit?: number;
}

const STORAGE_KEY = 'desktop-robot-memories';

/**
 * Save memory using localStorage (fallback when Tauri not available)
 */
function saveMemoryLocalStorage(memory: MemoryItem): void {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const memories: MemoryItem[] = existing ? JSON.parse(existing) : [];
    
    // Check if memory with same ID exists and update, otherwise add
    const index = memories.findIndex(m => m.id === memory.id);
    if (index >= 0) {
      memories[index] = memory;
    } else {
      memories.push(memory);
    }
    
    // Sort by timestamp (newest first) and limit to 1000 memories
    memories.sort((a, b) => b.timestamp - a.timestamp);
    const limited = memories.slice(0, 1000);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('Failed to save memory to localStorage:', error);
  }
}

/**
 * Load memories from localStorage (fallback when Tauri not available)
 */
function loadMemoriesLocalStorage(filters?: MemoryFilters): MemoryItem[] {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) return [];
    
    let memories: MemoryItem[] = JSON.parse(existing);
    
    // Apply filters
    if (filters?.agentType) {
      memories = memories.filter(m => m.agent_type === filters.agentType);
    }
    if (filters?.topic) {
      memories = memories.filter(m => m.topic === filters.topic);
    }
    
    // Sort by timestamp (newest first)
    memories.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit
    if (filters?.limit) {
      memories = memories.slice(0, filters.limit);
    }
    
    return memories;
  } catch (error) {
    console.error('Failed to load memories from localStorage:', error);
    return [];
  }
}

/**
 * Save a memory to persistent storage
 */
export async function saveMemory(memory: Omit<MemoryItem, 'id' | 'timestamp'>): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  
  const memoryItem: MemoryItem = {
    id,
    timestamp,
    agent_type: memory.agent_type,
    topic: memory.topic,
    content: memory.content,
    tags: memory.tags,
  };
  
  // Try Tauri API first, fallback to localStorage
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      await invoke('save_memory', {
        id,
        timestamp,
        agentType: memory.agent_type,
        topic: memory.topic,
        content: memory.content,
        tags: memory.tags || null,
      });
      return id;
    } catch (error) {
      console.warn('Tauri save failed, using localStorage:', error);
      saveMemoryLocalStorage(memoryItem);
      return id;
    }
  } else {
    saveMemoryLocalStorage(memoryItem);
    return id;
  }
}

/**
 * Retrieve memories with optional filtering
 */
export async function getMemories(filters?: MemoryFilters): Promise<MemoryItem[]> {
  // Try Tauri API first, fallback to localStorage
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      const memories = (await invoke('load_memories', {
        agentType: filters?.agentType || null,
        topic: filters?.topic || null,
        limit: filters?.limit || null,
      })) as MemoryItem[] | null;
      return memories || [];
    } catch (error) {
      console.warn('Tauri load failed, using localStorage:', error);
      return loadMemoriesLocalStorage(filters);
    }
  } else {
    return loadMemoriesLocalStorage(filters);
  }
}

/**
 * Delete a specific memory by ID
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  // Try Tauri API first, fallback to localStorage
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      await invoke('delete_memory', {
        memoryId,
      });
      return;
    } catch (error) {
      console.warn('Tauri delete failed, using localStorage:', error);
    }
  }
  
  // Fallback: delete from localStorage
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      const memories: MemoryItem[] = JSON.parse(existing);
      const filtered = memories.filter(m => m.id !== memoryId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Failed to delete memory from localStorage:', error);
    throw new Error(`Failed to delete memory: ${error}`);
  }
}

/**
 * Get memories related to a specific topic
 */
export async function getMemoryByTopic(topic: string, limit?: number): Promise<MemoryItem[]> {
  return getMemories({ topic, limit });
}

/**
 * Get memories relevant to a specific agent type
 */
export async function getMemoriesForAgent(agentType: string, limit?: number): Promise<MemoryItem[]> {
  return getMemories({ agentType, limit });
}

/**
 * Format memories as a readable context string for agents
 */
export function formatMemoriesAsContext(memories: MemoryItem[]): string {
  if (memories.length === 0) {
    return '';
  }
  
  const memoryText = memories
    .map((m) => `[Memory: ${m.topic}] ${m.content}${m.tags && m.tags.length > 0 ? ` (tags: ${m.tags.join(', ')})` : ''}`)
    .join('\n');
  
  return `# Memories from Previous Conversations\n${memoryText}\n\nThese are memories from your previous conversations with this user. Use this information to provide personalized responses and remember their preferences.`;
}
