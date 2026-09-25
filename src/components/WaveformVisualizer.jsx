import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Flag, Play, Scissors } from 'lucide-react';

// Generates stable pseudo-random waveform peaks for a track so it displays a realistic audio envelope
function generateTrackPeaks(trackId, duration, bpm = 128, count = 200) {
  let seed = 0;
  for (let i = 0; i < (trackId || 'track').length; i++) {
    seed = (seed * 31 + trackId.charCodeAt(i)) & 0xffffffff;
  }
  const random = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };

  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    // DJ track structure simulation: intro build, drop 1, breakdown, drop 2, outro fade
    let envelope = 0.5;
    if (progress < 0.12) {
      // Intro ramp up
      envelope = 0.25 + progress * 3.5;
    } else if (progress >= 0.12 && progress < 0.45) {
      // First verse & drop 1
      envelope = 0.75 + 0.25 * Math.sin(progress * Math.PI * 8);
    } else if (progress >= 0.45 && progress < 0.58) {
      // Breakdown / bridge
      envelope = 0.35 + 0.15 * Math.sin(progress * Math.PI * 4);
    } else if (progress >= 0.58 && progress < 0.88) {
      // Peak drop 2
      envelope = 0.85 + 0.15 * Math.cos(progress * Math.PI * 6);
    } else {
      // Outro ramp down
      envelope = Math.max(0.15, 1.0 - (progress - 0.88) * 6);
    }

    const noise = 0.25 + random() * 0.75;
    peaks[i] = Math.min(1.0, Math.max(0.08, envelope * noise));
  }
  return peaks;
}

export default function WaveformVisualizer({
  deckId,
  track,
  currentTime = 0,
  duration = 0,
  cueTime = 0,
  trimStart = 0,
  trimEnd = null,
  bpm = 128,
  isPlaying = false,
  accentColor = '#00f2fe',
  analyserNode = null,
  onSeek,
  onSetCue
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);

  const peaks = useMemo(() => {
    return generateTrackPeaks(track?.id || 'demo', duration, bpm, 220);
  }, [track?.id, duration, bpm]);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00.0';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  // Render Waveform Canvas with Beat Grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    const dpr = window.devicePixelRatio || 1;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(1, '#05070c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const trackDuration = duration > 0 ? duration : 180;
      const progressRatio = Math.max(0, Math.min(1, currentTime / trackDuration));
      const playheadX = progressRatio * width;

      // 1. BEAT-GRID OVERLAY (Rekordbox / Serato style)
      if (bpm > 0) {
        const beatInterval = 60 / bpm;
        const totalBeats = Math.floor(trackDuration / beatInterval);
        const firstBeat = track?.firstBeat || 0;

        for (let b = 0; b < totalBeats; b++) {
          const beatTime = firstBeat + b * beatInterval;
          if (beatTime > trackDuration) break;

          const beatX = (beatTime / trackDuration) * width;
          const isDownbeat = b % 4 === 0; // Bar start

          ctx.beginPath();
          if (isDownbeat) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)'; // Gold downbeat
            ctx.lineWidth = 1.5;
            ctx.moveTo(beatX, 0);
            ctx.lineTo(beatX, height);
            ctx.stroke();

            // Tiny bar counter marker at top
            ctx.fillStyle = 'rgba(255, 215, 0, 0.65)';
            ctx.fillRect(beatX - 1.5, 0, 3, 5);
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; // Secondary beats
            ctx.lineWidth = 1;
            ctx.moveTo(beatX, height * 0.25);
            ctx.lineTo(beatX, height * 0.75);
            ctx.stroke();
          }
        }
      }

      // 2. LIVE AUDIO ANALYSIS (If playing, modulate waveform height around playhead)
      let liveBoost = 1.0;
      if (isPlaying && analyserNode) {
        const freqData = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(freqData);
        // Bass transient energy
        const bassSum = (freqData[1] + freqData[2] + freqData[3] + freqData[4]) / 4;
        liveBoost = 1.0 + (bassSum / 255) * 0.4;
      }

      // 3. DRAW DUAL-SIDED WAVEFORM BARS
      const numBars = peaks.length;
      const barWidth = width / numBars;
      const centerY = height / 2;

      for (let i = 0; i < numBars; i++) {
        const barX = i * barWidth;
        const barProgress = (i + 0.5) / numBars;
        const isPlayed = barX <= playheadX;

        // Peak height
        let val = peaks[i];
        // If near playhead and playing, react dynamically
        if (isPlaying && Math.abs(barProgress - progressRatio) < 0.05) {
          val = Math.min(1.0, val * liveBoost);
        }

        const barH = Math.max(3, val * (height * 0.42));

        // Color coding: bright accent for played, dimmed cyan/slate for unplayed
        if (isPlayed) {
          ctx.fillStyle = accentColor;
        } else {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
        }

        // Upper bar
        ctx.fillRect(barX + 0.5, centerY - barH, barWidth - 1, barH);
        // Lower mirrored bar (slightly dimmer)
        ctx.fillStyle = isPlayed ? `${accentColor}aa` : 'rgba(71, 85, 105, 0.35)';
        ctx.fillRect(barX + 0.5, centerY, barWidth - 1, barH * 0.65);
      }

      // 4. TRIM START OVERLAY (Dimmed inactive intro)
      if (trimStart > 0) {
        const trimStartX = (trimStart / trackDuration) * width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, trimStartX, height);

        // Trim start marker line
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(trimStartX, 0);
        ctx.lineTo(trimStartX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 5. TRIM END OVERLAY (Dimmed inactive outro)
      if (trimEnd && trimEnd < trackDuration) {
        const trimEndX = (trimEnd / trackDuration) * width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(trimEndX, 0, width - trimEndX, height);

        // Trim end marker line
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(trimEndX, 0);
        ctx.lineTo(trimEndX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 6. CUE POINT FLAG MARKER (Green / Cyan Serato style)
      if (cueTime >= 0) {
        const cueX = (cueTime / trackDuration) * width;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cueX, 0);
        ctx.lineTo(cueX, height);
        ctx.stroke();

        // Flag triangle at top
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(cueX, 0);
        ctx.lineTo(cueX + 10, 5);
        ctx.lineTo(cueX, 10);
        ctx.closePath();
        ctx.fill();

        // Text "CUE"
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('CUE', cueX + 3, 8);
      }

      // 7. CURRENT PLAYHEAD LINE (Glowing vertical laser)
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead diamond knob
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(playheadX, height / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // 8. HOVER POSITION & TIME
      if (hoverPos !== null) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(hoverPos, 0);
        ctx.lineTo(hoverPos, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      if (isPlaying) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [peaks, currentTime, duration, cueTime, trimStart, trimEnd, bpm, isPlaying, accentColor, analyserNode, hoverPos]);

  // Click & Seek / Set Cue
  const handleCanvasClick = (e) => {
    if (!containerRef.current || !duration) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSeconds = ratio * duration;

    // Shift+Click sets Cue Point directly at clicked position!
    if (e.shiftKey) {
      onSetCue?.(targetSeconds);
    } else {
      onSeek?.(targetSeconds);
    }
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current || !duration) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    setHoverPos(x);
    setHoverTime(ratio * duration);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    setHoverTime(null);
  };

  return (
    <div className="waveform-container-wrapper">
      <div
        ref={containerRef}
        className="waveform-canvas-box"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        title="Click to Seek • Shift+Click to Set CUE Point"
      >
        <canvas ref={canvasRef} className="waveform-canvas" />

        {hoverTime !== null && (
          <div
            className="waveform-hover-tooltip"
            style={{ left: `${hoverPos}px` }}
          >
            <span>{formatTime(hoverTime)}</span>
            <small>Click to Seek / Shift+Click to Set CUE</small>
          </div>
        )}
      </div>

      {/* Waveform Micro Action Bar */}
      <div className="waveform-action-bar">
        <div className="waveform-time-tags">
          <span className="time-curr">{formatTime(currentTime)}</span>
          <span className="time-sep">/</span>
          <span className="time-total">{formatTime(duration)}</span>
        </div>

        <div className="waveform-cue-controls">
          <button
            type="button"
            className="waveform-quick-cue-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSetCue?.(currentTime);
            }}
            title="Set Manual Cue Point to Current Playhead Position"
          >
            <Flag size={11} className="text-emerald-400" />
            <span>SET CUE ({formatTime(currentTime)})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
