import React from 'react';
import { Disc3, Flame, Radio, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

export default function Header({ mode, setMode, playlistTitle, targetUrl, trackCount }) {
  return (
    <header className="dj-header">
      <div className="header-left">
        <div className="logo-badge">
          <Disc3 className="logo-icon spin-slow" />
          <div>
            <div className="logo-title">
              AUTO-DJ <span>STUDIO</span>
            </div>
            <div className="logo-sub">
              Desi Hip-Hop Extended Set • {trackCount || 39} Tracks
            </div>
          </div>
        </div>

        <div className="quality-pill-group">
          <div className="quality-pill" title="EBU R128 Mastered (-14 LUFS Integrated)">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>EBU R128 Mastered</span>
          </div>
          <div className="quality-pill" title="Speed Protection: Tracks are NEVER slowed down below 1.0x">
            <Zap size={14} className="text-cyan-400" />
            <span>Speed Protection (≥ 1.0x)</span>
          </div>
        </div>
      </div>

      {/* Mode Switcher: Mashup Mode vs Classic Auto-DJ */}
      <div className="mode-switcher-container">
        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-btn ${mode === 'mashup' ? 'active' : ''}`}
            onClick={() => setMode('mashup')}
          >
            <Flame size={15} className="text-amber-400" />
            <span>Live Mashup Mode</span>
          </button>

          <button
            type="button"
            className={`mode-btn ${mode === 'classic' ? 'active' : ''}`}
            onClick={() => setMode('classic')}
          >
            <Radio size={15} />
            <span>Classic Auto-DJ</span>
          </button>
        </div>

        <div className="mode-hint">
          {mode === 'mashup' ? (
            <span>• Hot Phrase Cuts • Beat Drop Quantization • Matching Vibes • No Long Waits</span>
          ) : (
            <span>• Full Track Flow • 8s Equal-Power Blend at Track Ends • Natural Flow</span>
          )}
        </div>
      </div>

      <div className="header-right">
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="playlist-source-link"
          title="Open Original YouTube Target Playlist"
        >
          <span>YouTube Playlist</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </header>
  );
}
