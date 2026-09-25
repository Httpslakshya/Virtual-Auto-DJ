// High-Performance Web Audio Procedural DJ FX Engine
// Provides authentic DJ Airhorn, Laser/Siren, Scratch Chunks, and Vinyl Brake effects

export class DJSoundFX {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
  }

  setContext(audioCtx) {
    this.audioCtx = audioCtx;
  }

  // 1. Classic Dancehall / Club DJ Airhorn
  playAirhorn() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Frequencies for iconic brass airhorn chord
    const freqs = [311.13, 466.16, 622.25, 739.99]; // Eb minor chord

    const bursts = [0, 0.16, 0.32, 0.52]; // 4 quick rhythmic horn bursts

    bursts.forEach((offset, idx) => {
      const burstStart = now + offset;
      const burstDur = idx === bursts.length - 1 ? 0.38 : 0.12;

      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        // Subtle pitch dip at end of burst
        osc.frequency.setValueAtTime(freq * 1.02, burstStart);
        osc.frequency.exponentialRampToValueAtTime(freq, burstStart + 0.04);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.96, burstStart + burstDur);

        // Low-pass filter for punchy brass tone
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, burstStart);
        filter.Q.setValueAtTime(3.0, burstStart);

        // Envelope
        gain.gain.setValueAtTime(0.001, burstStart);
        gain.gain.linearRampToValueAtTime(0.22, burstStart + 0.02);
        gain.gain.setValueAtTime(0.22, burstStart + burstDur - 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, burstStart + burstDur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(burstStart);
        osc.stop(burstStart + burstDur + 0.05);
      });
    });
  }

  // 2. Club Laser / Siren Sweeper
  playSiren() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const duration = 1.4;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    
    // Siren pitch modulation (whoop whoop whoop)
    for (let t = 0; t < duration; t += 0.22) {
      osc.frequency.setValueAtTime(500, now + t);
      osc.frequency.exponentialRampToValueAtTime(1600, now + t + 0.11);
      osc.frequency.exponentialRampToValueAtTime(500, now + t + 0.22);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.setValueAtTime(0.35, now + duration - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // 3. Realistic Vinyl Scratch Burst ("Wikka-Wikka")
  playScratchBurst() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Buffer of filtered noise with pitch modulated bandpass
    const bufferSize = ctx.sampleRate * 0.45;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(8, now);

    // Scratch pitch motion: forward -> backward -> forward
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(2200, now + 0.08);
    filter.frequency.linearRampToValueAtTime(300, now + 0.2);
    filter.frequency.linearRampToValueAtTime(1800, now + 0.32);
    filter.frequency.linearRampToValueAtTime(200, now + 0.42);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.setValueAtTime(0.35, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.46);
  }

  // 4. Backspin Rewind FX (Rapid Tape/Vinyl Reverse)
  playBackspin(onComplete) {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const duration = 0.9;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    // Exponential pitch rise and flutter like a turntable spinning backwards at 200 RPM
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(2800, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(350, now + duration);

    filter.type = 'bandpass';
    filter.Q.setValueAtTime(4.0, now);
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.3);
    filter.frequency.exponentialRampToValueAtTime(400, now + duration);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    if (onComplete) {
      setTimeout(onComplete, duration * 1000);
    }
  }
}
