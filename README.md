# 🎧 Auto-DJ Studio — Self-Mixing Music Player & Live Mashup Controller

A web-based Auto-DJ system powered by the **Web Audio API** and **React**, built to seamlessly mix tracks with authentic DJ deck feel, speed protection, harmonic mixing (Camelot wheel), waveform visualization, and real-time set recording.

**Target Playlist**: [YouTube Playlist: Desi Hip-Hop Extended Set (39 Tracks)](https://www.youtube.com/watch?v=2JzQhcSc2pM&list=PLcegabezDO5E)

---

## 🌟 Key Features & Architecture

### 1. Dual Professional DJ Decks & Interactive Turntables
- **Hardware-Style Vinyl Turntables**: Real vinyl physics with click-and-drag scratch simulation.
- **Hardware CUE Buttons**: Hold-to-preview and stutter-cueing on beat grids.
- **Equal-Power Crossfader**: Mathematical sinusoidal blend curve preventing center volume dips.
- **3-Band Isolator EQ**: Low shelf (250Hz), Peaking Mid (1.2kHz), and High shelf (4kHz).
- **Drag & Drop Track Staging**: Drag any song from the playlist drawer and drop it directly onto Deck A or Deck B.

### 2. Rekordbox/Serato-Style Waveform Visualizer & Beat Grid
- **Dynamic Waveform Canvas**: High-DPI dual-sided audio waveform rendering.
- **Beat-Grid Overlay**: Real-time vertical beat tick lines with gold downbeat markers on every 4th bar.
- **Live Analyser Transient Reactivity**: Real-time frequency bin analysis pulses waveforms dynamically on kicks and drops.
- **Interactive Manual Cue Points**: Click anywhere to seek; Shift+Click or click the quick `[SET CUE]` button to re-anchor the deck's cue point at any playhead timestamp.

### 3. Key Detection & Harmonic Mixing (Camelot Wheel)
- **Precomputed Harmonic Keys**: All 39 tracks analyzed using pitch chroma profiling and correlated against Krumhansl-Schmuckler key profiles to determine exact musical key and Camelot codes (e.g., `8A` / A minor, `11B` / A major).
- **Live Compatibility Badges**: When a master track plays, the playlist queue highlights harmonically compatible songs:
  - `HARMONIC MATCH` (Exact key lock)
  - `+1 / -1 HARMONIC` (Adjacent 1-step energy flow)
  - `RELATIVE KEY` (Relative major/minor toggle)
  - `ENERGY LIFT` (+2 Camelot steps)

### 4. Mix Preset Studio (Intro & Outro Trimming, Tempo & Reverb)
- **Cue-In / Trim Intro (`trimStart`)**: Skip slow intros and drop the track right where the beat hits.
- **Cue-Out / Trim Outro (`trimEnd`)**: Set an end cutoff timestamp that automatically triggers the transition before dead outros.
- **Audition Previews**: Dedicated `Preview Start Drop` and `Preview Outro Cut` audio auditions.
- **Pitch-Preserved Speed Boost**: $1.00\times - 1.30\times$ tempo boost with voice pitch preservation.
- **Studio Reverb**: Algorithmic convolution reverb with wet mix and customizable decay times.
- **Persistent Storage**: Presets auto-save to `localStorage` and display `⭐ PRESET` badges in the queue.

### 5. Live Mashup Mode & Clean 128 BPM Disco Groove
- **No Long Waits**: Automatically loops high-energy sections (25s, 35s, 50s) and jumps to hot drop points.
- **Pure 128 BPM Disco Backing Track**: 4-on-the-floor backing drum groove (`disco_groove_beat.mp3`) with punchy kicks, crisp snares, and zero horns/brass.
- **Brickwall Vocal Isolation DSP**: Steep highpass (340Hz) + peaking formant boost (1450Hz) + lowpass (3200Hz) filter chain that cuts original kicks and hi-hats, letting rap vocals ride clean over the disco beat.

### 6. Save & Export Mix as Audio File
- **🔴 Live Set Recorder**: Direct stream capture from Web Audio `masterGain` via `MediaStreamAudioDestinationNode` and `MediaRecorder` into high-fidelity WebM/Opus.
- **⚡ 1-Click Seamless WAV Render**: Uses `OfflineAudioContext` to synthesize and render a 36-second crossfade transition between Deck A and Deck B at 44.1kHz into a CD-quality 16-bit PCM `.wav` download.

### 7. Tempo Alignment & Speed Policy (Honest Architecture Note)
- **Asymmetric Tempo Policy (Upward-Only Pitch-Preserved Speed Alignment)**:
  - Full bidirectional beatmatching that stretches tracks downwards creates perceptible audio drag and transient smearing on rap drums.
  - To maintain maximum audio punch and groove clarity, Auto-DJ Studio implements an **upward-only speed policy**: slower incoming tracks are smoothly sped up by up to +5% towards the master tempo, but tracks are **never slowed down below 1.00x**.
  - All playback rate adjustments preserve vocal pitch (`preservesPitch = true`).

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
