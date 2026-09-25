# 🎧 Auto-DJ Studio — Self-Mixing Music Player & Live Mashup Controller

A web-based Auto-DJ system powered by the **Web Audio API** and **React**, built to seamlessly mix tracks with authentic DJ deck feel, speed protection, and real-time mashup capabilities.

Target Playlist: [YouTube Playlist: Desi Hip-Hop Extended Set (39 Tracks)](https://www.youtube.com/watch?v=2JzQhcSc2pM&list=PLcegabezDO5E)

---

## 🌟 Key Features

### 1. Dual Professional DJ Decks
- **Interactive Turntables**: Real vinyl physics with click-and-drag scratch simulation.
- **Dynamic 4-Beat Bar Grid**: Downbeat detection with real-time visual pulse sync.
- **Hardware-Style CUE Buttons**: Hold-to-preview and stutter-cueing on beat grids.
- **Equal-Power Crossfader**: Mathematical sinusoidal blend curve preventing volume dips.
- **3-Band Isolator EQ**: Low shelf (250Hz), Peaking Mid (1.2kHz), and High shelf (4kHz).

### 2. Live Mashup Mode
- **No Long Waits**: Automatically loops high-energy sections (configurable: 25s, 35s, 50s) and jumps to hot drop points (Verse 1, Hook/Chorus, Drop 2).
- **Smooth 6.5s Phrase Transitions**: Seamlessly blends incoming beats and vocals over 6.5 seconds for a natural musical transition.
- **Instant "DROP NEXT NOW"**: Manually trigger an immediate phrase drop on the incoming track without waiting.

### 3. 🕺 Disco Beat Mashup Mode
- **128 BPM Fast Disco Groove**: Plays a driving disco funk drum beat underneath in a continuous loop.
- **Live DJ Vocal Isolation EQ**: Automatically carves out low-end bass and kick (-12 dB) from the hip-hop tracks and boosts vocal frequencies (+4.5 dB), letting the playlist's rap vocals glide cleanly on top of the disco rhythm.

### 4. Audio Quality & DJ Best Practices
- **EBU R128 Mastered**: All 39 tracks loudness-normalized to -14 LUFS (true peak -1.5 dBFS) for zero volume jumps.
- **Speed Protection Rule**: Tracks are **never slowed down below 1.0x** to prevent dragging or muddy audio. Slower tracks are dropped on natural rhythm, and upward tempo matching is capped at +5% (≤1.05x).

---

## 🚀 Getting Started

### Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### Production Build
```bash
npm run build
```

