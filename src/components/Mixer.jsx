import React, { useEffect, useRef } from 'react';
import { 
  Play, Pause, FastForward, Sparkles, Waves, Shuffle, 
  Flame, Clock, ArrowRight, Zap, Disc3, Music2
} from 'lucide-react';

export default function Mixer({
  isPlaying,
  autoDJEnabled,
  crossfaderPos,
  isTransitioning,
  transitionData,
  activeDeckId,
  activeTrack,
  nextTrack,
  mode,
  mashupData,
  isDiscoBeatActive,
  onToggleDiscoBeat,
  onTogglePlay,
  onToggleAutoDJ,
  onCrossfaderChange,
  onSkipTrack,
  onJumpToTransition,
  onDropNextMashup,
  onSetMashupSegmentLength,
  getVisualizerData
}) {
  const canvasRef = useRef(null);

  // Real-time Audio Spectrum Visualizer
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const data = getVisualizerData?.();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data && isPlaying) {
        const barWidth = canvas.width / 32;
        let x = 0;

        for (let i = 0; i < 32; i++) {
          const val = data[i * 2] / 255;
          const barHeight = val * (canvas.height - 4);

          const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
          if (isDiscoBeatActive) {
            grad.addColorStop(0, '#f5576c');
            grad.addColorStop(0.5, '#f6d365');
            grad.addColorStop(1, '#00f2fe');
          } else {
            grad.addColorStop(0, '#00f2fe');
            grad.addColorStop(0.5, '#9b51e0');
            grad.addColorStop(1, '#f5576c');
          }

          ctx.fillStyle = grad;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, getVisualizerData, isDiscoBeatActive]);

  const mashupSecLeft = Math.ceil(mashupData?.remainingSec ?? 32);
  const mashupProgress = Math.min(100, Math.max(0, (mashupData?.progress ?? 0) * 100));

  return (
    <div className="dj-mixer">
      {/* Visualizer Display & HUD */}
      <div className="mixer-screen">
        <div className="screen-header">
          <div className="flex items-center gap-1.5">
            <Waves size={14} className={isDiscoBeatActive ? 'text-amber-400' : 'text-cyan-400'} />
            <span className="screen-title">
              {isDiscoBeatActive ? 'DISCO GROOVE MATRIX • 128 BPM' : 'SPECTRUM ANALYZER'}
            </span>
          </div>
          <span className="screen-rate">32-BIT • MASTER BUS</span>
        </div>

        <canvas
          ref={canvasRef}
          width={280}
          height={60}
          className="visualizer-canvas"
        />

        {/* Transition Status & Now Playing HUD */}
        <div className="transition-hud">
          {isTransitioning ? (
            <div className="hud-blending-box">
              <div className="hud-blending">
                <span className="hud-pulse" />
                <span>
                  {mode === 'mashup' ? 'PHRASE BLEND:' : 'CROSSFADING:'} DECK {transitionData.fromDeck} → {transitionData.toDeck} (
                  {(transitionData.remainingSec || 0).toFixed(1)}s)
                </span>
              </div>
              <div className="hud-incoming-title" title={nextTrack?.title}>
                Incoming: <strong>{nextTrack?.title || 'Next Track'}</strong>
              </div>
            </div>
          ) : (
            <div className="hud-idle-box">
              <div className="hud-now-playing-row">
                <span className="hud-live-tag">LIVE [DECK {activeDeckId}]</span>
                <span className="hud-now-playing-name" title={activeTrack?.title}>
                  {activeTrack?.title || 'Waiting for Track...'}
                </span>
              </div>
              <div className="hud-sub-status">
                <span>{mode === 'mashup' ? 'MASHUP ROUTINE' : 'CLASSIC FLOW'}</span>
                {isDiscoBeatActive && (
                  <span className="hud-disco-badge">🕺 DISCO OVERLAY ON</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="mixer-transport">
        <button
          type="button"
          className={`transport-btn-main ${isPlaying ? 'is-playing' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause' : 'Start Playing'}
        >
          {isPlaying ? <Pause size={28} /> : <Play size={28} className="translate-x-0.5" />}
        </button>

        <div className="transport-aux-row">
          <button
            type="button"
            className="aux-btn skip-btn"
            onClick={onSkipTrack}
            title="Smooth phrase blend to the next track"
          >
            <FastForward size={14} />
            <span>Skip Track</span>
          </button>

          {mode === 'classic' && (
            <button
              type="button"
              className="aux-btn test-transition-btn"
              onClick={onJumpToTransition}
              title="Jump to the last 16s to hear the blend right now"
            >
              <Sparkles size={14} />
              <span>Test Blend (-16s)</span>
            </button>
          )}
        </div>
      </div>

      {/* MASHUP MODE CONTROLLER */}
      {mode === 'mashup' && (
        <div className="mashup-control-card">
          <div className="mashup-card-header">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Flame size={16} />
              <span className="mashup-card-title">LIVE MASHUP MODE</span>
            </div>
            <span className="mashup-timer-badge">
              <Clock size={12} /> {mashupSecLeft}s left
            </span>
          </div>

          {/* Progress bar to next drop */}
          <div className="mashup-progress-track">
            <div 
              className="mashup-progress-bar"
              style={{ width: `${mashupProgress}%` }}
            />
          </div>

          <div className="mashup-actions-row">
            {/* Smooth Musical Phrase Drop Button */}
            <button
              type="button"
              className="mashup-drop-btn"
              onClick={onDropNextMashup}
              title="Smooth 6.5s phrase drop into the next track's chorus/drop"
            >
              <Zap size={14} className="text-amber-300" />
              <span>DROP NEXT NOW</span>
              <ArrowRight size={14} />
            </button>

            {/* Segment length switcher */}
            <div className="segment-pills">
              {[25, 35, 50].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`segment-pill ${mashupData?.totalSec === sec ? 'active' : ''}`}
                  onClick={() => onSetMashupSegmentLength(sec)}
                  title={`Switch song every ${sec} seconds`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* 🕺 DISCO BEAT MASHUP BUTTON */}
          <div className="disco-mashup-row">
            <button
              type="button"
              className={`disco-mashup-btn ${isDiscoBeatActive ? 'disco-active' : ''}`}
              onClick={onToggleDiscoBeat}
              title="Play 128 BPM fast upbeat disco groove + isolate target playlist rap vocals"
            >
              <div className="disco-btn-inner">
                <div className="disco-icon-badge">
                  <Disc3 size={18} className={isDiscoBeatActive ? 'spin-fast' : ''} />
                </div>
                <div className="disco-btn-text">
                  <div className="disco-main-label">
                    <span>🕺 DISCO BEAT MASHUP</span>
                    <span className={`disco-status-pill ${isDiscoBeatActive ? 'on' : 'off'}`}>
                      {isDiscoBeatActive ? 'ACTIVE • 128 BPM' : 'OFF'}
                    </span>
                  </div>
                  <div className="disco-desc">
                    {isDiscoBeatActive 
                      ? 'Groove Locked • Bass Filtered • Vocals On Top' 
                      : 'Fast Disco Beat + Vocals Overlay'}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Crossfader Section */}
      <div className="crossfader-container">
        <div className="crossfader-labels">
          <span className={`deck-label ${crossfaderPos < 0.3 ? 'active-a' : ''}`}>
            DECK A
          </span>
          <span className="cf-mode-tag">
            {mode === 'mashup' ? 'PUNCHY PHRASE DROP' : 'EQUAL-POWER BLEND'}
          </span>
          <span className={`deck-label ${crossfaderPos > 0.7 ? 'active-b' : ''}`}>
            DECK B
          </span>
        </div>

        <div className="crossfader-track-wrapper">
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={crossfaderPos}
            onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
            className="dj-crossfader"
            title={`Crossfader: ${Math.round((1 - crossfaderPos) * 100)}% A / ${Math.round(crossfaderPos * 100)}% B`}
          />
        </div>

        <div className="crossfader-presets">
          <button
            type="button"
            className="cf-preset-btn"
            onClick={() => onCrossfaderChange(0.0)}
          >
            100% A
          </button>
          <button
            type="button"
            className="cf-preset-btn"
            onClick={() => onCrossfaderChange(0.5)}
          >
            50 / 50
          </button>
          <button
            type="button"
            className="cf-preset-btn"
            onClick={() => onCrossfaderChange(1.0)}
          >
            100% B
          </button>
        </div>
      </div>

      {/* Auto-DJ Toggle */}
      <div className="mixer-footer-controls">
        <button
          type="button"
          className={`autodj-toggle-btn ${autoDJEnabled ? 'enabled' : 'disabled'}`}
          onClick={onToggleAutoDJ}
        >
          <Shuffle size={14} />
          <span>Auto Transitions: {autoDJEnabled ? 'AUTOMATIC' : 'MANUAL'}</span>
        </button>
      </div>
    </div>
  );
}
