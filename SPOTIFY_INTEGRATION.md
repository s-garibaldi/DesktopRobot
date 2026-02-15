# Spotify API Integration

This project can use the **Spotify Web API** for:

1. **Metadata** – search tracks, get track/album/artist info (no user login).
2. **Playback** – play music in the browser via the **Web Playback SDK** (requires user login + **Spotify Premium**).

---

## 1. Spotify Developer Setup

1. Go to [Spotify for Developers](https://developer.spotify.com/) → **Dashboard**.
2. Create an app (or use an existing one).
3. In the app:
   - Note your **Client ID** and **Client Secret**.
   - Under **Settings** → **Redirect URIs**, add the **exact** callback URL. Spotify does **not** allow `localhost`; use **`127.0.0.1`**:
     - **Tauri app**: `http://127.0.0.1:1420/`
     - **Browser dev**: `http://127.0.0.1:5173/`
     - Prod: `https://yourdomain.com/`
   - If you use **Web Playback SDK**, enable it in the app settings.

---

## 2. Backend (Metadata + Token Exchange)

### Env vars (e.g. `backend/.env`)

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

### API routes

- **`GET /api/spotify/search?q=...&type=track&limit=20`**  
  Proxies Spotify search (uses Client Credentials). No user login.

- **`GET /api/spotify/track/:id`**  
  Returns a single track’s metadata by Spotify ID.

- **`POST /api/spotify/token`**  
  Exchanges PKCE `code` + `code_verifier` for `access_token` and optional `refresh_token`.  
  Body: `{ "code", "code_verifier", "redirect_uri" }`.

Metadata (search + track) works as soon as `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are set. Playback needs a user token from the PKCE flow below.

---

## 3. Frontend

### Metadata (no login)

Use the backend as a proxy:

```tsx
import { useSpotifyMetadata } from '@/spotify';

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';
const { searchTracks, getTrack, loading, error } = useSpotifyMetadata(backendUrl);

// Search
const tracks = await searchTracks('jazz blues', 10);

// Single track
const track = await getTrack('3n3Ppam7vgaVa1iaRUc9Lp');
```

### Playback (user login + Premium)

1. **PKCE login**  
   Generate `code_verifier` and `code_challenge`, redirect the user to Spotify, then on callback exchange `code` + `code_verifier` for a token.

2. **Web Playback SDK**  
   When you have an `access_token`, create a player and start playback.

Example flow:

```tsx
import { useSpotifyPlayer, buildAuthUrl, generatePkce, SPOTIFY_PLAYBACK_SCOPES } from '@/spotify';

// 1) Start login: generate PKCE and redirect
const startLogin = async () => {
  const { codeVerifier, codeChallenge } = await generatePkce();
  sessionStorage.setItem('spotify_code_verifier', codeVerifier);
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID; // optional: if you want login from frontend
  const redirectUri = `${window.location.origin}/spotify-callback`;
  window.location.href = buildAuthUrl({
    clientId,
    redirectUri,
    codeChallenge,
    scopes: SPOTIFY_PLAYBACK_SCOPES,
  });
};

// 2) On /spotify-callback: read ?code=...&state=..., get code_verifier from sessionStorage,
//    POST to your backend POST /api/spotify/token with { code, code_verifier, redirect_uri },
//    then store access_token (e.g. in state or context).

// 3) Use the player with that token
const [token, setToken] = useState<string | null>(null);
const { ready, deviceId, error, play, pause, resume, setVolume } = useSpotifyPlayer(token);

// Play a track by URI
await play('spotify:track:3n3Ppam7vgaVa1iaRUc9Lp');
```

- **`VITE_SPOTIFY_CLIENT_ID`** must be set in the **frontend** `.env`. In the Spotify Dashboard, add the **exact** Redirect URI (use `127.0.0.1`, not `localhost`): Tauri = `http://127.0.0.1:1420/`, browser dev = `http://127.0.0.1:5173/`.

---

## 4. Summary

| Feature        | Auth              | Backend env                    | Frontend                          |
|----------------|-------------------|--------------------------------|-----------------------------------|
| Search / track | Client Credentials| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | `useSpotifyMetadata(backendUrl)`  |
| Playback       | User (PKCE)       | Same + redirect URI in Dashboard | PKCE → `/api/spotify/token` → `useSpotifyPlayer(token)` |

- **Metadata**: set backend env vars and use the backend routes from the frontend (or from the musical companion agent).
- **Playback**: implement a callback page that exchanges the code via `POST /api/spotify/token`, then pass the returned `access_token` into `useSpotifyPlayer`. The user must have Spotify Premium for Web Playback SDK.
