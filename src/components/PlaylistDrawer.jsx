import React from 'react';
import { ListMusic, Play, Clock, Flame, ArrowRightLeft, CheckCircle2, Sliders, Sparkles } from 'lucide-react';

export default function PlaylistDrawer({
  tracks,
  activeTrackId,
  nextTrackId,
  activeDeckId,
  isBpmOrder,
  presets = {},
  onToggleOrder,
  onSelectTrack,
  onOpenPresetEditor
}) {
  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="playlist-drawer">
      <div className="playlist-drawer-header">
        <div className="flex items-center gap-2">
          <ListMusic size={18} className="text-cyan-400" />
          <h3 className="playlist-title">TARGET PLAYLIST QUEUE</h3>
          <span className="playlist-count">({tracks.length} Tracks)</span>
        </div>

        {/* Order Selector (Default vs BPM Flow) */}
        <div className="order-toggle-container">
          <button
            type="button"
            className={`order-btn ${!isBpmOrder ? 'active' : ''}`}
            onClick={() => onToggleOrder(false)}
            title="Play in original YouTube playlist order"
          >
            <span>Original Order</span>
          </button>

          <button
            type="button"
            className={`order-btn ${isBpmOrder ? 'active' : ''}`}
            onClick={() => onToggleOrder(true)}
            title="Optimized DJ sequencing by BPM proximity"
          >
            <Flame size={13} className="text-amber-400" />
            <span>BPM-Flow Order</span>
          </button>
        </div>
      </div>

      <div className="track-list">
        {tracks.map((track, idx) => {
          const isActive = track.id === activeTrackId;
          const isNext = track.id === nextTrackId;

          let badgeText = null;
          let badgeClass = '';

          if (isActive) {
            badgeText = `PLAYING ON DECK ${activeDeckId}`;
            badgeClass = activeDeckId === 'A' ? 'badge-deck-a' : 'badge-deck-b';
          } else if (isNext) {
            badgeText = `UP NEXT (DECK ${activeDeckId === 'A' ? 'B' : 'A'})`;
            badgeClass = 'badge-up-next';
          }

          return (
            <div
              key={track.id}
              className={`track-item ${isActive ? 'is-active-track' : ''} ${isNext ? 'is-next-track' : ''}`}
              onClick={() => onSelectTrack(track)}
            >
              <div className="track-index">
                {isActive ? (
                  <span className="playing-bars">
                    <span className="bar bar-1" />
                    <span className="bar bar-2" />
                    <span className="bar bar-3" />
                  </span>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              <div className="track-art-wrapper">
                <img src={track.artwork} alt={track.title} className="track-thumb" />
                <button
                  type="button"
                  className="track-play-hover"
                  title="Queue/Play Track"
                >
                  <Play size={16} />
                </button>
              </div>

              <div className="track-meta">
                <div className="track-title-row">
                  <span className="track-name">{track.title}</span>
                  {badgeText && (
                    <span className={`track-status-tag ${badgeClass}`}>
                      {badgeText}
                    </span>
                  )}
                </div>
                <div className="track-artist-row">
                  <span>{track.artist}</span>
                </div>
              </div>

              <div className="track-stats">
                {presets[track.id] && (
                  <span className="track-preset-indicator" title="Custom Preset Active (Trim/Speed/Reverb)">
                    ⭐ PRESET
                  </span>
                )}

                <div className="track-bpm-tag">
                  {track.bpm ? `${track.bpm} BPM` : '—'}
                </div>
                <div className="track-duration">
                  <Clock size={12} />
                  <span>{formatTime(track.duration)}</span>
                </div>

                <button
                  type="button"
                  className="track-edit-preset-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPresetEditor?.(null, track);
                  }}
                  title="Edit Track Preset (Trim Start, Speed, Reverb)"
                >
                  <Sliders size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
