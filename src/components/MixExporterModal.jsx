import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, Disc, Download, Play, CheckCircle2, 
  Sparkles, Radio, Loader2, FileAudio, ArrowRight 
} from 'lucide-react';
import { djEngine } from '../audio/DJEngine';

export default function MixExporterModal({
  isOpen,
  onClose,
  deckATrack,
  deckBTrack,
  activeDeckId
}) {
  const [tab, setTab] = useState('live'); // 'live' | 'offline'
  
  // Live Recording state
  const [isRecording, setIsRecording] = useState(djEngine.isRecording);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const recordTimerRef = useRef(null);

  // Offline Render state
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState('');
  const [renderedWavBlob, setRenderedWavBlob] = useState(null);

  // Sync with engine recording state
  useEffect(() => {
    djEngine.onRecordingStateChange = ({ isRecording: rec }) => {
      setIsRecording(rec);
      if (rec) {
        setRecordSeconds(0);
        setRecordedBlob(null);
        recordTimerRef.current = setInterval(() => {
          setRecordSeconds((s) => s + 1);
        }, 1000);
      } else {
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      }
    };

    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStartRecording = () => {
    djEngine.startLiveRecording();
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    const blob = await djEngine.stopLiveRecording();
    setIsRecording(false);
    if (blob) {
      setRecordedBlob(blob);
    }
  };

  const handleDownloadLiveRecording = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AutoDJ_Live_Mix_${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRenderOfflineTransition = async () => {
    if (!deckATrack || !deckBTrack) return;
    setIsRendering(true);
    setRenderProgress(5);
    setRenderStatus('Initializing offline audio graph...');

    try {
      const fromTrack = activeDeckId === 'A' ? deckATrack : deckBTrack;
      const toTrack = activeDeckId === 'A' ? deckBTrack : deckATrack;

      const wavBlob = await djEngine.renderOfflineTransitionMix(fromTrack, toTrack, (progress, status) => {
        setRenderProgress(progress);
        setRenderStatus(status);
      });

      setRenderedWavBlob(wavBlob);
      setIsRendering(false);

      // Auto trigger download
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AutoDJ_${fromTrack.title.slice(0, 15)}_x_${toTrack.title.slice(0, 15)}_Mix.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Offline render error:', err);
      setRenderStatus(`Failed: ${err.message}`);
      setIsRendering(false);
    }
  };

  return (
    <div className="preset-modal-backdrop" onClick={onClose}>
      <div className="preset-modal-card export-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="preset-modal-header">
          <div className="flex items-center gap-3">
            <div className="export-header-icon">
              <Download size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="modal-title">EXPORT / SAVE DJ MIX</h2>
              <p className="modal-subtitle">Download your custom mix session as a high-fidelity audio file</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="export-tabs-row">
          <button
            type="button"
            className={`export-tab-btn ${tab === 'live' ? 'active' : ''}`}
            onClick={() => setTab('live')}
          >
            <Radio size={14} className={isRecording ? 'animate-pulse text-rose-500' : ''} />
            <span>Live Session Recorder</span>
          </button>
          <button
            type="button"
            className={`export-tab-btn ${tab === 'offline' ? 'active' : ''}`}
            onClick={() => setTab('offline')}
          >
            <Sparkles size={14} className="text-cyan-400" />
            <span>1-Click Seamless WAV Render</span>
          </button>
        </div>

        {/* Tab 1: Live Set Recording */}
        {tab === 'live' && (
          <div className="export-tab-body">
            <div className="export-info-box">
              <p>
                Record your live set in real-time — captures all crossfades, jog scratches, 
                reverb spaces, tempo shifts, and mashups directly from the Web Audio master output.
              </p>
            </div>

            <div className="rec-status-display">
              <div className={`rec-blinker ${isRecording ? 'blinking' : ''}`} />
              <div className="rec-time-code">
                {formatTimer(recordSeconds)}
              </div>
              <div className="rec-state-label">
                {isRecording ? 'RECORDING LIVE DJ SET...' : recordedBlob ? 'RECORDING READY TO DOWNLOAD' : 'STANDBY (READY TO RECORD)'}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-6">
              {!isRecording ? (
                <button
                  type="button"
                  className="rec-action-btn start-rec"
                  onClick={handleStartRecording}
                >
                  <span className="rec-dot" />
                  <span>START RECORDING</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="rec-action-btn stop-rec"
                  onClick={handleStopRecording}
                >
                  <span className="stop-square" />
                  <span>STOP & SAVE RECORDING</span>
                </button>
              )}

              {recordedBlob && !isRecording && (
                <button
                  type="button"
                  className="rec-download-btn"
                  onClick={handleDownloadLiveRecording}
                >
                  <Download size={16} />
                  <span>DOWNLOAD MIX ({(recordedBlob.size / 1024 / 1024).toFixed(2)} MB)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Offline 1-Click Transition WAV Render */}
        {tab === 'offline' && (
          <div className="export-tab-body">
            <div className="export-info-box">
              <p>
                Rave.DJ style instant mixdown: Fast-renders a seamless 36-second CD-quality (16-bit 44.1kHz WAV)
                transition between the two active decks using your custom cue-in and outro trim points.
              </p>
            </div>

            <div className="offline-tracks-preview">
              <div className="preview-deck-box">
                <span className="deck-tag">FROM DECK {activeDeckId}</span>
                <span className="track-name">{activeDeckId === 'A' ? deckATrack?.title : deckBTrack?.title}</span>
                <span className="track-bpm">{activeDeckId === 'A' ? deckATrack?.bpm : deckBTrack?.bpm} BPM</span>
              </div>

              <div className="transition-arrow">
                <ArrowRight size={20} className="text-cyan-400" />
                <span className="blend-tag">8s Seamless Blend</span>
              </div>

              <div className="preview-deck-box">
                <span className="deck-tag">TO DECK {activeDeckId === 'A' ? 'B' : 'A'}</span>
                <span className="track-name">{activeDeckId === 'A' ? deckBTrack?.title : deckATrack?.title}</span>
                <span className="track-bpm">{activeDeckId === 'A' ? deckBTrack?.bpm : deckATrack?.bpm} BPM</span>
              </div>
            </div>

            {isRendering && (
              <div className="render-progress-box">
                <div className="progress-info-row">
                  <span>{renderStatus}</span>
                  <span>{renderProgress}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${renderProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                type="button"
                className="render-action-btn"
                disabled={isRendering || !deckATrack || !deckBTrack}
                onClick={handleRenderOfflineTransition}
              >
                {isRendering ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-cyan-400" />
                    <span>RENDERING MIXDOWN...</span>
                  </>
                ) : (
                  <>
                    <FileAudio size={16} className="text-cyan-400" />
                    <span>RENDER & DOWNLOAD SEAMLESS MIX (.WAV)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
