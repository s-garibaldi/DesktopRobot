import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { createMemoryTools } from '../../lib/memoryTools';
import {
  getChordTheory,
  getDiatonicChords,
  getProgressionsForStyle,
  getAllStyles,
  parseChordName,
  getTempoBpmForGenre,
  CHORD_FORMULAS,
} from '../../lib/musicKnowledge';
import { postClientAction } from '../../lib/bridge';
import { webSearchTool } from '../../lib/webSearchTool';

// Common open-position fingerings (optional; theory works for any chord)
const OPEN_FINGERINGS: Record<string, string> = {
  C: 'x-3-2-0-1-0', Am: 'x-0-2-2-1-0', F: '1-3-3-2-1-1', G: '3-2-0-0-3-3',
  D: 'x-x-0-2-3-2', Em: '0-2-2-0-0-0', G7: '3-2-0-0-0-1', C7: 'x-3-2-3-1-0',
  Dm: 'x-x-0-2-3-1', Bm: 'x-2-4-4-3-2', A: 'x-0-2-2-2-0', E: '0-2-2-1-0-0',
  Am7: 'x-0-2-0-1-0', Dm7: 'x-x-0-2-1-1', Em7: '0-2-0-0-0-0', Cmaj7: 'x-3-2-0-0-0',
  Fmaj7: '1-3-2-2-1-1', Gmaj7: '3-2-0-0-0-2',
};

// Guitar chord recognition tool — uses music knowledge for notes/theory; fingerings when available
const recognizeChordTool = tool({
  name: 'recognize_guitar_chord',
  description: 'Recognize guitar chords and provide chord information, fingerings (when available), and theory. Supports triads, 7ths, maj7, m7, dim, aug, sus2, sus4, add9, 9, 11, 13, and more.',
  parameters: {
    type: 'object',
    properties: {
      chord_name: {
        type: 'string',
        description: 'The name of the guitar chord (e.g. "C", "Am", "F#m7", "Gmaj7", "Dm7b5", "Eadd9", "Bb7")',
      },
    },
    required: ['chord_name'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { chord_name } = input as { chord_name: string };
    try {
      const normalized = chord_name.trim().replace(/\s+/g, '');
      const parsed = parseChordName(normalized);
      const info = parsed ? getChordTheory(parsed.root, parsed.quality) : null;
      if (!info) {
        return {
          success: false,
          message: `I couldn't parse the chord "${chord_name}". Try formats like C, Am, F#m7, Gmaj7, Dm7b5, Eadd9, or Bb13.`,
          supported_types: Object.keys(CHORD_FORMULAS).join(', '),
        };
      }
      const fingering = OPEN_FINGERINGS[info.name] ?? OPEN_FINGERINGS[info.name.replace(/maj7|m7|7/g, (m) => m === 'maj7' ? 'maj7' : m === 'm7' ? 'm7' : '7')];
      return {
        success: true,
        chord: { name: info.name, notes: info.notes, theory: info.theory, fingering: fingering ?? null },
        message: `Here's information about ${info.name}:`,
        details: {
          notes: info.notes.join(' - '),
          theory: info.theory,
          fingering: fingering ?? 'Use the chord diagram in the app for voicings, or try a barre shape.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Chord recognition failed: ${error}`,
        chord_name: chord_name,
      };
    }
  },
});

// Suggest chord progressions by key, style, and complexity
const suggestChordProgressionTool = tool({
  name: 'suggest_chord_progression',
  description: 'Suggest chord progressions in a given key and style, from basic to advanced (jazz, pop, rock, folk, R&B, country). Returns chord names and short descriptions.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Key (e.g. C, G, D, F, Am, Bb, F#)',
      },
      style: {
        type: 'string',
        enum: ['pop', 'rock', 'folk', 'blues', 'jazz', 'country', 'r&b'],
        description: 'Musical style',
      },
      complexity: {
        type: 'string',
        enum: ['basic', 'intermediate', 'advanced'],
        description: 'Complexity level of the progressions',
      },
      use_sevenths: {
        type: 'boolean',
        description: 'Include 7th chords where appropriate (e.g. maj7, m7)',
      },
    },
    required: ['key', 'style'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { key, style, complexity = 'intermediate', use_sevenths = false } = input as {
      key: string; style: string; complexity?: string; use_sevenths?: boolean;
    };
    try {
      const keyRoot = key.trim().replace(/\s+/g, '');
      const comp = (complexity === 'basic' || complexity === 'intermediate' || complexity === 'advanced')
        ? complexity : 'intermediate';
      const styleNorm = style.toLowerCase().replace(/\s+/g, '') === 'r&b' ? 'r&b' : style.toLowerCase();
      let progressions = getProgressionsForStyle(styleNorm, comp as 'basic' | 'intermediate' | 'advanced', keyRoot, use_sevenths);
      if (progressions.length === 0) {
        progressions = getProgressionsForStyle('pop', comp as 'basic' | 'intermediate' | 'advanced', keyRoot, use_sevenths);
      }
      const diatonic = getDiatonicChords(keyRoot);
      return {
        success: true,
        key: keyRoot,
        style: styleNorm,
        complexity: comp,
        progressions: progressions.map((p) => ({
          name: p.name,
          chords: p.chords.join(' → '),
          chord_list: p.chords,
          description: p.description,
        })),
        diatonic_in_key: diatonic ? diatonic.map((d) => `${d.roman} ${d.chord}`).join(', ') : null,
        available_styles: getAllStyles(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Progression suggestion failed: ${error}`,
        key,
        style,
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

// Send BPM to the frontend; frontend sets it and starts the metronome automatically.
const setMetronomeBpmTool = tool({
  name: 'set_metronome_bpm',
  description: 'Set the metronome BPM on the user\'s device and start it. Use when the user asks for a metronome for a style (e.g. rumba, salsa, waltz) or at a specific tempo. You send the BPM number; the frontend sets it and starts the metronome automatically. Do NOT say the words "stop" or "pause" in your reply (the frontend mic would hear them and stop the metronome); say instead that they can control it with voice.',
  parameters: {
    type: 'object',
    properties: {
      bpm: {
        type: 'number',
        description: 'Beats per minute (40–240). Use when user gives a number or when resolving a genre.',
      },
      genre: {
        type: 'string',
        description: 'Optional. Genre name to look up typical BPM (e.g. "rumba", "salsa", "bossa nova", "waltz", "ballad"). If provided, bpm can be omitted and will be set from the genre.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    let bpm: number;
    const { bpm: inputBpm, genre } = input as { bpm?: number; genre?: string };
    if (genre?.trim()) {
      const genreBpm = getTempoBpmForGenre(genre.trim());
      if (genreBpm != null) {
        bpm = genreBpm;
      } else if (typeof inputBpm === 'number' && inputBpm >= 40 && inputBpm <= 240) {
        bpm = Math.round(inputBpm);
      } else {
        return {
          success: false,
          message: `I don't know a typical tempo for "${genre}". Say a BPM (e.g. 120) or try another genre like rumba, salsa, waltz, or ballad.`,
        };
      }
    } else if (typeof inputBpm === 'number' && inputBpm >= 40 && inputBpm <= 240) {
      bpm = Math.round(inputBpm);
    } else {
      return {
        success: false,
        message: 'Please specify a BPM (40–240) or a genre (e.g. rumba, salsa, waltz) for the metronome.',
      };
    }
    const clamped = Math.max(40, Math.min(240, bpm));
    postClientAction('metronome_set_bpm', { bpm: clamped });
    return {
      success: true,
      bpm: clamped,
      message: `Metronome set to ${clamped} BPM and starting. You can control it with voice anytime.`,
    };
  },
});

// Display a chord or scale on the user's guitar tab (frontend). Use when the user asks to see a chord, e.g. "show me G minor", "display A major", "what does Em look like?".
const displayGuitarChordTool = tool({
  name: 'display_guitar_chord',
  description: 'Show a chord or scale on the user\'s guitar tab display. Use when the user asks to see or display a chord (e.g. "show me G minor", "display A major", "what does Em look like?"). Send the chord name as you would say it (e.g. "G minor", "Em", "F major 7", "A flat minor"); the frontend will resolve it and show the diagram. Use close: true only when the user asks to close or hide the chord display.',
  parameters: {
    type: 'object',
    properties: {
      chord: {
        type: 'string',
        description: 'Chord or scale name to display (e.g. "G minor", "Em", "C major 7", "A flat", "D suspended 4"). Can be natural language; frontend normalizes it.',
      },
      close: {
        type: 'boolean',
        description: 'If true, close the guitar tab display and return to the neutral face. Use when user says "close display" or "hide the chord".',
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { chord, close } = input as { chord?: string; close?: boolean };
    if (close === true) {
      postClientAction('guitar_tab_display', { action: 'close' });
      return {
        success: true,
        message: 'Guitar tab display closed.',
      };
    }
    const chordStr = (chord ?? '').trim();
    if (!chordStr) {
      return {
        success: false,
        message: 'Please specify a chord or scale to display (e.g. "G minor", "Em", "C major 7").',
      };
    }
    postClientAction('guitar_tab_display', { action: 'show', chord: chordStr });
    return {
      success: true,
      chord: chordStr,
      message: `Showing ${chordStr} on the guitar tab. Say "close display" to return to the main face.`,
    };
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
          minor_7th: 'Minor triad + Minor 7th',
          diminished: 'Root + Minor 3rd + Diminished 5th',
          augmented: 'Root + Major 3rd + Augmented 5th',
          extended_chords: '9th = 7th + 9th; 11th adds 11th; 13th adds 13th (often omit some notes on guitar)'
        },
        'circle_of_fifths': {
          order: 'C → G → D → A → E → B → F#/Gb → Db → Ab → Eb → Bb → F → C',
          meaning: 'Each step is a perfect 5th up (or 4th down). Keys next to each other share most notes.',
          use: 'Find closely related keys for modulations; order of sharps/flats; diatonic chord families'
        },
        'harmony': {
          diatonic: 'In a key, chords built on each scale degree: I, ii, iii, IV, V, vi, vii°. Uppercase = major, lowercase = minor, ° = diminished.',
          tension_resolution: 'Dominant (V or V7) resolves to tonic (I). ii–V–I is a classic cadence.',
          borrowed_chords: 'Chords from parallel minor in a major key (e.g. bVII, iv) add color.'
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
  voice: 'shimmer', // High-pitched, cute desktop robot
  instructions: `
You are a knowledgeable and enthusiastic musical companion AI, specialized in guitar, songwriting, and music theory. You help musicians with chord recognition, songwriting suggestions, and music theory explanations.

# Initial Greeting
When the conversation starts or when you first connect, immediately greet the user with their name warmly and enthusiastically. Say that you are ready to help them with thier music. For example: "Hey Sebastian! Let's get started with some music!"

# Memory and Context
You have access to memories from previous conversations. When the session starts, you may receive memories in the format "[Memory: topic] content". Review these to understand the user's preferences, name,  favorite chords, musical style, or other relevant information. Use retrieve_memories to recall additional information when needed. When the user shares important information (like favorite genres, skill level, preferences, or personal facts), use store_memory to save it for future conversations. The system may also automatically extract some information, but you should still use store_memory for important details.

# Brevity
Keep replies brief unless the user asks for more. Prefer one clear sentence over a paragraph. If a topic could be explained at length, give the gist first and offer to elaborate.

# Your Expertise
- Guitar chord recognition and fingerings
- Songwriting suggestions and chord progressions
- Music theory explanations (scales, intervals, harmony)
- Song structure and arrangement advice
- Lyric writing tips and themes
- Different musical styles and genres

# Guitar Tab Display
When the user asks to see or display a chord (e.g. "show me G minor", "display A major", "what does Em look like?"), use the display_guitar_chord tool with the chord name. The robot will show the chord diagram on screen. If they ask to close or hide the display, use display_guitar_chord with close: true.

# How to Use Your Tools
- Use recognize_guitar_chord for chord information, notes, and theory (supports triads, 7ths, maj7, m7, dim, aug, sus2, sus4, add9, 9, 11, 13)
- Use suggest_chord_progression to suggest progressions in a key and style (pop, rock, jazz, folk, R&B, country) at basic, intermediate, or advanced complexity; use this when the user wants chord progressions, "what chords go together", or more complex/interesting progressions
- Use songwriting_suggestion for creative songwriting help (structure, lyrics themes, tempo)
- Use music_theory_help for theory explanations (scales, intervals, harmony, chord construction, circle of fifths)
- Use set_metronome_bpm when the user asks for a metronome: pass a genre (e.g. "rumba", "salsa", "waltz", "bossa nova", "ballad") or a specific bpm (40–240). You send the BPM to the frontend; the metronome starts automatically. Do NOT say the words "stop" or "pause" in your reply (the frontend hears the agent and would stop the metronome); say they can control it with voice instead.
- Use search_web to find current information, recent music news, new songs, artist information, or any up-to-date content
- Use store_memory to save user preferences, favorite chords, musical interests, or skill level
- Use retrieve_memories to recall information from previous conversations

# Guidelines
- Be encouraging and supportive; keep answers concise unless the user wants more.
- Give practical, actionable advice in a few sentences; offer to go deeper if relevant.
- When explaining theory, start with the essential idea and ask if they want more detail.
- Suggest chord progressions and structures clearly and briefly.
- Remember user preferences and refer to them when relevant.

# Examples
- "What's the fingering for C major?" or "What notes are in F#m7?" → Use recognize_guitar_chord
- "Give me a chord progression in G" / "Jazz progressions in Bb" / "Something more complex in D" → Use suggest_chord_progression (choose style and complexity as appropriate)
- "What chords go well together?" / "Suggest a progression for a sad song" → Use suggest_chord_progression
- "I want to write a happy pop song" → Use songwriting_suggestion
- "Explain major scales" / "Circle of fifths" → Use music_theory_help; give a one-sentence summary first, then ask "Want me to go deeper on that?"
- "What chords go well with Am?" → Use recognize_guitar_chord for Am, then suggest_chord_progression in A minor or related key
- "Play a metronome for a rumba" / "Metronome at 120" / "Set metronome for waltz" → Use set_metronome_bpm with genre or bpm
- User says "I love jazz" → Use store_memory to save this preference
- User asks "What's my favorite genre?" → Use retrieve_memories to recall

# Response Style
- Default to short, conversational answers: 1–3 sentences for most questions. Sound like a helpful friend, not a textbook.
- Before giving a long or theory-heavy explanation, offer it instead of dumping it. For example: give a one-sentence answer, then ask "Want me to go deeper on that?" or "I can explain the theory behind that if you'd like."
- Only give longer, in-depth explanations when the user clearly asks for more (e.g. "explain more," "why?," "how does that work?," or "tell me more") or when their question is explicitly about learning in detail.
- Be enthusiastic and encouraging. Use musical terminology when it helps, but keep the main reply concise.
- Suggest creative ideas and next steps in a sentence or two; don't over-explain unless asked.
`,
  tools: [recognizeChordTool, suggestChordProgressionTool, songwritingSuggestionTool, musicTheoryTool, setMetronomeBpmTool, displayGuitarChordTool, webSearchTool, ...createMemoryTools('musicalCompanion')],
  handoffs: [],
  handoffDescription: 'Musical companion AI for guitar, songwriting, and music theory',
});

export const musicalCompanionScenario = [musicalCompanionAgent];
