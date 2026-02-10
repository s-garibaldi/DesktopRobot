# Voice formats and using an ElevenLabs-created voice

## 1. OpenAI “presaved” voices – not files

The OpenAI Realtime API **does not use voice files**. The built-in voices (`shimmer`, `nova`, `alloy`, `echo`, `fable`, `onyx`, `cedar`, `marin`, etc.) are **server-side presets**: you only pass a voice **identifier** in the agent config. There is no file type to analyze for those voices.

### How OpenAI voice audio reaches the backend

- **Transport**: WebRTC (`OpenAIRealtimeWebRTC`).
- **Codec**: By default **Opus** (wideband, 48 kHz). The UI also allows forcing **PCMU** or **PCMA** (8 kHz) for narrowband.
- **Playback**: The remote track is attached to an `<audio>` element via `audioElement.srcObject = mediaStream`. The browser decodes the Opus (or g711) stream and plays it; there is no intermediate “voice file” in our app.
- **Input** (mic → OpenAI): We send PCM16 or g711, depending on the `?codec=` preference (see `codecUtils.ts`).

So in this codebase, “OpenAI voice” = **live stream (Opus over WebRTC)**, not a stored file format.

---

## 2. Creating a voice in ElevenLabs

In ElevenLabs you create a **custom voice** (e.g. Instant Voice Clone), then use its **voice ID** in the backend.

### Creating the voice (ElevenLabs side)

- **API**: `POST https://api.elevenlabs.io/v1/voices/add` (multipart form).
- **Required**: `name` (string), `files` (one or more audio files).
- **Common file types** for the samples: **MP3**, **WAV**, or other formats ElevenLabs accepts for voice cloning (see their [IVC docs](https://elevenlabs.io/docs/api-reference/voices/ivc/create)). Typically short clips (e.g. ~10–30 seconds total) of clear speech.
- **Response**: `voice_id` (string), e.g. `c38kUX8pkfYO2kHyqfFy`. That ID is what we use in the backend; there is no “voice file” to store in our repo.

### “Inputting” that voice into our backend

We don’t upload a file into the backend. We **configure the backend** to use the ElevenLabs voice by setting:

1. **`ELEVEN_LABS_API_KEY`** – Your ElevenLabs API key (for TTS requests).
2. **`ELEVEN_LABS_VOICE_ID`** – The `voice_id` you got when you created the voice (e.g. from the “Create IVC voice” response).

Add these to your backend `.env` (see `.env.example` for a template):

```env
# Optional: use a custom ElevenLabs voice for TTS (when implemented)
ELEVEN_LABS_API_KEY=your_elevenlabs_api_key
ELEVEN_LABS_VOICE_ID=your_voice_id_from_elevenlabs
```

Once the backend is updated to call ElevenLabs TTS (using transcript text + this voice ID), the robot’s spoken output will use your ElevenLabs-created voice instead of (or in addition to) the OpenAI Realtime voice.

---

## 3. Summary

| Source              | “File type” / format                          | How we use it in the backend                          |
|---------------------|-----------------------------------------------|--------------------------------------------------------|
| OpenAI presets      | No files; stream is **Opus** (or g711) over WebRTC | Voice chosen by name in agent config; stream played via `<audio>` |
| ElevenLabs custom   | Creation: upload **audio files** (e.g. MP3/WAV) → get **voice_id** | Use **voice_id** (+ API key) in `.env`; TTS returns audio (e.g. MP3) to play |

So: **analyze “file type” for OpenAI** = stream codec (Opus); **create voice in ElevenLabs** = upload samples (MP3/WAV, etc.) and get `voice_id`; **input into backend** = set `ELEVEN_LABS_VOICE_ID` and `ELEVEN_LABS_API_KEY` in `.env`.
