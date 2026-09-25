import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Pause, RotateCcw, Save, Sliders, 
  Clock, Zap, Sparkles, Volume2, CheckCircle2, Trash2 
} from 'lucide-react';
import { djEngine } from '../audio/DJEngine';

export default function PresetEditorModal({
  isOpen,
  onClose,
  track,
  deckId,
  currentDeckTime = 0,
  onPresetSaved
}) {
  if (!isOpen || !track) return null;

  const initialPreset = djEngine.loadPresetForTrack(track.id) || {};
  const trackDuration = track.duration || 180;

  const [trimStart, setTrimStart] = useState(initialPreset.trimStart ?? 0);
  const [trimEnd, setTrimEnd] = useState(initialPreset.trimEnd ?? trackDuration);
  const [speed, setSpeed] = useState(initialPreset.speed ?? 1.0);
  const [reverbWet, setReverbWet] = useState(initialPreset.reverbWet ?? 0.0);
  const [reverbDecay, setReverbDecay] = useState(initialPreset.reverbDecay ?? 2.2);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState('start'); // 'start' | 'end'
  const previewAudioRef = useRef(null);
  const previewTimerRef = useRef(null);

  const targetBpm = Math.round((track.bpm || 128) * speed);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00.0';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  // Preview custom start or end point
  const handleTogglePreviewStart = () => {
    if (isPreviewing && previewMode === 'start') {
      stopPreview();
    } else {
      startPreview('start', trimStart, 6.0);
    }
  };

  const handleTogglePreviewEnd = () => {
    if (isPreviewing && previewMode === 'end') {
      stopPreview();
    } else {
      const startAt = Math.max(0, trimEnd - 5.0);
      startPreview('end', startAt, 5.0);
    }
  };

  const startPreview = (mode, startFromSec, durationSec) => {
    if (!previewAudioRef.current) return;
    stopPreview();
    const audio = previewAudioRef.current;
    audio.currentTime = startFromSec;
    audio.playbackRate = speed;
    audio.preservesPitch = true;
    audio.volume = 0.9;
    audio.play().catch(console.error);
    setIsPreviewing(true);
    setPreviewMode(mode);

    const startTime = performance.now();

    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      setPreviewProgress(Math.min(100, (elapsed / durationSec) * 100));

      if (elapsed >= durationSec) {
        stopPreview();
      } else {
        previewTimerRef.current = requestAnimationFrame(tick);
      }
    };
    previewTimerRef.current = requestAnimationFrame(tick);
  };

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (previewTimerRef.current) {
      cancelAnimationFrame(previewTimerRef.current);
    }
    setIsPreviewing(false);
    setPreviewProgress(0);
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  const handleUseCurrentTimeStart = () => {
    if (currentDeckTime > 0) {
      const trimmed = Math.min(trackDuration - 5, Math.max(0, parseFloat(currentDeckTime.toFixed(1))));
      setTrimStart(trimmed);
    }
  };

  const handleUseCurrentTimeEnd = () => {
    if (currentDeckTime > 0) {
      const trimmed = Math.max(trimStart + 5, Math.min(trackDuration, parseFloat(currentDeckTime.toFixed(1))));
      setTrimEnd(trimmed);
    }
  };

  const handleSave = () => {
    stopPreview();
    const hasOutroCut = trimEnd < trackDuration - 1.5;
    const presetData = {
      trimStart: parseFloat(trimStart.toFixed(1)),
      trimEnd: hasOutroCut ? parseFloat(trimEnd.toFixed(1)) : null,
      speed: parseFloat(speed.toFixed(2)),
      reverbWet: parseFloat(reverbWet.toFixed(2)),
      reverbDecay: parseFloat(reverbDecay.toFixed(1)),
      savedAt: Date.now()
    };

    djEngine.savePresetForTrack(track.id, presetData);

    // If this track is currently loaded on deck A or B, apply live!
    if (deckId) {
      djEngine.setDeckStartPoint(deckId, presetData.trimStart);
      djEngine.setDeckOutroPoint(deckId, presetData.trimEnd);
      djEngine.setDeckRate(deckId, presetData.speed);
      djEngine.setDeckReverb(deckId, presetData.reverbWet, presetData.reverbDecay);
    }

    onPresetSaved?.(track.id, presetData);
    onClose();
  };

  const handleReset = () => {
    stopPreview();
    djEngine.deletePresetForTrack(track.id);
    setTrimStart(0);
    setTrimEnd(trackDuration);
    setSpeed(1.0);
    setReverbWet(0.0);
    setReverbDecay(2.2);

    if (deckId) {
      djEngine.setDeckStartPoint(deckId, 0);
      djEngine.setDeckOutroPoint(deckId, null);
      djEngine.setDeckRate(deckId, 1.0);
      djEngine.setDeckReverb(deckId, 0.0, 2.2);
    }

    onPresetSaved?.(track.id, null);
    onClose();
  };

  return (
    <div className="preset-modal-backdrop" onClick={onClose}>
      <div className="preset-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Hidden preview audio element */}
        <audio ref={previewAudioRef} src={track.audioUrl} preload="auto" playsInline />

        {/* Modal Header */}
        <div className="preset-modal-header">
          <div className="preset-header-track">
            <img src={track.artwork} alt={track.title} className="preset-track-art" />
            <div>
              <div className="preset-modal-title">
                <Sliders size={16} className="text-cyan-400" />
                <span>MIX PRESET STUDIO</span>
              </div>
              <div className="preset-track-name" title={track.title}>{track.title}</div>
              <div className="preset-track-artist">{track.artist}</div>
            </div>
          </div>
          <button type="button" className="preset-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Controls Body */}
        <div className="preset-modal-body">
          {/* SECTION 1: TRIM START POINT */}
          <div className="preset-section">
            <div className="preset-section-header">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Clock size={16} />
                <span className="section-title">START POINT / TRIM INTRO</span>
              </div>
              <span className="preset-val-badge text-cyan-300">
                {formatTime(trimStart)} / {formatTime(trackDuration)}
              </span>
            </div>

            <p className="preset-hint">
              Skip slow intros and drop the track right into the verse or beat drop.
            </p>

            <div className="preset-slider-container">
              <input
                type="range"
                min="0"
                max={Math.max(10, trackDuration - 10)}
                step="0.5"
                value={trimStart}
                onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                className="preset-range-slider cyan-accent"
              />
            </div>

            <div className="preset-trim-actions">
              <button
                type="button"
                className="preset-action-chip"
                onClick={handleUseCurrentTimeStart}
                disabled={currentDeckTime <= 0}
                title="Capture currently playing timestamp on deck"
              >
                Use Current Deck Time ({formatTime(currentDeckTime)})
              </button>

              <button
                type="button"
                className={`preset-preview-btn ${isPreviewing && previewMode === 'start' ? 'preview-active' : ''}`}
                onClick={handleTogglePreviewStart}
              >
                {isPreviewing && previewMode === 'start' ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPreviewing && previewMode === 'start' ? 'Stop Preview' : 'Preview Start Drop'}</span>
              </button>
            </div>

            {isPreviewing && previewMode === 'start' && (
              <div className="preview-progress-bar">
                <div className="preview-progress-fill" style={{ width: `${previewProgress}%` }} />
              </div>
            )}
          </div>

          {/* SECTION 1B: TRIM OUTRO / END POINT */}
          <div className="preset-section">
            <div className="preset-section-header">
              <div className="flex items-center gap-1.5 text-rose-400">
                <Clock size={16} />
                <span className="section-title">END POINT / TRIM OUTRO (Piche Ka Cut)</span>
              </div>
              <span className="preset-val-badge text-rose-300">
                {formatTime(trimEnd)} / {formatTime(trackDuration)}
              </span>
            </div>

            <p className="preset-hint">
              Set where the track should cut off or trigger transition, cutting out long dead outros.
            </p>

            <div className="preset-slider-container">
              <input
                type="range"
                min={Math.max(5, trimStart + 5)}
                max={trackDuration}
                step="0.5"
                value={trimEnd}
                onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                className="preset-range-slider rose-accent"
              />
            </div>

            <div className="preset-trim-actions">
              <button
                type="button"
                className="preset-action-chip"
                onClick={handleUseCurrentTimeEnd}
                disabled={currentDeckTime <= 0}
                title="Capture currently playing timestamp on deck for Outro Cut"
              >
                Use Current Deck Time ({formatTime(currentDeckTime)})
              </button>

              <button
                type="button"
                className={`preset-preview-btn ${isPreviewing && previewMode === 'end' ? 'preview-active' : ''}`}
                onClick={handleTogglePreviewEnd}
              >
                {isPreviewing && previewMode === 'end' ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPreviewing && previewMode === 'end' ? 'Stop Preview' : 'Preview Outro Cut'}</span>
              </button>
            </div>

            {isPreviewing && previewMode === 'end' && (
              <div className="preview-progress-bar">
                <div className="preview-progress-fill" style={{ width: `${previewProgress}%`, backgroundColor: '#f43f5e' }} />
              </div>
            )}
          </div>

          {/* SECTION 2: SPEED UP TRACK */}
          <div className="preset-section">
            <div className="preset-section-header">
              <div className="flex items-center gap-1.5 text-amber-400">
                <Zap size={16} />
                <span className="section-title">TEMPO BOOST & SPEED UP</span>
              </div>
              <span className="preset-val-badge text-amber-300">
                {speed.toFixed(2)}x • {targetBpm} BPM
              </span>
            </div>

            <p className="preset-hint">
              Speed up playback without altering pitch. Vocals stay natural while tempo gets hype.
            </p>

            <div className="preset-slider-container">
              <input
                type="range"
                min="1.00"
                max="1.30"
                step="0.01"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="preset-range-slider amber-accent"
              />
            </div>

            <div className="speed-pills-row">
              {[
                { label: '1.00x Normal', val: 1.00 },
                { label: '1.05x Groove', val: 1.05 },
                { label: '1.10x Pumped', val: 1.10 },
                { label: '1.18x Club', val: 1.18 },
                { label: '1.25x Turbo', val: 1.25 }
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  className={`speed-preset-pill ${Math.abs(speed - p.val) < 0.005 ? 'active' : ''}`}
                  onClick={() => setSpeed(p.val)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 3: REVERB EFFECT */}
          <div className="preset-section">
            <div className="preset-section-header">
              <div className="flex items-center gap-1.5 text-purple-400">
                <Sparkles size={16} />
                <span className="section-title">STUDIO REVERB EFFECT</span>
              </div>
              <span className="preset-val-badge text-purple-300">
                {reverbWet > 0 ? `${Math.round(reverbWet * 100)}% Wet Space` : 'OFF'}
              </span>
            </div>

            <p className="preset-hint">
              Add lush spatial acoustics and atmospheric depth to the vocals and instruments.
            </p>

            <div className="preset-slider-container">
              <input
                type="range"
                min="0.0"
                max="0.85"
                step="0.05"
                value={reverbWet}
                onChange={(e) => setReverbWet(parseFloat(e.target.value))}
                className="preset-range-slider purple-accent"
              />
            </div>

            <div className="decay-pills-row">
              {[
                { label: 'Small Room (1.2s)', val: 1.2 },
                { label: 'Concert Hall (2.5s)', val: 2.5 },
                { label: 'Cathedral (4.0s)', val: 4.0 }
              ].map((d) => (
                <button
                  key={d.val}
                  type="button"
                  className={`decay-pill ${Math.abs(reverbDecay - d.val) < 0.1 ? 'active' : ''}`}
                  onClick={() => setReverbDecay(d.val)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="preset-modal-footer">
          <button
            type="button"
            className="preset-reset-btn"
            onClick={handleReset}
            title="Clear custom preset and revert to defaults"
          >
            <Trash2 size={15} />
            <span>Reset Track Defaults</span>
          </button>

          <button
            type="button"
            className="preset-save-btn"
            onClick={handleSave}
            title="Save preset to localStorage and apply immediately to mix"
          >
            <Save size={16} />
            <span>SAVE TO MIX PRESET</span>
          </button>
        </div>
      </div>
    </div>
  );
}
