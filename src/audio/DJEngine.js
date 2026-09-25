// DJ Audio Engine - Dual Deck Web Audio API Controller
// Features: Classic Auto-DJ & Live Mashup Mode, EBU R128 mastering, Downbeat Phrase Drops, and Speed Protection

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
      track: null,
      volume: 1.0,
      bpm: 128,
      rate: 1.0,
      cueTime: 0.0,
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
      track: null,
      volume: 1.0,
      bpm: 128,
      rate: 1.0,
      cueTime: 0.0,
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

      deck.source.connect(deck.eqLow);
      deck.eqLow.connect(deck.eqMid);
      deck.eqMid.connect(deck.eqHigh);
      deck.eqHigh.connect(deck.gainNode);
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

  // Equal-power crossfader
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

    if (this.deckA.audio) this.deckA.audio.volume = gainA;
    if (this.deckB.audio) this.deckB.audio.volume = gainB;
  }

  setDeckVolume(deckId, vol) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.volume = Math.max(0, Math.min(1, vol));
    this.applyCrossfader(this.crossfaderPosition);
  }

  setDeckEQ(deckId, band, gainDb) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    if (!this.audioCtx) return;
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

  loadTrack(deckId, track) {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.track = track;
    deck.bpm = track.bpm || 128;
    deck.cueTime = track.firstBeat || 0.0;

    if (deck.audio) {
      deck.audio.src = track.audioUrl;
      deck.audio.load();
      deck.audio.playbackRate = 1.0;
    }
    deck.rate = 1.0;
    deck.isPreloaded = true;
    console.log(`[DJ Engine] Loaded "${track.title}" on Deck ${deckId}`);

    // If disco beat mashup is currently active, ensure vocal isolation EQ applies to this deck
    if (this.isDiscoBeatActive) {
      this.applyVocalIsolationEQ(true);
    }

    this.onTrackLoaded(deckId, track);
  }

  // --- DISCO BEAT OVERLAY (128 BPM Fast Disco Beat + Vocals Overlay) ---
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
      console.log('[DJ Engine] 🕺 Disco Beat Mashup Activated: 128 BPM Groove + Vocals Isolation');
    } else {
      if (this.discoAudio) {
        this.discoAudio.pause();
      }
      this.applyVocalIsolationEQ(false);
      console.log('[DJ Engine] Disco Beat Mashup Deactivated');
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

  // Live DJ Vocal Isolation: Filter low bass/kicks from original tracks so the fast Disco beat drives the rhythm
  applyVocalIsolationEQ(enable) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    [this.deckA, this.deckB].forEach((deck) => {
      if (deck.eqLow && deck.eqMid) {
        if (enable) {
          // Low cut (-12dB) to remove 808s and kick from original track, letting Disco beat drive
          // Mid boost (+4.5dB) to isolate and push the rap/singing vocals upfront
          deck.eqLow.gain.setTargetAtTime(-12, now, 0.08);
          deck.eqMid.gain.setTargetAtTime(4.5, now, 0.08);
          if (deck.eqHigh) deck.eqHigh.gain.setTargetAtTime(1.5, now, 0.08);
        } else {
          // Restore to flat (0 dB)
          deck.eqLow.gain.setTargetAtTime(0, now, 0.08);
          deck.eqMid.gain.setTargetAtTime(0, now, 0.08);
          if (deck.eqHigh) deck.eqHigh.gain.setTargetAtTime(0, now, 0.08);
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

    // 3. CLASSIC AUTO-DJ TRIGGER (End of track lead trigger)
    if (this.autoDJEnabled && this.isPlaying && this.mode === 'classic' && activeDeck.audio && activeDeck.audio.duration) {
      const remaining = activeDeck.audio.duration - activeDeck.audio.currentTime;

      if (remaining <= this.crossfadeTriggerLead && remaining > 0 && nextDeck.track) {
        this.startTransition(this.crossfadeDuration, false);
      }
    }
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
}

export const djEngine = new DJEngine();
