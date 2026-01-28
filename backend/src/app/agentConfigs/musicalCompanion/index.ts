import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { createMemoryTools } from '../../lib/memoryTools';
import { webSearchTool } from '../../lib/webSearchTool';

// Guitar chord recognition tool
const recognizeChordTool = tool({
  name: 'recognize_guitar_chord',
  description: 'Recognize guitar chords and provide chord information, fingerings, and theory',
  parameters: {
    type: 'object',
    properties: {
      chord_name: {
        type: 'string',
        description: 'The name of the guitar chord (e.g., "C major", "Am", "F#m7", "G7")',
      },
    },
    required: ['chord_name'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { chord_name } = input as { chord_name: string };
    
    try {
      // Common guitar chords database
      const chordDatabase: Record<string, any> = {
        'C': {
          name: 'C Major',
          notes: ['C', 'E', 'G'],
          fingering: 'x-3-2-0-1-0',
          theory: 'Major triad built on C',
          common_progressions: ['C-Am-F-G', 'C-F-G-C', 'C-G-Am-F']
        },
        'Am': {
          name: 'A Minor',
          notes: ['A', 'C', 'E'],
          fingering: 'x-0-2-2-1-0',
          theory: 'Minor triad built on A',
          common_progressions: ['Am-F-C-G', 'Am-Dm-G-C', 'Am-G-F-E']
        },
        'F': {
          name: 'F Major',
          notes: ['F', 'A', 'C'],
          fingering: '1-3-3-2-1-1',
          theory: 'Major triad built on F',
          common_progressions: ['F-G-Am-C', 'F-C-Dm-Bb', 'F-Bb-C-F']
        },
        'G': {
          name: 'G Major',
          notes: ['G', 'B', 'D'],
          fingering: '3-2-0-0-3-3',
          theory: 'Major triad built on G',
          common_progressions: ['G-C-D-G', 'G-Am-C-D', 'G-Em-C-D']
        },
        'D': {
          name: 'D Major',
          notes: ['D', 'F#', 'A'],
          fingering: 'x-x-0-2-3-2',
          theory: 'Major triad built on D',
          common_progressions: ['D-G-A-D', 'D-Em-G-A', 'D-Bm-G-A']
        },
        'Em': {
          name: 'E Minor',
          notes: ['E', 'G', 'B'],
          fingering: '0-2-2-0-0-0',
          theory: 'Minor triad built on E',
          common_progressions: ['Em-C-G-D', 'Em-Am-C-G', 'Em-F-G-Em']
        },
        'G7': {
          name: 'G Dominant 7th',
          notes: ['G', 'B', 'D', 'F'],
          fingering: '3-2-0-0-0-1',
          theory: 'Dominant 7th chord, creates tension',
          common_progressions: ['G7-C', 'Dm-G7-C', 'Am-Dm-G7-C']
        },
        'C7': {
          name: 'C Dominant 7th',
          notes: ['C', 'E', 'G', 'Bb'],
          fingering: 'x-3-2-3-1-0',
          theory: 'Dominant 7th chord, bluesy sound',
          common_progressions: ['C7-F', 'Gm-C7-F', 'Bb-C7-F']
        }
      };

      const normalizedChord = chord_name.trim().toLowerCase();
      let chordInfo = null;

      // Try exact match first
      for (const [key, value] of Object.entries(chordDatabase)) {
        if (key.toLowerCase() === normalizedChord) {
          chordInfo = { ...value, key };
          break;
        }
      }

      // If no exact match, try partial matches
      if (!chordInfo) {
        for (const [key, value] of Object.entries(chordDatabase)) {
          if (key.toLowerCase().includes(normalizedChord) || normalizedChord.includes(key.toLowerCase())) {
            chordInfo = { ...value, key };
            break;
          }
        }
      }

      if (chordInfo) {
        return {
          success: true,
          chord: chordInfo,
          message: `Here's information about ${chordInfo.name}:`,
          details: {
            notes: chordInfo.notes.join(' - '),
            fingering: chordInfo.fingering,
            theory: chordInfo.theory,
            progressions: chordInfo.common_progressions.join(', ')
          }
        };
      } else {
        return {
          success: false,
          message: `I don't have information about the chord "${chord_name}". Try common chords like C, Am, F, G, D, Em, G7, or C7.`,
          suggestions: ['C', 'Am', 'F', 'G', 'D', 'Em', 'G7', 'C7']
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Chord recognition failed: ${error}`,
        chord_name: chord_name,
      };
    }
  },
});

// Songwriting suggestion tool
const songwritingSuggestionTool = tool({
  name: 'songwriting_suggestion',
  description: 'Provide songwriting suggestions including chord progressions, lyrics ideas, and song structure',
  parameters: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['pop', 'rock', 'folk', 'blues', 'jazz', 'country', 'indie'],
        description: 'Musical style or genre',
      },
      mood: {
        type: 'string',
        enum: ['happy', 'sad', 'romantic', 'energetic', 'melancholic', 'uplifting', 'mysterious'],
        description: 'Emotional mood of the song',
      },
      key: {
        type: 'string',
        description: 'Musical key (optional)',
      },
    },
    required: ['style', 'mood'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { style, mood, key } = input as { style: string; mood: string; key?: string };
    
    try {
      const suggestions: Record<string, any> = {
        'pop': {
          happy: {
            progression: 'C-G-Am-F',
            structure: 'Verse-Chorus-Verse-Chorus-Bridge-Chorus',
            lyrics_theme: 'Love, friendship, celebration',
            tempo: '120-140 BPM'
          },
          sad: {
            progression: 'Am-F-C-G',
            structure: 'Verse-Verse-Chorus-Verse-Chorus-Bridge-Chorus',
            lyrics_theme: 'Heartbreak, longing, reflection',
            tempo: '80-100 BPM'
          }
        },
        'rock': {
          energetic: {
            progression: 'Em-C-G-D',
            structure: 'Intro-Verse-Chorus-Verse-Chorus-Solo-Chorus-Outro',
            lyrics_theme: 'Rebellion, freedom, power',
            tempo: '140-160 BPM'
          },
          melancholic: {
            progression: 'Am-F-C-G',
            structure: 'Verse-Chorus-Verse-Chorus-Bridge-Chorus',
            lyrics_theme: 'Angst, struggle, introspection',
            tempo: '100-120 BPM'
          }
        },
        'folk': {
          uplifting: {
            progression: 'C-Am-F-G',
            structure: 'Verse-Verse-Chorus-Verse-Chorus',
            lyrics_theme: 'Nature, hope, community',
            tempo: '90-110 BPM'
          },
          romantic: {
            progression: 'G-Em-C-D',
            structure: 'Verse-Chorus-Verse-Chorus-Bridge-Chorus',
            lyrics_theme: 'Love, relationships, connection',
            tempo: '80-100 BPM'
          }
        },
        'blues': {
          melancholic: {
            progression: 'A7-D7-A7-A7-D7-D7-A7-A7-E7-D7-A7-E7',
            structure: '12-bar blues pattern',
            lyrics_theme: 'Struggle, emotion, life experiences',
            tempo: '100-120 BPM'
          }
        }
      };

      const styleData = suggestions[style];
      const moodData = styleData?.[mood];

      if (moodData) {
        return {
          success: true,
          style: style,
          mood: mood,
          key: key || 'C',
          suggestion: {
            chord_progression: moodData.progression,
            song_structure: moodData.structure,
            lyrics_theme: moodData.lyrics_theme,
            tempo: moodData.tempo,
            tips: [
              'Start with the chord progression to establish the mood',
              'Write lyrics that match the emotional tone',
              'Consider the song structure for flow and impact',
              'Experiment with different strumming patterns',
              'Add dynamics (soft/loud) for emotional impact'
            ]
          }
        };
      } else {
        return {
          success: false,
          message: `I don't have specific suggestions for ${style} in ${mood} mood. Try common combinations like pop-happy, rock-energetic, or folk-romantic.`,
          available_combinations: Object.keys(suggestions).flatMap(s => 
            Object.keys(suggestions[s]).map(m => `${s}-${m}`)
          )
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Songwriting suggestion failed: ${error}`,
        style: style,
        mood: mood,
      };
    }
  },
});

// Music theory tool
const musicTheoryTool = tool({
  name: 'music_theory_help',
  description: 'Provide music theory explanations and help with scales, intervals, and harmony',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        enum: ['scales', 'intervals', 'harmony', 'chord_construction', 'circle_of_fifths'],
        description: 'Music theory topic to explain',
      },
      key: {
        type: 'string',
        description: 'Musical key (optional, for scale-related topics)',
      },
    },
    required: ['topic'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { topic, key } = input as { topic: string; key?: string };
    
    try {
      const explanations: Record<string, any> = {
        'scales': {
          major: 'C-D-E-F-G-A-B-C (W-W-H-W-W-W-H)',
          minor: 'A-B-C-D-E-F-G-A (W-H-W-W-H-W-W)',
          pentatonic_major: 'C-D-E-G-A-C',
          pentatonic_minor: 'A-C-D-E-G-A',
          blues: 'A-C-D-Eb-E-G-A'
        },
        'intervals': {
          unison: 'Same note (0 semitones)',
          minor_second: '1 semitone (e.g., C to C#)',
          major_second: '2 semitones (e.g., C to D)',
          minor_third: '3 semitones (e.g., C to Eb)',
          major_third: '4 semitones (e.g., C to E)',
          perfect_fourth: '5 semitones (e.g., C to F)',
          tritone: '6 semitones (e.g., C to F#)',
          perfect_fifth: '7 semitones (e.g., C to G)',
          minor_sixth: '8 semitones (e.g., C to Ab)',
          major_sixth: '9 semitones (e.g., C to A)',
          minor_seventh: '10 semitones (e.g., C to Bb)',
          major_seventh: '11 semitones (e.g., C to B)',
          octave: '12 semitones (e.g., C to C)'
        },
        'chord_construction': {
          major_triad: 'Root + Major 3rd + Perfect 5th',
          minor_triad: 'Root + Minor 3rd + Perfect 5th',
          dominant_7th: 'Major triad + Minor 7th',
          major_7th: 'Major triad + Major 7th',
          minor_7th: 'Minor triad + Minor 7th'
        }
      };

      const explanation = explanations[topic];
      if (explanation) {
        return {
          success: true,
          topic: topic,
          key: key || 'C',
          explanation: explanation,
          tips: [
            'Practice scales daily to improve finger dexterity',
            'Learn intervals to understand chord construction',
            'Study chord progressions to understand song structure',
            'Experiment with different voicings and inversions'
          ]
        };
      } else {
        return {
          success: false,
          message: `I don't have information about "${topic}". Available topics: ${Object.keys(explanations).join(', ')}`,
          available_topics: Object.keys(explanations)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Music theory help failed: ${error}`,
        topic: topic,
      };
    }
  },
});

export const musicalCompanionAgent = new RealtimeAgent({
  name: 'musicalCompanionAgent',
  voice: 'shimmer',
  instructions: `
You are a knowledgeable and enthusiastic musical companion AI, specialized in guitar, songwriting, and music theory. You help musicians with chord recognition, songwriting suggestions, and music theory explanations.

# Initial Greeting
When the conversation starts or when you first connect, immediately greet the user with their name warmly and enthusiastically. Say that you are ready to help them with thier music. For example: "Hey Sebastian! Let's get started with some music!"

# Memory and Context
You have access to memories from previous conversations. When the session starts, you may receive memories in the format "[Memory: topic] content". Review these to understand the user's preferences, name,  favorite chords, musical style, or other relevant information. Use retrieve_memories to recall additional information when needed. When the user shares important information (like favorite genres, skill level, preferences, or personal facts), use store_memory to save it for future conversations. The system may also automatically extract some information, but you should still use store_memory for important details.

# Your Expertise
- Guitar chord recognition and fingerings
- Songwriting suggestions and chord progressions
- Music theory explanations (scales, intervals, harmony)
- Song structure and arrangement advice
- Lyric writing tips and themes
- Different musical styles and genres

# How to Use Your Tools
- Use recognize_guitar_chord for chord information and fingerings
- Use songwriting_suggestion for creative songwriting help
- Use music_theory_help for theory explanations and learning
- Use search_web to find current information, recent music news, new songs, artist information, or any up-to-date content
- Use store_memory to save user preferences, favorite chords, musical interests, or skill level
- Use retrieve_memories to recall information from previous conversations

# Guidelines
- Be encouraging and supportive of musical creativity
- Provide practical, actionable advice
- Explain music theory in accessible terms
- Suggest chord progressions that work well together
- Help with song structure and arrangement
- Be enthusiastic about music and creativity
- Remember user preferences and refer to them when relevant

# Examples
- "What's the fingering for C major?" → Use recognize_guitar_chord
- "I want to write a happy pop song" → Use songwriting_suggestion
- "Explain major scales" → Use music_theory_help
- "What chords go well with Am?" → Use recognize_guitar_chord and provide progression suggestions
- User says "I love jazz" → Use store_memory to save this preference
- User asks "What's my favorite genre?" → Use retrieve_memories to recall

# Response Style
- Give shorter more concise responses, especially when responding to questions.
- Be enthusiastic and encouraging
- Use musical terminology appropriately
- Provide practical tips and exercises
- Suggest creative ideas and experiments
- Be supportive of different skill levels
`,
  tools: [recognizeChordTool, songwritingSuggestionTool, musicTheoryTool, webSearchTool, ...createMemoryTools('musicalCompanion')],
  handoffs: [],
  handoffDescription: 'Musical companion AI for guitar, songwriting, and music theory',
});

export const musicalCompanionScenario = [musicalCompanionAgent];
