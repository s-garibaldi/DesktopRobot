# Emotion System: How It Works

## Overview

The emotion system allows the robot face to react to user input and conversation state. Here's the complete flow:

## Architecture Flow

```
┌─────────────────────────────────────────────────────────┐
│  User Types/Speaks                                      │
│  "I'm so excited about this!"                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (Next.js - localhost:3000)                    │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  bridge.js (in public/bridge.js)                 │ │
│  │                                                   │ │
│  │  1. Monitors user input text                     │ │
│  │     - Watches transcript elements                │ │
│  │     - Watches input fields                       │ │
│  │     - Watches DOM changes                        │ │
│  │                                                   │ │
│  │  2. detectEmotionFromUserInput(text)             │ │
│  │     - Scans for keywords:                        │ │
│  │       * "excited" → 'excited'                    │ │
│  │       * "happy", "great" → 'happy'               │ │
│  │       * "sad", "problem" → 'sad'                 │ │
│  │       * "think", "hmm" → 'thinking'              │ │
│  │       * "confused", "what" → 'confused'          │ │
│  │       * "wow", "surprised" → 'surprised'         │ │
│  │                                                   │ │
│  │  3. Sends postMessage to parent:                 │ │
│  │     window.parent.postMessage({                  │ │
│  │       type: 'emotion_suggestion',                │ │
│  │       emotion: 'excited',                        │ │
│  │       source: 'user_input'                      │ │
│  │     })                                           │ │
│  └───────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ postMessage API
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend (Tauri - localhost:1420)                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  RealtimeBridge Component                        │ │
│  │                                                   │ │
│  │  1. Listens for messages:                        │ │
│  │     window.addEventListener('message', ...)      │ │
│  │                                                   │ │
│  │  2. Receives emotion_suggestion:                 │ │
│  │     { type: 'emotion_suggestion',                │ │
│  │       emotion: 'excited' }                       │ │
│  │                                                   │ │
│  │  3. Calls handleEmotionChange():                 │ │
│  │     - Debounces (800ms) to prevent rapid changes │ │
│  │     - Calls onEmotionChange('excited')           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  App.tsx (Main Component)                        │ │
│  │                                                   │ │
│  │  const [currentEmotion, setCurrentEmotion] = ... │ │
│  │                                                   │ │
│  │  onEmotionChange('excited') →                    │ │
│  │  setCurrentEmotion('excited')                     │ │
│  │                                                   │ │
│  │  State updates: currentEmotion = 'excited'       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  AnimatedFace Component                          │ │
│  │                                                   │ │
│  │  Receives: emotion={currentEmotion}              │ │
│  │  emotion = 'excited'                             │ │
│  │                                                   │ │
│  │  Looks up emotionConfigs['excited']:             │ │
│  │  - eyeShape, eyebrowShape, mouthShape            │ │
│  │  - Colors, glow effects                          │ │
│  │                                                   │ │
│  │  Redraws canvas with new emotion                 │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Code Flow

### 1. Emotion Detection (Backend)

**File**: `backend/public/bridge.js`

```javascript
// Monitors user input text
function monitorUserInput() {
  // Watches for text changes in transcript
  const observer = new MutationObserver((mutations) => {
    // When user text appears, analyze it
    const text = element.textContent;
    const emotion = detectEmotionFromUserInput(text);
    
    if (emotion) {
      // Send to frontend
      sendToParent('emotion_suggestion', { 
        emotion: emotion, 
        source: 'user_input' 
      });
    }
  });
}

// Keyword detection
function detectEmotionFromUserInput(text) {
  if (text.includes('excited') || text.includes('awesome')) {
    return 'excited';
  }
  if (text.includes('happy') || text.includes('great')) {
    return 'happy';
  }
  // ... more patterns
}
```

### 2. Message Reception (Frontend)

**File**: `frontend/src/components/RealtimeBridge.tsx`

```typescript
// Listen for messages from backend iframe
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.origin === 'http://localhost:3000') {
      const data = event.data;
      
      switch (data.type) {
        case 'emotion_suggestion':
          // Validate and update emotion
          if (data.emotion && ['happy', 'sad', ...].includes(data.emotion)) {
            handleEmotionChange(data.emotion as Emotion, 'user_input');
          }
          break;
      }
    }
  };
  
  window.addEventListener('message', handleMessage);
}, []);
```

### 3. Emotion Change Handler

**File**: `frontend/src/components/RealtimeBridge.tsx`

```typescript
const handleEmotionChange = (emotion: Emotion, source: string) => {
  const now = Date.now();
  const timeSinceLastChange = now - lastEmotionChange;
  
  // Debounce: prevent rapid emotion switching
  if (timeSinceLastChange > 800) {
    console.log(`Emotion: ${currentEmotion} -> ${emotion} (from ${source})`);
    onEmotionChange(emotion);  // Calls parent's setCurrentEmotion
    setLastEmotionChange(now);
  }
};
```

### 4. State Update (App Component)

**File**: `frontend/src/App.tsx`

```typescript
function App() {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  
  return (
    <AnimatedFace emotion={currentEmotion} />
    <RealtimeBridge 
      onEmotionChange={setCurrentEmotion}  // Passes setter down
    />
  );
}
```

### 5. Visual Rendering

**File**: `frontend/src/components/AnimatedFace.tsx`

```typescript
const AnimatedFace: React.FC<AnimatedFaceProps> = ({ emotion }) => {
  // When emotion prop changes, React re-renders
  useEffect(() => {
    // Look up emotion configuration
    const config = emotionConfigs[emotion];
    
    // Draw face with new emotion
    drawFace(canvas, config);
  }, [emotion]);
  
  return <canvas ref={canvasRef} />;
};
```

## Emotion Sources

The emotion can change from multiple sources:

### 1. **User Input Detection** (Primary)
- Backend analyzes user's typed/spoken text
- Detects keywords and patterns
- Sends `emotion_suggestion` message

### 2. **Manual Controls**
- User clicks emotion buttons
- Directly calls `setCurrentEmotion()`
- No backend involvement

### 3. **Conversation State**
- `speech_stopped` → 'neutral'
- `ai_speaking_end` → 'neutral'
- `error` → 'confused'

## Emotion Detection Patterns

**File**: `backend/public/bridge.js` - `detectEmotionFromUserInput()`

| Emotion | Keywords/Patterns |
|---------|------------------|
| **happy** | "happy", "great", "wonderful", "love", "thank you", "yes", "perfect" |
| **sad** | "sad", "sorry", "trouble", "problem", "help", "worried", "struggling" |
| **excited** | "excited", "thrilled", "awesome", "wow", "amazing", "incredible" |
| **thinking** | "let me think", "hmm", "maybe", "considering", "wondering" |
| **confused** | "confused", "what", "how", "don't understand", "explain" |
| **surprised** | "surprised", "wow", "really", "no way", "unbelievable" |
| **neutral** | Default state, when speech stops |

## Debouncing

Emotions are debounced (800ms) to prevent rapid switching:

```typescript
// Only change emotion if 800ms have passed since last change
if (timeSinceLastChange > 800) {
  onEmotionChange(emotion);
}
```

This prevents the face from flickering when multiple emotion keywords appear quickly.

## Visual Configuration

Each emotion has a visual configuration:

**File**: `frontend/src/components/AnimatedFace.tsx`

```typescript
const emotionConfigs = {
  happy: {
    eyeShape: { width: 1.0, height: 1.0, curve: 0 },
    eyebrowShape: { ... },
    mouthShape: { ... },
    eyeColor: '#00FFFF',
    glowColor: '#00FFFF'
  },
  sad: {
    // Different shapes and colors
  },
  // ... etc
};
```

## Summary

1. **User speaks/types** → Backend monitors input
2. **Backend detects emotion** → Keyword matching in `bridge.js`
3. **Backend sends message** → `postMessage` with `emotion_suggestion`
4. **Frontend receives** → `RealtimeBridge` listens for messages
5. **Frontend updates state** → `handleEmotionChange()` → `setCurrentEmotion()`
6. **Face redraws** → `AnimatedFace` receives new `emotion` prop
7. **Visual update** → Canvas redraws with new emotion configuration

The system is **reactive** - emotions change based on what the user says, not what the AI says!
