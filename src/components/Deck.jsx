import React, { useRef, useState, useEffect } from 'react';
import { Disc, Play, Pause, Volume2, Activity, Music, Zap, Sliders, Sparkles, KeyRound, ArrowDownCircle } from 'lucide-react';
import WaveformVisualizer from './WaveformVisualizer';
import { CAMELOT_COLORS } from '../utils/harmonicMixing';
import { djEngine } from '../audio/DJEngine';

export default function Deck({
  deckId,
  deckState,
  isActiveMaster,
  isTransitioning,
  mode,
  currentBeat,
  presets = {},
  onSeek,
  onSetCue,
  onDropTrack,
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
  const jogRef = useRef(null);
  const [isDraggingJog, setIsDraggingJog] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [rotationAngle, setRotationAngle] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

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
    <div 
      className={`dj-deck ${themeClass} ${isActiveMaster ? 'is-active-master' : ''} ${isDragOver ? 'is-deck-drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const raw = e.dataTransfer.getData('application/json');
        if (raw) {
          try {
            const dropped = JSON.parse(raw);
            onDropTrack?.(deckId, dropped);
          } catch (err) {
            console.error('Track drop error:', err);
          }
        }
      }}
    >
      {/* Drag & Drop Visual Target Overlay */}
      {isDragOver && (
        <div className="deck-dropzone-overlay">
          <ArrowDownCircle size={38} className="animate-bounce text-cyan-400" />
          <span className="drop-title">DROP TO LOAD ON DECK {deckId}</span>
          <span className="drop-sub">Release track to immediately stage and cue</span>
        </div>
      )}

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
          {track ? track.artist : 'Waiting for queue (Drag track here)'}
        </div>

        {/* BPM, Key & Speed Tag */}
        <div className="deck-bpm-strip">
          <div className="bpm-badge">
            <Music size={13} />
            <span>{bpm ? `${bpm} BPM` : '128.0 BPM'}</span>
          </div>

          {track?.camelot && (
            <div 
              className="camelot-badge" 
              title={`Harmonic Key: ${track.key || ''} (Camelot Code: ${track.camelot})`}
              style={{ borderColor: `${CAMELOT_COLORS[track.camelot] || '#00f2fe'}66` }}
            >
              <KeyRound size={12} style={{ color: CAMELOT_COLORS[track.camelot] || '#00f2fe' }} />
              <span>{track.camelot} · {track.key}</span>
            </div>
          )}

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

        {/* Pro Waveform Visualizer with Beat Grid & Manual Cue Points */}
        <WaveformVisualizer
          deckId={deckId}
          track={track}
          currentTime={currentTime}
          duration={duration}
          cueTime={cueTime}
          trimStart={track ? (presets[track.id]?.trimStart || 0) : 0}
          trimEnd={track ? (presets[track.id]?.trimEnd || null) : null}
          bpm={bpm}
          isPlaying={isPlaying}
          accentColor={accentColor}
          analyserNode={djEngine.getDeckAnalyser(deckId)}
          onSeek={(time) => onSeek(deckId, time)}
          onSetCue={(time) => onSetCue(deckId, time)}
        />
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
