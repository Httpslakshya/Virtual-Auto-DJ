// DJ Audio Engine - Dual Deck Web Audio API Controller
// Features: Classic Auto-DJ & Live Mashup Mode, EBU R128 mastering, Downbeat Phrase Drops, and Speed Protection
import { audioBufferToWavBlob } from '../utils/wavEncoder';

// Guaranteed persistent backup presets to ensure custom user settings are never lost across sessions
export const DEFAULT_BACKUP_PRESETS = {
  "2JzQhcSc2pM": { trimStart: 18.0, trimEnd: 165.0, speed: 1.0, reverbWet: 0.3, reverbPreset: "hall" }, // MP3
  "wb82fstyc-o": { trimStart: 6.5, trimEnd: 158.0, speed: 1.0, reverbWet: 0.0, reverbPreset: "hall" }, // DOLA RE
  "X3LHcxy6530": { trimStart: 8.5, trimEnd: 180.0, speed: 1.05, reverbWet: 0.45, reverbPreset: "cathedral" }, // MEXICAN COKE
  "RfMi5qoigVc": { trimStart: 5.0, trimEnd: 160.0, speed: 1.0, reverbWet: 0.0, reverbPreset: "hall" }, // Mona Lisa
  "XCIYHCXQoxQ": { trimStart: 66.5, trimEnd: 350.0, speed: 1.05, reverbWet: 0.15, reverbPreset: "room" }, // Seedhe Maut - RED
  "Q5r9-k7xYGw": { trimStart: 26.5, trimEnd: 172.0, speed: 1.0, reverbWet: 0.0, reverbPreset: "hall" }  // 11K
};

class DJEngine {
  constructor() {
    this.audioCtx = null;

    this.deckA = {
      id: 'A',
      audio: null,
      source: null,
      gainNode: null,
      eqLow: null,
      eqMid: null,
      eqHigh: null,
      analyser: null,
      track: null,
      volume: 1.0,
      bpm: 128,
      rate: 1.0,
      cueTime: 0.0,
      trimStart: 0.0,
      trimEnd: null,
      isPreloaded: false,
      isScratching: false,
      jogAngle: 0
    };

    this.deckB = {
      id: 'B',
      audio: null,
      source: null,
      gainNode: null,
      eqLow: null,
      eqMid: null,
      eqHigh: null,
      analyser: null,
      track: null,
      volume: 1.0,
      bpm: 128,
      rate: 1.0,
      cueTime: 0.0,
      trimStart: 0.0,
      trimEnd: null,
      isPreloaded: false,
      isScratching: false,
      jogAngle: 0
    };

    this.masterGain = null;
    this.limiter = null;
    this.analyser = null;

    // Crossfader state: 0.0 = 100% Deck A, 1.0 = 100% Deck B
    this.crossfaderPosition = 0.0;
    this.activeDeckId = 'A';
    this.mode = 'mashup'; // 'mashup' | 'classic'
    this.autoDJEnabled = true;
    this.isPlaying = false;
    this.isTransitioning = false;
    this.transitionProgress = 0.0;

    // Standard Auto-DJ transition settings
    this.crossfadeTriggerLead = 16.0;
    this.crossfadeDuration = 8.0;
    this.transitionStartTime = 0;
    this.transitionFromDeck = 'A';
    this.transitionToDeck = 'B';

    // --- MASHUP MODE SETTINGS ---
    this.mashupSegmentDuration = 32.0; // Play ~32s before dropping to next song
    this.mashupSegmentStartTime = 0;
    this.mashupRemaining = 32.0;
    this.mashupDropDuration = 6.5; // Smooth musical 6.5s phrase blend

    // --- DISCO BEAT OVERLAY (128 BPM Fast Disco Beat + Vocals Overlay) ---
    this.discoAudio = null;
    this.discoSource = null;
    this.discoGainNode = null;
    this.isDiscoBeatActive = false;
    this.discoVolume = 0.85;

    // Cue Preview state
    this.isCueHolding = false;
    this.cueHoldDeckId = null;

    // Callbacks for UI updates
    this.onStateUpdate = () => {};
    this.onTrackChange = () => {};
    this.onTrackLoaded = () => {};
    this.onTransitionTick = () => {};
    this.onBeatPulse = () => {};
    this.onMashupTick = () => {};
    this.onDiscoBeatToggle = () => {};
    this.onRecordingStateChange = () => {};

    // Live Recording state
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStartTime = 0;
    this.recDestination = null;

    // Animation / update loop
    this.rafId = null;
    this.isInitialized = false;
    this.lastBeat = -1;
  }

  // Initialize Web Audio graph
  init(deckAAudioEl, deckBAudioEl, discoAudioEl = null) {
    if (this.isInitialized && this.deckA.audio === deckAAudioEl && this.deckB.audio === deckBAudioEl) {
      if (discoAudioEl && !this.discoAudio) {
        this.initDiscoBeat(discoAudioEl);
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      this.deckA.audio = deckAAudioEl;
      this.deckB.audio = deckBAudioEl;

      // Configure HTML5 audio elements
      [this.deckA.audio, this.deckB.audio].forEach((audio) => {
        if (!audio) return;
        audio.preload = 'auto';
        audio.volume = 1.0;
        if ('preservesPitch' in audio) {
          audio.preservesPitch = true;
        } else if ('mozPreservesPitch' in audio) {
          audio.mozPreservesPitch = true;
        } else if ('webkitPreservesPitch' in audio) {
          audio.webkitPreservesPitch = true;
        }
      });

      // Master bus
      if (!this.masterGain) {
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

        this.limiter = this.audioCtx.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-2.0, this.audioCtx.currentTime);
        this.limiter.knee.setValueAtTime(4.0, this.audioCtx.currentTime);
        this.limiter.ratio.setValueAtTime(12.0, this.audioCtx.currentTime);
        this.limiter.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
        this.limiter.release.setValueAtTime(0.15, this.audioCtx.currentTime);

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);

        // Connect master gain to stream destination for live mix recording
        this.recDestination = this.audioCtx.createMediaStreamDestination();
        this.masterGain.connect(this.recDestination);
      }

      this.setupDeckNodes(this.deckA);
      this.setupDeckNodes(this.deckB);

      if (discoAudioEl) {
        this.initDiscoBeat(discoAudioEl);
      }

      this.applyCrossfader(0.0);

      this.isInitialized = true;
      this.startLoop();
      console.log('[DJ Engine] Initialized successfully. Mode:', this.mode);
    } catch (err) {
      console.error('[DJ Engine] Initialization error:', err);
    }
  }

  buildImpulseResponse(duration = 2.2, decay = 2.0) {
    if (!this.audioCtx) return null;
    const rate = this.audioCtx.sampleRate;
    const length = Math.max(1, Math.floor(rate * duration));
    const impulse = this.audioCtx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const env = Math.exp(-t * decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }

  setupDeckNodes(deck) {
    if (!deck.audio || deck.source) return;

    try {
      deck.source = this.audioCtx.createMediaElementSource(deck.audio);
      deck.gainNode = this.audioCtx.createGain();

      deck.eqLow = this.audioCtx.createBiquadFilter();
      deck.eqLow.type = 'lowshelf';
      deck.eqLow.frequency.setValueAtTime(250, this.audioCtx.currentTime);
      deck.eqLow.gain.setValueAtTime(0, this.audioCtx.currentTime);

      deck.eqMid = this.audioCtx.createBiquadFilter();
      deck.eqMid.type = 'peaking';
      deck.eqMid.frequency.setValueAtTime(1200, this.audioCtx.currentTime);
      deck.eqMid.Q.setValueAtTime(1.0, this.audioCtx.currentTime);
      deck.eqMid.gain.setValueAtTime(0, this.audioCtx.currentTime);

      deck.eqHigh = this.audioCtx.createBiquadFilter();
      deck.eqHigh.type = 'highshelf';
      deck.eqHigh.frequency.setValueAtTime(4000, this.audioCtx.currentTime);
      deck.eqHigh.gain.setValueAtTime(0, this.audioCtx.currentTime);

      // Studio Reverb Node Network (Dry / Wet send)
      deck.reverbDryGain = this.audioCtx.createGain();
      deck.reverbDryGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      deck.reverbWetGain = this.audioCtx.createGain();
      deck.reverbWetGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

      deck.reverbConvolver = this.audioCtx.createConvolver();
      deck.reverbConvolver.buffer = this.buildImpulseResponse(2.2, 2.0);

      // Deck Waveform Analyser
      deck.analyser = this.audioCtx.createAnalyser();
      deck.analyser.fftSize = 256;
      deck.analyser.smoothingTimeConstant = 0.8;

      // Connect: source -> eqLow -> eqMid -> eqHigh
      deck.source.connect(deck.eqLow);
      deck.eqLow.connect(deck.eqMid);
      deck.eqMid.connect(deck.eqHigh);

      // Send to Dry and Wet branches
      deck.eqHigh.connect(deck.reverbDryGain);
      deck.reverbDryGain.connect(deck.gainNode);

      deck.eqHigh.connect(deck.reverbConvolver);
      deck.reverbConvolver.connect(deck.reverbWetGain);
      deck.reverbWetGain.connect(deck.gainNode);

      // GainNode sends to deck analyser and master bus
      deck.gainNode.connect(deck.analyser);
      deck.gainNode.connect(this.masterGain);
    } catch (err) {
      console.warn(`[DJ Engine] setupDeckNodes error on Deck ${deck.id}:`, err);
    }
  }

  async resumeAudioContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
        this.applyCrossfader(this.crossfaderPosition);
      } catch (err) {
        console.error('[DJ Engine] Failed to resume AudioContext:', err);
      }
    }
  }

  // Equal-power crossfader (Web Audio gainNode controls volume exclusively)
  applyCrossfader(pos) {
    this.crossfaderPosition = Math.max(0, Math.min(1, pos));

    const angle = this.crossfaderPosition * (Math.PI / 2);
    const volA = this.deckA.volume ?? 1.0;
    const volB = this.deckB.volume ?? 1.0;
    const gainA = Math.cos(angle) * volA;
    const gainB = Math.sin(angle) * volB;

    if (this.audioCtx && this.deckA.gainNode && this.deckB.gainNode) {
      const now = this.audioCtx.currentTime;
      this.deckA.gainNode.gain.cancelScheduledValues(now);
      this.deckB.gainNode.gain.cancelScheduledValues(now);

      this.deckA.gainNode.gain.setValueAtTime(gainA, now);
      this.deckB.gainNode.gain.setValueAtTime(gainB, now);
    }
  }

  setDeckVolume(deckId, vol) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.volume = Math.max(0, Math.min(1, vol));
    this.applyCrossfader(this.crossfaderPosition);
  }

  setDeckEQ(deckId, band, gainDb) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    if (!deck.userEq) deck.userEq = { low: 0, mid: 0, high: 0 };
    deck.userEq[band] = gainDb;

    if (!this.audioCtx || this.isDiscoBeatActive) return;
    const now = this.audioCtx.currentTime;
    const val = Math.max(-24, Math.min(12, gainDb));

    if (band === 'low' && deck.eqLow) {
      deck.eqLow.gain.setTargetAtTime(val, now, 0.05);
    } else if (band === 'mid' && deck.eqMid) {
      deck.eqMid.gain.setTargetAtTime(val, now, 0.05);
    } else if (band === 'high' && deck.eqHigh) {
      deck.eqHigh.gain.setTargetAtTime(val, now, 0.05);
    }
  }

  getDeckAnalyser(deckId) {
    return deckId === 'A' ? this.deckA.analyser : this.deckB.analyser;
  }

  // Set Manual Cue Point directly (e.g. from Waveform Visualizer click)
  setDeckCueTime(deckId, cueSeconds) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.cueTime = Math.max(0, parseFloat(cueSeconds.toFixed(1)));
    deck.trimStart = deck.cueTime;

    if (deck.track?.id) {
      const existing = this.loadPresetForTrack(deck.track.id) || {};
      this.savePresetForTrack(deck.track.id, {
        ...existing,
        trimStart: deck.cueTime
      });
    }
    this.onStateUpdate();
  }

  // --- PRESET SYSTEM (Trim / Start Point, Outro Cut, Speed, Reverb) ---
  loadPresetForTrack(trackId) {
    try {
      const raw = localStorage.getItem('autodj_track_presets');
      if (raw) {
        const presets = JSON.parse(raw);
        if (presets[trackId]) return presets[trackId];
      }
    } catch (e) {
      console.warn('Error reading presets:', e);
    }
    // Return backup default preset if available
    return DEFAULT_BACKUP_PRESETS[trackId] || null;
  }

  savePresetForTrack(trackId, presetData) {
    try {
      const raw = localStorage.getItem('autodj_track_presets');
      const presets = raw ? JSON.parse(raw) : { ...DEFAULT_BACKUP_PRESETS };
      presets[trackId] = presetData;
      localStorage.setItem('autodj_track_presets', JSON.stringify(presets));
      console.log(`[Preset Saved] Saved preset for ${trackId}:`, presetData);
      this.onPresetsUpdated?.(presets);
      return presets;
    } catch (e) {
      console.error('Error saving preset:', e);
    }
  }

  deletePresetForTrack(trackId) {
    try {
      const raw = localStorage.getItem('autodj_track_presets');
      if (raw) {
        const presets = JSON.parse(raw);
        delete presets[trackId];
        localStorage.setItem('autodj_track_presets', JSON.stringify(presets));
        this.onPresetsUpdated?.(presets);
        return presets;
      }
    } catch (e) {
      console.error('Error deleting preset:', e);
    }
  }

  getAllPresets() {
    try {
      const raw = localStorage.getItem('autodj_track_presets');
      const existing = raw ? JSON.parse(raw) : {};
      const merged = { ...DEFAULT_BACKUP_PRESETS, ...existing };
      localStorage.setItem('autodj_track_presets', JSON.stringify(merged));
      return merged;
    } catch (e) {
      return { ...DEFAULT_BACKUP_PRESETS };
    }
  }

  setDeckReverb(deckId, wetPercent, decay = 2.2) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.reverbWet = Math.max(0, Math.min(1, wetPercent));
    deck.reverbDecay = decay;

    if (!this.audioCtx || !deck.reverbWetGain || !deck.reverbDryGain) return;
    const now = this.audioCtx.currentTime;

    deck.reverbWetGain.gain.setTargetAtTime(deck.reverbWet, now, 0.05);
    deck.reverbDryGain.gain.setTargetAtTime(1.0 - (deck.reverbWet * 0.35), now, 0.05);

    if (deck.reverbConvolver && Math.abs((deck.currentDecay || 2.0) - decay) > 0.2) {
      deck.currentDecay = decay;
      deck.reverbConvolver.buffer = this.buildImpulseResponse(Math.max(1.5, decay * 1.1), decay);
    }
  }

  setDeckRate(deckId, rate) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    const r = Math.max(0.5, Math.min(2.0, rate));
    deck.userRate = r;
    deck.rate = r;
    if (deck.audio) {
      deck.audio.preservesPitch = true;
      deck.audio.playbackRate = r;
    }
  }

  setDeckStartPoint(deckId, startSecs) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.cueTime = Math.max(0, startSecs);
    deck.trimStart = Math.max(0, startSecs);
  }

  setDeckOutroPoint(deckId, outroSecs) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.trimEnd = outroSecs ? Math.max(0, outroSecs) : null;
  }

  loadTrack(deckId, track) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.track = track;
    deck.bpm = track.bpm || 128;

    // Check if user has a custom saved preset for this track!
    const preset = this.loadPresetForTrack(track.id);
    if (preset) {
      deck.cueTime = preset.trimStart ?? (track.firstBeat || 0.0);
      deck.trimStart = preset.trimStart ?? 0.0;
      deck.trimEnd = preset.trimEnd ?? null;
      deck.rate = preset.speed ?? 1.0;
      deck.userRate = preset.speed ?? 1.0;
      this.setDeckReverb(deckId, preset.reverbWet ?? 0.0, preset.reverbDecay ?? 2.2);
    } else {
      deck.cueTime = track.firstBeat || 0.0;
      deck.trimStart = 0.0;
      deck.trimEnd = null;
      deck.rate = 1.0;
      deck.userRate = 1.0;
      this.setDeckReverb(deckId, 0.0, 2.2);
    }

    if (deck.audio) {
      deck.audio.src = track.audioUrl;
      deck.audio.load();
      deck.audio.preservesPitch = true;
      deck.audio.playbackRate = deck.rate;
    }
    deck.isPreloaded = true;
    console.log(`[DJ Engine] Loaded "${track.title}" on Deck ${deckId} (Preset: ${preset ? 'Custom' : 'Default'})`);

    // If disco beat mashup is currently active, ensure vocal isolation applies
    if (this.isDiscoBeatActive) {
      this.applyVocalIsolationEQ(true);
    }

    this.onTrackLoaded(deckId, track);
  }

  // --- DISCO BEAT OVERLAY (128 BPM Fast Disco Drum Groove + Acapella Vocals) ---
  initDiscoBeat(discoAudioEl) {
    if (!discoAudioEl || this.discoAudio === discoAudioEl) return;
    this.discoAudio = discoAudioEl;
    this.discoAudio.loop = true;
    this.discoAudio.volume = this.discoVolume;

    if (this.audioCtx && !this.discoSource) {
      try {
        this.discoSource = this.audioCtx.createMediaElementSource(this.discoAudio);
        this.discoGainNode = this.audioCtx.createGain();
        this.discoGainNode.gain.setValueAtTime(this.discoVolume, this.audioCtx.currentTime);
        this.discoSource.connect(this.discoGainNode);
        this.discoGainNode.connect(this.masterGain);
      } catch (err) {
        console.warn('[DJ Engine] Disco beat Web Audio node error:', err);
      }
    }
  }

  toggleDiscoBeat() {
    this.setDiscoBeat(!this.isDiscoBeatActive);
  }

  setDiscoBeat(active) {
    this.isDiscoBeatActive = active;
    this.resumeAudioContext();

    if (active) {
      if (this.discoAudio && this.isPlaying) {
        this.discoAudio.currentTime = 0;
        this.discoAudio.play().catch(console.error);
      }
      this.applyVocalIsolationEQ(true);
      console.log('[DJ Engine] 🕺 Disco Beat Mashup Activated: 128 BPM Drum Groove + Brickwall Vocal Isolation');
    } else {
      if (this.discoAudio) {
        this.discoAudio.pause();
      }
      this.applyVocalIsolationEQ(false);
      console.log('[DJ Engine] Disco Beat Mashup Deactivated: Normal Mix Restored');
    }

    this.onDiscoBeatToggle(this.isDiscoBeatActive);
    this.onStateUpdate();
  }

  setDiscoVolume(vol) {
    this.discoVolume = Math.max(0, Math.min(1, vol));
    if (this.discoGainNode && this.audioCtx) {
      this.discoGainNode.gain.setValueAtTime(this.discoVolume, this.audioCtx.currentTime);
    } else if (this.discoAudio) {
      this.discoAudio.volume = this.discoVolume;
    }
  }

  // Live DJ Acapella Isolation: Brickwall cuts original drums/bass so only the vocal track rides the disco beat
  applyVocalIsolationEQ(enable) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    [this.deckA, this.deckB].forEach((deck) => {
      if (deck.eqLow && deck.eqMid && deck.eqHigh) {
        if (enable) {
          // 1. High-Pass at 340 Hz (Q=1.2) - Brickwall eliminates 100% of kick drum, sub-bass, 808s
          deck.eqLow.type = 'highpass';
          deck.eqLow.frequency.setTargetAtTime(340, now, 0.05);
          deck.eqLow.Q.setTargetAtTime(1.2, now, 0.05);

          // 2. Vocal Formant Peaking Boost at 1450 Hz (+7.5dB, Q=1.0) - Pushes vocal formants upfront
          deck.eqMid.type = 'peaking';
          deck.eqMid.frequency.setTargetAtTime(1450, now, 0.05);
          deck.eqMid.Q.setTargetAtTime(1.0, now, 0.05);
          deck.eqMid.gain.setTargetAtTime(7.5, now, 0.05);

          // 3. Low-Pass at 3200 Hz (Q=1.1) - Completely cuts original hi-hats, shakers, cymbals, snare clatter
          deck.eqHigh.type = 'lowpass';
          deck.eqHigh.frequency.setTargetAtTime(3200, now, 0.05);
          deck.eqHigh.Q.setTargetAtTime(1.1, now, 0.05);
        } else {
          // Restore to standard Studio 3-band EQ
          deck.eqLow.type = 'lowshelf';
          deck.eqLow.frequency.setTargetAtTime(250, now, 0.05);
          deck.eqLow.gain.setTargetAtTime(deck.userEq?.low || 0, now, 0.05);

          deck.eqMid.type = 'peaking';
          deck.eqMid.frequency.setTargetAtTime(1200, now, 0.05);
          deck.eqMid.Q.setTargetAtTime(1.0, now, 0.05);
          deck.eqMid.gain.setTargetAtTime(deck.userEq?.mid || 0, now, 0.05);

          deck.eqHigh.type = 'highshelf';
          deck.eqHigh.frequency.setTargetAtTime(4000, now, 0.05);
          deck.eqHigh.gain.setTargetAtTime(deck.userEq?.high || 0, now, 0.05);
        }
      }
    });
  }

  // --- CUE SYSTEM ---
  pressCue(deckId) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    if (!deck.audio) return;

    this.resumeAudioContext();

    if (this.isPlaying && this.activeDeckId === deckId) {
      this.pause();
      deck.audio.currentTime = deck.cueTime;
    } else {
      this.isCueHolding = true;
      this.cueHoldDeckId = deckId;
      deck.audio.currentTime = deck.cueTime;
      deck.audio.play().catch(console.error);
    }
    this.onStateUpdate();
  }

  releaseCue(deckId) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    if (this.isCueHolding && this.cueHoldDeckId === deckId) {
      this.isCueHolding = false;
      this.cueHoldDeckId = null;
      if (!this.isPlaying) {
        deck.audio.pause();
        deck.audio.currentTime = deck.cueTime;
      }
      this.onStateUpdate();
    }
  }

  // --- INTERACTIVE JOG SCRATCH ---
  startJogScratch(deckId) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.isScratching = true;
    deck.wasPlayingBeforeScratch = !deck.audio.paused;
    deck.audio.pause();
  }

  jogScratchMove(deckId, deltaAngle) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    if (!deck.audio || !deck.isScratching) return;

    deck.jogAngle = (deck.jogAngle + deltaAngle) % 360;
    const timeDelta = (deltaAngle / 360) * 1.5;
    const newTime = Math.max(0, Math.min(deck.audio.duration || 1000, deck.audio.currentTime + timeDelta));
    deck.audio.currentTime = newTime;
  }

  endJogScratch(deckId) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.isScratching = false;
    if (deck.wasPlayingBeforeScratch) {
      deck.audio.play().catch(console.error);
    }
  }

  // Set Auto-DJ Mode ('classic' or 'mashup')
  setMode(newMode) {
    this.mode = newMode;
    console.log(`[DJ Engine] Mode switched to: ${newMode}`);
    if (newMode === 'mashup') {
      this.mashupSegmentStartTime = performance.now();
    }
    this.onStateUpdate();
  }

  setMashupSegmentDuration(secs) {
    this.mashupSegmentDuration = Math.max(15, Math.min(90, secs));
    console.log(`[Mashup Mode] Segment length set to: ${this.mashupSegmentDuration}s`);
  }

  // Pick a high-energy drop section for Mashup Mode
  pickDropPosition(track) {
    const dur = track.duration || 180;
    // Energetic sections: Verse 1 drop (~15%), Chorus/Hook (~35%), or Drop 2 (~55%)
    const candidates = [
      dur * 0.16,
      dur * 0.32,
      dur * 0.50
    ];
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    // Quantize to beat grid if beat interval is known
    const beatInt = track.beatInterval || 0.46;
    const beatQuantized = Math.round(chosen / (beatInt * 4)) * (beatInt * 4) + (track.firstBeat || 0);
    return Math.max(0, Math.min(dur - 25, beatQuantized));
  }

  // SPEED RULE: Never slow down tracks below 1.0x!
  applySpeedPolicy(fromDeck, toDeck) {
    const fromBpm = fromDeck.track?.bpm || 128;
    const toBpm = toDeck.track?.bpm || 128;

    // Only allow slight rate increase up to +5% (e.g. 128 -> 132), NEVER decrease below 1.00x!
    let targetRate = 1.0;
    if (fromBpm > toBpm && (fromBpm / toBpm) <= 1.06) {
      targetRate = Math.min(1.05, fromBpm / toBpm);
    } else {
      targetRate = 1.0; // Keep natural speed, drop right on the beat
    }

    toDeck.audio.preservesPitch = true;
    toDeck.audio.playbackRate = targetRate;
    toDeck.rate = targetRate;

    console.log(`[Speed Policy] Deck ${toDeck.id} rate set to ${targetRate.toFixed(2)}x (Never slowed down)`);
  }

  // Trigger transition between decks
  startTransition(duration = this.crossfadeDuration, isMashup = false) {
    if (this.isTransitioning) return;

    const fromDeckId = this.activeDeckId;
    const toDeckId = fromDeckId === 'A' ? 'B' : 'A';
    const fromDeck = fromDeckId === 'A' ? this.deckA : this.deckB;
    const toDeck = toDeckId === 'A' ? this.deckA : this.deckB;

    if (!toDeck.track || !toDeck.audio) {
      console.warn('[DJ Engine] Next deck track not ready for transition');
      return;
    }

    this.isTransitioning = true;
    this.transitionFromDeck = fromDeckId;
    this.transitionToDeck = toDeckId;
    this.transitionDuration = duration;
    this.transitionStartTime = performance.now();
    this.transitionProgress = 0;

    // Apply speed protection (never slow down below 1.0x)
    this.applySpeedPolicy(fromDeck, toDeck);

    // If Mashup Mode: Start incoming song at an energetic beat drop / chorus
    if (isMashup || this.mode === 'mashup') {
      const dropTime = this.pickDropPosition(toDeck.track);
      toDeck.audio.currentTime = dropTime;
      console.log(`[Mashup Drop] Deck ${toDeckId} dropping into hot section at ${dropTime.toFixed(1)}s`);
    } else {
      toDeck.audio.currentTime = toDeck.cueTime || 0;
    }

    // Start incoming track
    toDeck.audio.play().catch(console.error);

    console.log(`[DJ Engine] Starting transition from Deck ${fromDeckId} -> Deck ${toDeckId} (${duration}s)`);
    this.onStateUpdate();
  }

  // Instant trigger for Mashup Mode: "DROP NEXT NOW"
  dropNextMashup() {
    this.startTransition(this.mashupDropDuration, true);
  }

  jumpToTransition() {
    const activeDeck = this.activeDeckId === 'A' ? this.deckA : this.deckB;
    if (activeDeck.audio && activeDeck.audio.duration) {
      const targetTime = Math.max(0, activeDeck.audio.duration - (this.crossfadeTriggerLead - 1));
      activeDeck.audio.currentTime = targetTime;
      if (!this.isPlaying) {
        this.play();
      }
    }
  }

  skipTrack() {
    if (this.isTransitioning) return;
    this.startTransition(this.mode === 'mashup' ? 5.0 : 3.5, this.mode === 'mashup');
  }

  async play() {
    await this.resumeAudioContext();
    const activeDeck = this.activeDeckId === 'A' ? this.deckA : this.deckB;
    if (activeDeck.audio) {
      try {
        await activeDeck.audio.play();
        this.isPlaying = true;
        this.mashupSegmentStartTime = performance.now();
        this.applyCrossfader(this.activeDeckId === 'A' ? 0.0 : 1.0);

        if (this.isDiscoBeatActive && this.discoAudio) {
          this.discoAudio.play().catch(console.error);
        }

        this.onStateUpdate();
      } catch (err) {
        console.error('[DJ Engine] Error starting playback:', err);
      }
    }
  }

  pause() {
    this.deckA.audio?.pause();
    this.deckB.audio?.pause();
    if (this.discoAudio) {
      this.discoAudio.pause();
    }
    this.isPlaying = false;
    this.onStateUpdate();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  startLoop() {
    if (this.rafId) return;
    const tick = () => {
      this.updateLoop();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  updateLoop() {
    const activeDeck = this.activeDeckId === 'A' ? this.deckA : this.deckB;
    const nextDeck = this.activeDeckId === 'A' ? this.deckB : this.deckA;

    // Real-time Beat Grid (1-2-3-4)
    if (activeDeck.audio && !activeDeck.audio.paused && activeDeck.track?.beatInterval) {
      const beatInterval = activeDeck.track.beatInterval;
      const firstBeat = activeDeck.track.firstBeat || 0;
      const curTime = activeDeck.audio.currentTime;

      if (curTime >= firstBeat) {
        const beatNum = Math.floor((curTime - firstBeat) / beatInterval) % 4 + 1;
        if (beatNum !== this.lastBeat) {
          this.lastBeat = beatNum;
          this.onBeatPulse({ deckId: activeDeck.id, beat: beatNum });
        }
      }
    }

    // 1. Handle Active Crossfade Transition
    if (this.isTransitioning) {
      const elapsed = (performance.now() - this.transitionStartTime) / 1000;
      let progress = Math.min(1.0, elapsed / this.transitionDuration);
      this.transitionProgress = progress;

      const currentPos = this.transitionFromDeck === 'A' ? progress : 1.0 - progress;
      this.applyCrossfader(currentPos);

      this.onTransitionTick({
        progress,
        remainingSec: Math.max(0, this.transitionDuration - elapsed),
        fromDeck: this.transitionFromDeck,
        toDeck: this.transitionToDeck
      });

      // Transition complete
      if (progress >= 1.0) {
        this.isTransitioning = false;
        this.transitionProgress = 0;

        const outgoingDeck = this.transitionFromDeck === 'A' ? this.deckA : this.deckB;
        outgoingDeck.audio?.pause();
        if (outgoingDeck.audio) {
          outgoingDeck.audio.currentTime = 0;
          outgoingDeck.audio.playbackRate = 1.0;
        }
        outgoingDeck.rate = 1.0;

        this.activeDeckId = this.transitionToDeck;
        this.applyCrossfader(this.activeDeckId === 'A' ? 0.0 : 1.0);
        this.mashupSegmentStartTime = performance.now();

        console.log(`[Auto-DJ] Transition completed. Deck ${this.activeDeckId} is now Master.`);
        if (this.isDiscoBeatActive) {
          this.applyVocalIsolationEQ(true);
        }
        this.onTrackChange(this.activeDeckId);
        this.onStateUpdate();
      }
      return;
    }

    // 2. MASHUP MODE AUTO-DROP TRIGGER
    if (this.autoDJEnabled && this.isPlaying && this.mode === 'mashup' && !this.isTransitioning) {
      const segmentElapsed = (performance.now() - this.mashupSegmentStartTime) / 1000;
      const remaining = Math.max(0, this.mashupSegmentDuration - segmentElapsed);
      this.mashupRemaining = remaining;

      this.onMashupTick({
        remainingSec: remaining,
        totalSec: this.mashupSegmentDuration,
        progress: segmentElapsed / this.mashupSegmentDuration
      });

      // When segment ends: trigger punchy 3.5s phrase drop into next song's hot section
      if (remaining <= 0 && nextDeck.track) {
        this.startTransition(this.mashupDropDuration, true);
      }
      return;
    }

    // 3. OUTRO TRIM & CLASSIC AUTO-DJ TRIGGERS
    if (this.autoDJEnabled && this.isPlaying && activeDeck.audio && activeDeck.audio.duration) {
      const curTime = activeDeck.audio.currentTime;
      const duration = activeDeck.audio.duration;

      // If user preset configured a custom outro/end point for this track:
      if (activeDeck.trimEnd && curTime >= activeDeck.trimEnd && !this.isTransitioning && nextDeck.track) {
        console.log(`[Auto-DJ] Reached user preset Outro Trim (${activeDeck.trimEnd}s). Triggering transition!`);
        this.startTransition(this.crossfadeDuration, false);
        return;
      }

      if (this.mode === 'classic') {
        const remaining = duration - curTime;
        if (remaining <= this.crossfadeTriggerLead && remaining > 0 && nextDeck.track) {
          this.startTransition(this.crossfadeDuration, false);
        }
      }
    }
  }

  // --- LIVE MIX RECORDING (Lossless Opus/WebM CD Quality) ---
  startLiveRecording() {
    if (this.isRecording) return;
    try {
      this.resumeAudioContext();
      if (!this.recDestination) {
        this.recDestination = this.audioCtx.createMediaStreamDestination();
        this.masterGain.connect(this.recDestination);
      }
      this.recordedChunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      this.mediaRecorder = new MediaRecorder(this.recDestination.stream, { mimeType: mime });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.start(250);
      this.isRecording = true;
      this.recordingStartTime = performance.now();
      console.log('[DJ Engine] 🔴 Live Mix Recording Started');
      this.onRecordingStateChange?.({ isRecording: true, elapsedSec: 0 });
    } catch (err) {
      console.error('[DJ Engine] Failed to start live recording:', err);
    }
  }

  stopLiveRecording() {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        resolve(null);
        return;
      }
      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mime });
        this.isRecording = false;
        console.log(`[DJ Engine] ⏹️ Recording Stopped. Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        this.onRecordingStateChange?.({ isRecording: false, elapsedSec: 0 });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  // --- OFFLINE AUDIO CONTEXT MIXDOWN RENDERER (Rave.DJ style 1-Click WAV download) ---
  async renderOfflineTransitionMix(trackA, trackB, onProgress) {
    if (!trackA || !trackB) throw new Error('Both tracks required for mix render');

    onProgress?.(10, 'Fetching audio files...');
    const fetchBuffer = async (url) => {
      const res = await fetch(url);
      const arrayBuf = await res.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      ctx.close();
      return decoded;
    };

    const [bufA, bufB] = await Promise.all([
      fetchBuffer(trackA.audioUrl),
      fetchBuffer(trackB.audioUrl)
    ]);

    onProgress?.(45, 'Synthesizing seamless crossfade transition...');
    const sampleRate = 44100;
    const playADuration = 14; // 14s of Track A lead
    const crossfadeDur = 8;   // 8s smooth crossfade
    const playBDuration = 14; // 14s of Track B tail
    const totalDuration = playADuration + crossfadeDur + playBDuration; // ~36s CD-quality mix

    const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDuration, sampleRate);

    // Source A
    const sourceA = offlineCtx.createBufferSource();
    sourceA.buffer = bufA;
    const gainA = offlineCtx.createGain();
    sourceA.connect(gainA);
    gainA.connect(offlineCtx.destination);

    // Source B
    const sourceB = offlineCtx.createBufferSource();
    sourceB.buffer = bufB;
    const gainB = offlineCtx.createGain();
    sourceB.connect(gainB);
    gainB.connect(offlineCtx.destination);

    // Load preset start offsets if configured
    const presetA = this.loadPresetForTrack(trackA.id);
    const presetB = this.loadPresetForTrack(trackB.id);
    const cueA = presetA?.trimStart ?? (trackA.firstBeat || 15);
    const cueB = presetB?.trimStart ?? (trackB.firstBeat || 10);

    // Track A playback
    sourceA.start(0, cueA, playADuration + crossfadeDur);

    // Track A volume fade
    gainA.gain.setValueAtTime(1.0, 0);
    gainA.gain.setValueAtTime(1.0, playADuration);
    gainA.gain.linearRampToValueAtTime(0.0, playADuration + crossfadeDur);

    // Track B playback starting at playADuration
    sourceB.start(playADuration, cueB, crossfadeDur + playBDuration);

    // Track B volume fade in
    gainB.gain.setValueAtTime(0.0, 0);
    gainB.gain.setValueAtTime(0.0, playADuration);
    gainB.gain.linearRampToValueAtTime(1.0, playADuration + crossfadeDur);

    onProgress?.(75, 'Rendering audio offline at 44.1kHz...');
    const renderedBuffer = await offlineCtx.startRendering();

    onProgress?.(92, 'Encoding 16-bit Stereo PCM WAV...');
    const wavBlob = audioBufferToWavBlob(renderedBuffer);

    onProgress?.(100, 'Mixdown complete!');
    return wavBlob;
  }

  getVisualizerData() {
    if (!this.analyser) return null;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  pauseAll() {
    this.deckA.audio?.pause();
    this.deckB.audio?.pause();
    this.discoAudio?.pause();
    this.isPlaying = false;
  }

  // Lifecycle Cleanup on Component Unmount
  dispose() {
    this.pauseAll();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    try {
      this.deckA.source?.disconnect();
      this.deckB.source?.disconnect();
      this.deckA.gainNode?.disconnect();
      this.deckB.gainNode?.disconnect();
      this.deckA.analyser?.disconnect();
      this.deckB.analyser?.disconnect();
      this.discoSource?.disconnect();
      this.discoGainNode?.disconnect();
      this.masterGain?.disconnect();
      this.limiter?.disconnect();
      this.analyser?.disconnect();
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
      }
    } catch (e) {
      console.warn('[DJ Engine] Error during dispose:', e);
    }
    this.isInitialized = false;
    console.log('[DJ Engine] Disposed AudioContext and disconnected all graph nodes cleanly.');
  }
}

export const djEngine = new DJEngine();

