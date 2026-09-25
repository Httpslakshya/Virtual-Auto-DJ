import React, { useRef, useState, useEffect } from 'react';
import { Disc, Play, Pause, Volume2, Activity, Music, Zap, Sliders, Sparkles } from 'lucide-react';

export default function Deck({
  deckId,
  deckState,
  isActiveMaster,
  isTransitioning,
  mode,
  currentBeat,
  onSeek,
  onVolumeChange,
  onEQChange,
  onPlayPause,
  onCueDown,
  onCueUp,
  onJogScratchStart,
  onJogScratchMove,
  onJogScratchEnd,
  onOpenPresetEditor
}) {
  const progressBarRef = useRef(null);
  const jogRef = useRef(null);
  const [isDraggingJog, setIsDraggingJog] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [rotationAngle, setRotationAngle] = useState(0);

  const { 
    track, currentTime, duration, volume, eq, 
    isPlaying, rate, bpm, cueTime 
  } = deckState;

  const isDeckA = deckId === 'A';
  const themeClass = isDeckA ? 'deck-a-theme' : 'deck-b-theme';
  const accentColor = isDeckA ? '#00f2fe' : '#f5576c';

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = Math.max(0, duration - currentTime);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleProgressClick = (e) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(deckId, pos * duration);
  };

  // Interactive Jog Wheel Scratching
  const handleJogMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingJog(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    onJogScratchStart(deckId);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingJog || !jogRef.current) return;
      const rect = jogRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const prevAngle = Math.atan2(lastMousePos.y - centerY, lastMousePos.x - centerX) * (180 / Math.PI);
      const newAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

      let deltaAngle = newAngle - prevAngle;
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;

      setRotationAngle((prev) => (prev + deltaAngle) % 360);
      setLastMousePos({ x: e.clientX, y: e.clientY });

      onJogScratchMove(deckId, deltaAngle);
    };

    const handleMouseUp = () => {
      if (isDraggingJog) {
        setIsDraggingJog(false);
        onJogScratchEnd(deckId);
      }
    };

    if (isDraggingJog) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingJog, lastMousePos, deckId, onJogScratchMove, onJogScratchEnd]);

  return (
    <div className={`dj-deck ${themeClass} ${isActiveMaster ? 'is-active-master' : ''}`}>
      {/* Deck Header & Status */}
      <div className="deck-top-bar">
        <div className="deck-badge">
          <span className="deck-letter">DECK {deckId}</span>
          <span className="deck-accent-dot" />
        </div>

        {/* 4-Beat Bar Indicator */}
        <div className="beat-grid-pills" title="4-Beat Downbeat Visualizer">
          {[1, 2, 3, 4].map((b) => (
            <span
              key={b}
              className={`beat-pill ${currentBeat === b && isPlaying ? 'active-beat' : ''} ${b === 1 ? 'downbeat' : ''}`}
            >
              {b}
            </span>
          ))}
        </div>

        <div className="deck-status-pill">
          {isTransitioning ? (
            <span className="status-fade">
              <Activity size={12} className="spin-fast" /> BLENDING
            </span>
          ) : isActiveMaster ? (
            <span className="status-live">
              <span className="pulse-dot" /> LIVE
            </span>
          ) : track ? (
            <span className="status-standby">QUEUED</span>
          ) : (
            <span className="status-empty">EMPTY</span>
          )}
        </div>
      </div>

      {/* Turntable Platter with Mouse Scratching */}
      <div className="turntable-container">
        <div
          ref={jogRef}
          className={`vinyl-disc ${isPlaying && !isDraggingJog ? 'spinning' : 'stopped'} ${isDraggingJog ? 'scratching' : ''}`}
          onMouseDown={handleJogMouseDown}
          title="Click & Drag to Scratch!"
          style={isDraggingJog ? { transform: `rotate(${rotationAngle}deg)` } : undefined}
        >
          <div className="strobe-rim" />
          <div className="vinyl-grooves">
            <div className="vinyl-center-label">
              {track?.artwork ? (
                <img src={track.artwork} alt={track.title} className="vinyl-art" />
              ) : (
                <Disc size={36} color="#888" />
              )}
              <div className="scratch-marker-stripe" />
              <div className="vinyl-spindle" />
            </div>
          </div>
        </div>

        {/* Tonearm */}
        <div className={`tonearm ${isPlaying ? 'tonearm-on' : 'tonearm-off'}`}>
          <div className="tonearm-base" />
          <div className="tonearm-shaft" />
          <div className="tonearm-cartridge" />
        </div>
      </div>

      {/* Track Information Display */}
      <div className="deck-display">
        <div className="track-title" title={track?.title || 'No Track Loaded'}>
          {track ? track.title : '— No Track Loaded —'}
        </div>
        <div className="track-artist">
          {track ? track.artist : 'Waiting for queue'}
        </div>

        {/* BPM & Speed Tag */}
        <div className="deck-bpm-strip">
          <div className="bpm-badge">
            <Music size={13} />
            <span>{bpm ? `${bpm} BPM` : '128.0 BPM'}</span>
          </div>

          <div className="pitch-sync-badge" title="Track Speed / Rate">
            <Zap size={13} className="text-emerald-400" />
            <span>{(rate || 1.0).toFixed(2)}x Speed</span>
          </div>

          {track && (
            <button
              type="button"
              className="deck-preset-btn"
              onClick={() => onOpenPresetEditor?.(deckId, track)}
              title="Open Mix Preset: Trim Start Point, Boost Speed, Add Reverb"
            >
              <Sliders size={12} className="text-cyan-400" />
              <span>EDIT PRESET</span>
            </button>
          )}
        </div>

        {/* Scrubber */}
        <div className="deck-time-row">
          <span className="time-elapsed">{formatTime(currentTime)}</span>
          <div
            ref={progressBarRef}
            className="waveform-scrubber"
            onClick={handleProgressClick}
            title="Click to seek"
          >
            <div
              className="waveform-progress"
              style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
            />
            {duration > 0 && (
              <div
                className="cue-marker"
                style={{ left: `${Math.min(100, ((cueTime || 0) / duration) * 100)}%` }}
                title={`Cue Point: ${formatTime(cueTime || 0)}`}
              />
            )}
          </div>
          <span className="time-remaining">-{formatTime(remainingTime)}</span>
        </div>
      </div>

      {/* Clean Performance Controls (Cue & Play) */}
      <div className="deck-performance-clean">
        <button
          type="button"
          className="clean-cue-btn"
          onMouseDown={() => onCueDown(deckId)}
          onMouseUp={() => onCueUp(deckId)}
          onTouchStart={() => onCueDown(deckId)}
          onTouchEnd={() => onCueUp(deckId)}
          title="CUE: Press while playing to jump back to Cue point. Hold while paused for preview."
        >
          CUE
        </button>

        <button
          type="button"
          className={`clean-play-btn ${isPlaying ? 'is-playing' : ''}`}
          onClick={() => onPlayPause(deckId)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>
      </div>

      {/* Channel EQ & Volume Strip */}
      <div className="deck-channel-strip">
        <div className="eq-group">
          <div className="eq-knob-container">
            <span className="eq-label">HI</span>
            <input
              type="range"
              min="-18"
              max="6"
              step="1"
              value={eq?.high ?? 0}
              onChange={(e) => onEQChange(deckId, 'high', parseFloat(e.target.value))}
              className="eq-slider"
              title={`High: ${eq?.high ?? 0}dB`}
              onDoubleClick={() => onEQChange(deckId, 'high', 0)}
            />
            <span className="eq-value">{eq?.high ?? 0}dB</span>
          </div>

          <div className="eq-knob-container">
            <span className="eq-label">MID</span>
            <input
              type="range"
              min="-18"
              max="6"
              step="1"
              value={eq?.mid ?? 0}
              onChange={(e) => onEQChange(deckId, 'mid', parseFloat(e.target.value))}
              className="eq-slider"
              title={`Mid: ${eq?.mid ?? 0}dB`}
              onDoubleClick={() => onEQChange(deckId, 'mid', 0)}
            />
            <span className="eq-value">{eq?.mid ?? 0}dB</span>
          </div>

          <div className="eq-knob-container">
            <span className="eq-label text-amber-400">LOW</span>
            <input
              type="range"
              min="-18"
              max="6"
              step="1"
              value={eq?.low ?? 0}
              onChange={(e) => onEQChange(deckId, 'low', parseFloat(e.target.value))}
              className="eq-slider"
              title={`Low: ${eq?.low ?? 0}dB`}
              onDoubleClick={() => onEQChange(deckId, 'low', 0)}
            />
            <span className="eq-value">{eq?.low ?? 0}dB</span>
          </div>
        </div>

        {/* Volume Channel Fader */}
        <div className="fader-group">
          <Volume2 size={16} className="text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume ?? 1}
            onChange={(e) => onVolumeChange(deckId, parseFloat(e.target.value))}
            className="deck-volume-fader"
            title={`Deck ${deckId} Volume: ${Math.round((volume ?? 1) * 100)}%`}
          />
          <span className="fader-value">{Math.round((volume ?? 1) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
