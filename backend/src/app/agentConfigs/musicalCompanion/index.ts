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
import { searchSpotifyTrack } from '../../lib/spotifySearch';
import { getMusicState } from '../../lib/musicState';
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
      const limited = progressions.slice(0, 2).map((p) => ({
        name: p.name,
        chords: p.chords.join(' → '),
        chord_list: p.chords,
        description: p.description,
      }));
      const firstProg = limited[0];
      const sayAloud = firstProg
        ? `Try ${firstProg.chords} for a ${styleNorm} feel in ${keyRoot}.`
        : null;
      return {
        success: true,
        key: keyRoot,
        style: styleNorm,
        complexity: comp,
        progressions: limited,
        say_aloud: sayAloud,
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
        const sayAloud = `For ${style} ${mood}, try ${moodData.progression}. ${moodData.tempo}. I can share structure and lyrics ideas if you'd like.`;
        return {
          success: true,
          style: style,
          mood: mood,
          key: key || 'C',
          say_aloud: sayAloud,
          suggestion: {
            chord_progression: moodData.progression,
            song_structure: moodData.structure,
            lyrics_theme: moodData.lyrics_theme,
            tempo: moodData.tempo,
            tip: 'Start with the chord progression, then match lyrics to the mood.',
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

// Display a chord or scale on the user's guitar tab (frontend). Use when the user asks to see a chord or scale.
const displayGuitarChordTool = tool({
  name: 'display_guitar_chord',
  description: 'Show a chord or scale on the user\'s guitar tab display. Use when the user asks to see or display a chord (e.g. "show me G minor", "display A major") or a scale (e.g. "show me the G major scale", "display A dorian scale"). For chords send the chord name (e.g. "G minor", "Em", "F major 7"). For scales you must include the word "scale" in the value (e.g. "G major scale", "A dorian scale", "E minor scale", "C major pentatonic scale") so the diagram shows scale positions and modes. Use close: true only when the user asks to close or hide the display.',
  parameters: {
    type: 'object',
    properties: {
      chord: {
        type: 'string',
        description: 'Chord or scale to display. Chords: "G minor", "Em", "C major 7", "A flat minor". Scales: include "scale" (e.g. "G major scale", "A dorian scale", "E minor scale", "C lydian scale", "F mixolydian scale", "D minor pentatonic scale"). Frontend normalizes and supports all modes (dorian, phrygian, lydian, mixolydian, aeolian, locrian) and pentatonics.',
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
        const sayAloudMap: Record<string, string> = {
          circle_of_fifths: "It's the order of keys by fifths: C, G, D, A... Keys next to each other share most notes.",
          scales: "Major scale is C-D-E-F-G-A-B. Minor has a different pattern. Want me to go deeper?",
          intervals: "Intervals are the distance between notes - like major third is 4 semitones. Want details?",
          harmony: "Chords in a key follow I, ii, iii, IV, V, vi, vii. Dominant resolves to tonic.",
          chord_construction: "Major is root plus major 3rd plus 5th. Want the full breakdown?",
        };
        const sayAloud = sayAloudMap[topic] ?? "Here's the gist - want me to go deeper?";
        return {
          success: true,
          topic: topic,
          key: key || 'C',
          explanation: explanation,
          say_aloud: sayAloud,
          tip: 'Practice daily to improve. Ask for more detail if you want to go deeper.',
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

// Play a specific song on the user's Spotify (frontend must be connected to Spotify).
// Tool runs in iframe: fetches backend search API, then sends play command to parent.
const playSpotifyTrackTool = tool({
  name: 'play_spotify_track',
  description: 'Play a specific song on the user\'s Spotify. Use when the user asks to play a song, artist, or track by name (e.g. "play Bohemian Rhapsody", "play something by Taylor Swift", "play Blinding Lights"). The user must have connected Spotify in the app (Premium required). You send a search query; the app finds the best match and starts playback.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for the song (e.g. "Bohemian Rhapsody Queen", "Blinding Lights The Weeknd", "Shake It Off Taylor Swift"). Can be song name, song + artist, or artist + song.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { query } = input as { query: string };
    const q = (query ?? '').trim();
    if (!q) {
      return { success: false, message: 'Please specify a song or artist to play (e.g. "Bohemian Rhapsody" or "Blinding Lights The Weeknd").' };
    }
    try {
      const result = await searchSpotifyTrack(q);
      if (!result) {
        return {
          success: false,
          message: 'No tracks found. Try a different search or check that Spotify is configured.',
          query: q,
        };
      }
      postClientAction('music_play_track', {
        uri: result.uri,
        trackName: result.trackName,
        artists: result.artists,
        albumArtUrl: result.albumArtUrl,
        durationMs: result.durationMs,
      });
      return {
        success: true,
        uri: result.uri,
        trackName: result.trackName,
        artists: result.artists,
        message: result.artists ? `Playing "${result.trackName}" by ${result.artists}.` : `Playing "${result.trackName}".`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Spotify search failed: ${msg}`,
        query: q,
      };
    }
  },
});

/** Split queries by comma, " and ", or " then ". */
function parseQueueQueries(input: string): string[] {
  return input
    .replace(/\s+and\s+/gi, '|')
    .replace(/\s+then\s+/gi, '|')
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Search and get track with URI for queue add. */
async function searchAndGetQueueItem(query: string): Promise<{ uri: string; title: string; artist: string; albumArtUrl?: string; durationMs?: number } | null> {
  const result = await searchSpotifyTrack(query);
  if (!result?.trackName) return null;
  return {
    uri: result.uri,
    title: result.trackName,
    artist: result.artists,
    albumArtUrl: result.albumArtUrl,
    durationMs: result.durationMs,
  };
}

// Add one or more songs to the queue; frontend MusicController starts playback if nothing is playing.
const spotifyQueueAddTool = tool({
  name: 'spotify_queue_add',
  description:
    'Add songs to the Spotify queue and start playing. Use when the user asks to play multiple songs (e.g. "play A, B, and C", "play Song A then Song B", "queue these: X, Y, Z") or add to queue ("add X to the queue", "queue X", "play X next"). Each song goes in as a separate query. If nothing is playing, playback starts immediately with the first song.',
  parameters: {
    type: 'object',
    properties: {
      queries: {
        type: 'string',
        description:
          'One or more song/artist queries, separated by commas or "and" (e.g. "Blinding Lights", "Shape of You Ed Sheeran", "Song A and Song B").',
      },
    },
    required: ['queries'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { queries } = input as { queries: string };
    const list = parseQueueQueries((queries ?? '').trim());
    console.log('[spotify_queue_add] input:', queries, 'parsed:', list);
    if (list.length === 0) {
      return { success: false, message: 'Specify at least one song to add (e.g. "Blinding Lights" or "Song A, Song B").' };
    }
    const items: { uri: string; title: string; artist: string; albumArtUrl?: string; durationMs?: number }[] = [];
    for (const q of list) {
      const item = await searchAndGetQueueItem(q);
      if (!item) console.warn('[spotify_queue_add] no track found for:', q);
      if (item) items.push(item);
    }
    if (items.length === 0) {
      return { success: false, message: 'No tracks found. Try different song names.' };
    }
    console.log('[spotify_queue_add] posting items:', items.length);
    postClientAction('music_add_to_queue', {
      items: items.map((it) => ({
        uri: it.uri,
        title: it.title,
        artist: it.artist,
        albumArtUrl: it.albumArtUrl,
        durationMs: it.durationMs,
      })),
    });
    return {
      success: true,
      added: items.length,
      message: `Added ${items.length} song(s) to the queue.`,
    };
  },
});

/** Get music state; retries once after 300ms if empty (handles race with music_state_update after queue-add). */
async function getMusicStateWithRetry(): Promise<ReturnType<typeof getMusicState>> {
  let state = getMusicState();
  if (state.queue.length > 0 || state.nowPlaying) return state;
  await new Promise((r) => setTimeout(r, 300));
  return getMusicState();
}

// Get the current queue (read-only, from frontend MusicController shadow state).
const spotifyQueueGetTool = tool({
  name: 'spotify_queue_get',
  description:
    'Get the current Spotify queue. Use when the user asks what is in the queue, what song is next, what is coming up, list the queue, show me the queue, or similar questions about what songs are queued.',
  parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  execute: async () => {
    const { queue, currentIndex, nowPlaying, status } = await getMusicStateWithRetry();
    const isPlaying = status === 'playing';
    const list = queue.map((item, i) => ({
      position: i + 1,
      name: item.title,
      artist: item.artist || undefined,
    }));
    const nextUp = list.length > 0 ? { name: list[0].name, artist: list[0].artist } : null;
    return {
      success: true,
      isPlaying,
      count: list.length,
      queue: list,
      nextUp,
      nowPlaying: nowPlaying ? `${nowPlaying.title}${nowPlaying.artist ? ` by ${nowPlaying.artist}` : ''}` : null,
      message:
        list.length === 0
          ? 'The queue is empty.'
          : isPlaying
            ? `Playing. ${list.length} song(s) queued. Next up: "${list[0].name}"${list[0].artist ? ` by ${list[0].artist}` : ''}.`
            : `${list.length} song(s) in queue. Next up: "${list[0].name}"${list[0].artist ? ` by ${list[0].artist}` : ''}.`,
    };
  },
});

// Remove a song from the queue by position or name.
const spotifyQueueRemoveTool = tool({
  name: 'spotify_queue_remove',
  description: 'Remove a song from the queue. Identify by 1-based position (e.g. "remove the second song") or by name (e.g. "remove Blinding Lights").',
  parameters: {
    type: 'object',
    properties: {
      position: { type: 'number', description: '1-based position in queue (1 = next song).' },
      track_name: { type: 'string', description: 'Track name or partial name to remove.' },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { position, track_name } = input as { position?: number; track_name?: string };
    const { queue } = getMusicState();
    if (position != null && position >= 1) {
      const index = position - 1;
      if (index >= 0 && index < queue.length) {
        postClientAction('music_remove_at', { index });
        return { success: true, message: `Removed song at position ${position}.` };
      }
      return { success: false, message: 'Position out of range.' };
    }
    if (track_name && String(track_name).trim()) {
      const q = (track_name as string).trim().toLowerCase();
      const idx = queue.findIndex(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.artist.toLowerCase().includes(q)
      );
      if (idx >= 0) {
        postClientAction('music_remove_at', { index: idx });
        return { success: true, message: `Removed "${track_name}" from the queue.` };
      }
      return { success: false, message: `"${track_name}" not found in queue.` };
    }
    return { success: false, message: 'Specify position or track name to remove.' };
  },
});

// Reorder the queue.
const spotifyQueueReorderTool = tool({
  name: 'spotify_queue_reorder',
  description:
    'Reorder the queue. Use move_to_front (1-based index to move to next), swap (two 1-based indices), or new_order (array of 1-based indices).',
  parameters: {
    type: 'object',
    properties: {
      move_to_front: { type: 'number', description: '1-based index of song to move to play next.' },
      swap: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'Two 1-based indices to swap.',
      },
      new_order: {
        type: 'array',
        items: { type: 'number' },
        description: '1-based indices in new order.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { move_to_front, swap, new_order } = input as {
      move_to_front?: number;
      swap?: [number, number];
      new_order?: number[];
    };
    const { queue } = getMusicState();
    if (move_to_front != null && move_to_front >= 1 && move_to_front <= queue.length) {
      const fromIdx = move_to_front - 1;
      postClientAction('music_move', { from: fromIdx, to: 0 });
      return { success: true, message: `Moved position ${move_to_front} to front.` };
    }
    if (Array.isArray(swap) && swap.length === 2 && swap[0] >= 1 && swap[1] >= 1 && swap[0] <= queue.length && swap[1] <= queue.length) {
      postClientAction('music_move', { from: swap[0] - 1, to: swap[1] - 1 });
      return { success: true, message: `Swapped positions ${swap[0]} and ${swap[1]}.` };
    }
    if (Array.isArray(new_order) && new_order.length === queue.length) {
      for (let i = 0; i < new_order.length; i++) {
        const to = new_order[i] - 1;
        if (to !== i) {
          postClientAction('music_move', { from: i, to });
          break;
        }
      }
      return { success: true, message: 'Queue reordered.' };
    }
    return { success: false, message: 'Specify move_to_front, swap, or new_order.' };
  },
});

// Clear the entire queue.
const spotifyQueueClearTool = tool({
  name: 'spotify_queue_clear',
  description: 'Clear the Spotify queue. Current song keeps playing; when it ends, Spotify stops.',
  parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  execute: async () => {
    postClientAction('music_clear');
    return { success: true, message: 'Queue cleared.' };
  },
});

// Start playing from the queue (when queue has items but nothing is playing).
const spotifyQueuePlayTool = tool({
  name: 'spotify_queue_play',
  description:
    'Start playing the Spotify queue. Use when the user says "play the queue", "start the queue", or "play" and the queue already has songs but nothing is playing.',
  parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  execute: async () => {
    const { queue, status, nowPlaying } = getMusicState();
    if (status === 'playing') {
      return { success: true, message: 'Already playing.' };
    }
    if (queue.length > 0) {
      postClientAction('music_play_index', { index: 0 });
      return { success: true, message: 'Playing from the queue.' };
    }
    if (status === 'paused' && nowPlaying) {
      postClientAction('music_resume');
      return { success: true, message: 'Resuming playback.' };
    }
    return { success: false, message: 'Queue is empty. Add songs first (e.g. "play Song A, Song B").' };
  },
});

// Play backing track from library based on user's criteria
const playBackingTrackTool = tool({
  name: 'play_backing_track',
  description: 'Search the backing track library and play a track that matches the user\'s criteria (BPM, genre, key, scales). Use when the user asks to play a backing track for practice, jamming, or soloing (e.g. "play a blues track in A minor", "backing track around 90 bpm", "rock track in E").',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Natural language description of the desired backing track (e.g. "blues in A minor around 90 bpm", "rock track in E", "jazz track at 120"). Can include key, genre, BPM, and/or scales.',
      },
    },
    required: ['command'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { command } = input as { command: string };
    try {
      // Dynamic import so fs/promises is only loaded on server when tool runs
      const { findBestBackingTrack } = await import('../../lib/backingTrackMatcher');
      const result = await findBestBackingTrack(command);
      
      if (!result.filename) {
        return {
          success: false,
          message: result.explanation,
          criteria: result.criteria,
        };
      }
      
      // Send play command to frontend
      postClientAction('play_backing_track', { 
        filename: result.filename,
        metadata: result.metadata,
      });
      
      return {
        success: true,
        filename: result.filename,
        metadata: result.metadata,
        message: result.explanation,
        criteria: result.criteria,
      };
    } catch (error) {
      return {
        success: false,
        error: `Backing track search failed: ${error}`,
        command,
      };
    }
  },
});

export const musicalCompanionAgent = new RealtimeAgent({
  name: 'musicalCompanionAgent',
  voice: 'shimmer', // High-pitched, cute desktop robot
  instructions: `
You are a knowledgeable and enthusiastic musical companion AI, specialized in guitar, songwriting, and music theory. You help musicians with chord recognition, songwriting suggestions, and music theory explanations.

# Voice and Brevity (Critical)
You are speaking aloud. Users cannot skim. Keep each reply to 1–3 sentences unless they explicitly ask for more.
- Never read out lists of more than 2–3 items. Pick the best one or two and say those.
- Sound like a friend chatting, not a lecturer. Avoid formal transitions like "Furthermore" or "Additionally."
- Give the gist in one sentence, then offer to go deeper.
- Bad: "C major consists of the notes C, E, and G. The theory is root plus major third plus perfect fifth. The fingering is..." Good: "C major is C, E, and G - I'll show you the fingering on the tab."

# Initial Greeting
When the conversation starts or when you first connect, immediately greet the user with their name warmly and enthusiastically. Say that you are ready to help them with their music. For example: "Hey Sebastian! Let's get started with some music!"

# Memory and Context
You have access to memories from previous conversations. When the session starts, you may receive memories in the format "[Memory: topic] content". Review these to understand the user's preferences, name, favorite chords, musical style, or other relevant information. Use retrieve_memories to recall additional information when needed. When the user shares important information (like favorite genres, skill level, preferences, or personal facts), use store_memory to save it for future conversations. The system may also automatically extract some information, but you should still use store_memory for important details.

# Your Expertise
- Guitar chord recognition and fingerings
- Songwriting suggestions and chord progressions
- Music theory explanations (scales, intervals, harmony)
- Song structure and arrangement advice
- Lyric writing tips and themes
- Different musical styles and genres

# Guitar Tab Display
When the user asks to see or display a chord (e.g. "show me G minor", "display A major"), use display_guitar_chord with the chord name. When they ask for a scale (e.g. "show me the G major scale", "display A dorian scale"), use display_guitar_chord with a value that includes the word "scale" (e.g. "G major scale", "A dorian scale") so the diagram shows scale positions. If they ask to close or hide the display, use display_guitar_chord with close: true.

# How to Use Your Tools
- When a tool returns say_aloud, prefer using it as your spoken reply - it is already brief and speech-optimized.
- When a tool returns multiple items (e.g. progressions, chords), pick the single best one to mention aloud. Do not enumerate all of them. The user can ask for more.
- For tools that return progressions[], explanation objects, or tips[]: summarize in one sentence, do not read the full structure.
- Use recognize_guitar_chord for chord information, notes, and theory (supports triads, 7ths, maj7, m7, dim, aug, sus2, sus4, add9, 9, 11, 13)
- Use suggest_chord_progression to suggest progressions in a key and style (pop, rock, jazz, folk, R&B, country) at basic, intermediate, or advanced complexity; use this when the user wants chord progressions, "what chords go together", or more complex/interesting progressions
- Use songwriting_suggestion for creative songwriting help (structure, lyrics themes, tempo)
- Use music_theory_help for theory explanations (scales, intervals, harmony, chord construction, circle of fifths)
- Use set_metronome_bpm when the user asks for a metronome: pass a genre (e.g. "rumba", "salsa", "waltz", "bossa nova", "ballad") or a specific bpm (40–240). You send the BPM to the frontend; the metronome starts automatically. Do NOT say the words "stop" or "pause" in your reply (the frontend hears the agent and would stop the metronome); say they can control it with voice instead.
- Use play_spotify_track when the user asks to play ONE song (e.g. "play Bohemian Rhapsody"). Use spotify_queue_add when the user asks to play MULTIPLE songs (e.g. "play A, B, and C", "play Song A then Song B", "queue X, Y, Z")—pass each song as a separate query in one string. Use spotify_queue_get when the user asks what is in the queue, what song is next, what is coming up, or to list the queue. Use spotify_queue_play when the user says "play the queue" or "start the queue" and the queue has items. Use spotify_queue_remove, spotify_queue_reorder, and spotify_queue_clear for queue management. The user must have connected Spotify in the app (Premium required).
- Use play_backing_track when the user asks to play a backing track for practice, jamming, or soloing. Pass a natural language command describing what they want (e.g. "blues in A minor around 90 bpm", "rock track in E", "jazz at 120"). The tool searches the library, finds the best match, and starts playing automatically. The backing track loops until they say "stop" or use voice controls.
- Use search_web to find current information, recent music news, new songs, artist information, or any up-to-date content
- Use store_memory to save user preferences, favorite chords, musical interests, or skill level
- Use retrieve_memories to recall information from previous conversations

# Guidelines
- Be encouraging in tone, not length. A warm "Try that!" is enough. Don't pad replies with extra praise.
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
- "Play Bohemian Rhapsody" (one song) → play_spotify_track. "Play A, B, and C" / "Play Song A then Song B" / "Queue these: X, Y, Z" → spotify_queue_add with queries "A, B, C" (or "Song A, Song B" etc). "What's in the queue?" / "What song is next?" / "What's coming up?" → spotify_queue_get. "Play the queue" → spotify_queue_play. "Remove the second song" / "Clear the queue" → spotify_queue_remove / spotify_queue_clear.
- "Play a blues backing track" / "I want to jam in A minor" / "Backing track in E around 90 bpm" / "Play something for rock soloing" → Use play_backing_track with a command describing the desired track
- User says "I love jazz" → Use store_memory to save this preference
- User asks "What's my favorite genre?" → Use retrieve_memories to recall

# Example Replies (aim for this style)
- User: "What's in F#m7?" → "F#m7 has F#, A, C#, and E. Want me to show the fingering?"
- User: "Give me a chord progression in G" → "Try G, Em, C, D - classic pop. I can suggest more if you'd like."
- User: "Explain the circle of fifths" → "It's the order of keys by fifths: C, G, D, A... Keys next to each other share most notes. Want me to go deeper?"

# Response Style
- Default to short, conversational answers: 1–3 sentences for most questions. Sound like a helpful friend, not a textbook.
- Before giving a long or theory-heavy explanation, offer it instead of dumping it. For example: give a one-sentence answer, then ask "Want me to go deeper on that?" or "I can explain the theory behind that if you'd like."
- Only give longer, in-depth explanations when the user clearly asks for more (e.g. "explain more," "why?," "how does that work?," or "tell me more") or when their question is explicitly about learning in detail.
- Be enthusiastic and encouraging. Use musical terminology when it helps, but keep the main reply concise.
- Suggest creative ideas and next steps in a sentence or two; don't over-explain unless asked.
`,
  tools: [recognizeChordTool, suggestChordProgressionTool, songwritingSuggestionTool, musicTheoryTool, setMetronomeBpmTool, displayGuitarChordTool, playSpotifyTrackTool, spotifyQueueAddTool, spotifyQueueGetTool, spotifyQueuePlayTool, spotifyQueueRemoveTool, spotifyQueueReorderTool, spotifyQueueClearTool, playBackingTrackTool, webSearchTool, ...createMemoryTools('musicalCompanion')],
  handoffs: [],
  handoffDescription: 'Musical companion AI for guitar, songwriting, and music theory',
});

export const musicalCompanionScenario = [musicalCompanionAgent];
