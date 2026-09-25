import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { djEngine } from './audio/DJEngine';
import playlistData from './data/playlist.json';
import Header from './components/Header';
import Deck from './components/Deck';
import Mixer from './components/Mixer';
import PlaylistDrawer from './components/PlaylistDrawer';
import PresetEditorModal from './components/PresetEditorModal';

export default function App() {
  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const discoAudioRef = useRef(null);

  // App & DJ States
  const [mode, setMode] = useState('mashup'); // 'mashup' | 'classic'
  const [isBpmOrder, setIsBpmOrder] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDiscoBeatActive, setIsDiscoBeatActive] = useState(false);
  const [autoDJEnabled, setAutoDJEnabled] = useState(true);
  const [crossfaderPos, setCrossfaderPos] = useState(0.0);
  const [activeDeckId, setActiveDeckId] = useState('A');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionData, setTransitionData] = useState({
    progress: 0,
    remainingSec: 0,
    fromDeck: 'A',
    toDeck: 'B'
  });

  // Mashup mode tracking
  const [mashupData, setMashupData] = useState({
    remainingSec: 32,
    totalSec: 32,
    progress: 0
  });

  // Real-time Beat pulses (1-2-3-4)
  const [beatA, setBeatA] = useState(1);
  const [beatB, setBeatB] = useState(1);

  // Track queue index
  const [queueIndex, setQueueIndex] = useState(0);

  // User mix presets (Trim start, speed boost, reverb)
  const [presets, setPresets] = useState(() => djEngine.getAllPresets());
  const [presetModalState, setPresetModalState] = useState({
    isOpen: false,
    track: null,
    deckId: null,
    currentDeckTime: 0
  });

  // Ordered tracklist based on order mode
  const currentPlaylist = useMemo(() => {
    if (!isBpmOrder) {
      return playlistData.tracks;
    }
    const map = new Map(playlistData.tracks.map((t) => [t.id, t]));
    return (playlistData.bpmOptimizedOrder || []).map((id) => map.get(id)).filter(Boolean);
  }, [isBpmOrder]);

  const playlistRef = useRef(currentPlaylist);
  useEffect(() => {
    playlistRef.current = currentPlaylist;
  }, [currentPlaylist]);

  // Deck states for UI rendering
  const [deckAState, setDeckAState] = useState({
    track: null,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    rate: 1.0,
    bpm: 128,
    cueTime: 0.0,
    isPlaying: false,
    eq: { low: 0, mid: 0, high: 0 }
  });

  const [deckBState, setDeckBState] = useState({
    track: null,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    rate: 1.0,
    bpm: 128,
    cueTime: 0.0,
    isPlaying: false,
    eq: { low: 0, mid: 0, high: 0 }
  });

  // 1. Initialize DJ Web Audio Engine once on mount
  useEffect(() => {
    if (audioARef.current && audioBRef.current) {
      djEngine.init(audioARef.current, audioBRef.current, discoAudioRef.current);
      djEngine.setMode(mode);

      djEngine.onStateUpdate = () => {
        setIsPlaying(djEngine.isPlaying);
        setIsTransitioning(djEngine.isTransitioning);
      };

      djEngine.onTransitionTick = (data) => {
        setTransitionData(data);
        setCrossfaderPos(djEngine.crossfaderPosition);
      };

      djEngine.onMashupTick = (data) => {
        setMashupData(data);
      };

      djEngine.onBeatPulse = ({ deckId, beat }) => {
        if (deckId === 'A') setBeatA(beat);
        else setBeatB(beat);
      };

      djEngine.onDiscoBeatToggle = (active) => {
        setIsDiscoBeatActive(active);
      };

      djEngine.onPresetsUpdated = (updated) => {
        setPresets({ ...updated });
      };

      // Guaranteed synchronization whenever any track is loaded into either deck
      djEngine.onTrackLoaded = (deckId, track) => {
        if (deckId === 'A') {
          setDeckAState((prev) => ({
            ...prev,
            track,
            duration: track.duration || prev.duration || 0,
            bpm: track.bpm || 128,
            cueTime: djEngine.deckA.cueTime || track.firstBeat || 0.0
          }));
        } else {
          setDeckBState((prev) => ({
            ...prev,
            track,
            duration: track.duration || prev.duration || 0,
            bpm: track.bpm || 128,
            cueTime: djEngine.deckB.cueTime || track.firstBeat || 0.0
          }));
        }
      };

      djEngine.onTrackChange = (newMasterDeckId) => {
        setActiveDeckId(newMasterDeckId);
        setCrossfaderPos(newMasterDeckId === 'A' ? 0.0 : 1.0);
        setIsTransitioning(false);

        const idleDeckId = newMasterDeckId === 'A' ? 'B' : 'A';
        const list = playlistRef.current;

        setQueueIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % list.length;
          const upcomingTrack = list[(nextIndex + 1) % list.length];
          djEngine.loadTrack(idleDeckId, upcomingTrack);

          // Update React states for active master and upcoming queued deck
          if (newMasterDeckId === 'A') {
            setDeckAState((prev) => ({ ...prev, track: djEngine.deckA.track || prev.track }));
            setDeckBState((prev) => ({
              ...prev,
              track: upcomingTrack,
              duration: upcomingTrack.duration || 0,
              bpm: upcomingTrack.bpm || 128,
              cueTime: upcomingTrack.firstBeat || 0.0
            }));
          } else {
            setDeckBState((prev) => ({ ...prev, track: djEngine.deckB.track || prev.track }));
            setDeckAState((prev) => ({
              ...prev,
              track: upcomingTrack,
              duration: upcomingTrack.duration || 0,
              bpm: upcomingTrack.bpm || 128,
              cueTime: upcomingTrack.firstBeat || 0.0
            }));
          }

          return nextIndex;
        });
      };
    }

    return () => {
      djEngine.pauseAll();
    };
  }, []);

  // 2. Initial Track Loading (Deck A = Track 0, Deck B = Track 1)
  useEffect(() => {
    if (currentPlaylist.length >= 2 && !deckAState.track && audioARef.current && audioBRef.current) {
      const track1 = currentPlaylist[0];
      const track2 = currentPlaylist[1];

      djEngine.loadTrack('A', track1);
      djEngine.loadTrack('B', track2);

      setDeckAState((prev) => ({
        ...prev,
        track: track1,
        duration: track1.duration,
        bpm: track1.bpm,
        cueTime: track1.firstBeat || 0.0
      }));

      setDeckBState((prev) => ({
        ...prev,
        track: track2,
        duration: track2.duration,
        bpm: track2.bpm,
        cueTime: track2.firstBeat || 0.0
      }));
    }
  }, [currentPlaylist, deckAState.track]);

  // 3. Sync Mode Changes to Engine
  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    djEngine.setMode(newMode);
  }, []);

  // 4. Scrubber / Time monitoring loop for UI
  useEffect(() => {
    let animId;
    const updateTimes = () => {
      if (audioARef.current) {
        setDeckAState((prev) => ({
          ...prev,
          currentTime: audioARef.current.currentTime,
          duration: audioARef.current.duration || prev.duration || 0,
          rate: audioARef.current.playbackRate || 1.0,
          isPlaying: !audioARef.current.paused && audioARef.current.currentTime > 0,
          cueTime: djEngine.deckA.cueTime
        }));
      }

      if (audioBRef.current) {
        setDeckBState((prev) => ({
          ...prev,
          currentTime: audioBRef.current.currentTime,
          duration: audioBRef.current.duration || prev.duration || 0,
          rate: audioBRef.current.playbackRate || 1.0,
          isPlaying: !audioBRef.current.paused && audioBRef.current.currentTime > 0,
          cueTime: djEngine.deckB.cueTime
        }));
      }

      animId = requestAnimationFrame(updateTimes);
    };

    animId = requestAnimationFrame(updateTimes);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Handlers
  const handleTogglePlay = useCallback(() => {
    djEngine.togglePlay();
    setIsPlaying(djEngine.isPlaying);
  }, []);

  const handleDeckPlayPause = useCallback((deckId) => {
    djEngine.resumeAudioContext();
    const deck = deckId === 'A' ? djEngine.deckA : djEngine.deckB;
    if (deck.audio) {
      if (deck.audio.paused) {
        deck.audio.play().catch(console.error);
        djEngine.activeDeckId = deckId;
        djEngine.isPlaying = true;
      } else {
        deck.audio.pause();
        if (djEngine.deckA.audio.paused && djEngine.deckB.audio.paused) {
          djEngine.isPlaying = false;
        }
      }
      djEngine.onStateUpdate();
    }
  }, []);

  const handleCueDown = useCallback((deckId) => {
    djEngine.pressCue(deckId);
  }, []);

  const handleCueUp = useCallback((deckId) => {
    djEngine.releaseCue(deckId);
  }, []);

  const handleJogScratchStart = useCallback((deckId) => {
    djEngine.startJogScratch(deckId);
  }, []);

  const handleJogScratchMove = useCallback((deckId, deltaAngle) => {
    djEngine.jogScratchMove(deckId, deltaAngle);
  }, []);

  const handleJogScratchEnd = useCallback((deckId) => {
    djEngine.endJogScratch(deckId);
  }, []);

  const handleToggleAutoDJ = useCallback(() => {
    setAutoDJEnabled((prev) => {
      const next = !prev;
      djEngine.autoDJEnabled = next;
      return next;
    });
  }, []);

  const handleCrossfaderChange = useCallback((newPos) => {
    setCrossfaderPos(newPos);
    djEngine.applyCrossfader(newPos);
  }, []);

  const handleSeek = useCallback((deckId, targetSeconds) => {
    const audio = deckId === 'A' ? audioARef.current : audioBRef.current;
    if (audio) {
      audio.currentTime = targetSeconds;
    }
  }, []);

  const handleVolumeChange = useCallback((deckId, vol) => {
    djEngine.setDeckVolume(deckId, vol);
    if (deckId === 'A') {
      setDeckAState((prev) => ({ ...prev, volume: vol }));
    } else {
      setDeckBState((prev) => ({ ...prev, volume: vol }));
    }
  }, []);

  const handleEQChange = useCallback((deckId, band, gainDb) => {
    djEngine.setDeckEQ(deckId, band, gainDb);
    const updater = (prev) => ({
      ...prev,
      eq: { ...prev.eq, [band]: gainDb }
    });
    if (deckId === 'A') setDeckAState(updater);
    else setDeckBState(updater);
  }, []);

  const handleSkipTrack = useCallback(() => {
    djEngine.skipTrack();
  }, []);

  const handleJumpToTransition = useCallback(() => {
    djEngine.jumpToTransition();
  }, []);

  const handleDropNextMashup = useCallback(() => {
    djEngine.dropNextMashup();
  }, []);

  const handleSetMashupSegmentLength = useCallback((secs) => {
    djEngine.setMashupSegmentDuration(secs);
    setMashupData((prev) => ({ ...prev, totalSec: secs, remainingSec: secs }));
  }, []);

  const handleToggleOrder = useCallback((useBpmOrder) => {
    setIsBpmOrder(useBpmOrder);
  }, []);

  const handleSelectTrack = useCallback((track) => {
    const targetDeckId = activeDeckId === 'A' ? 'B' : 'A';
    djEngine.loadTrack(targetDeckId, track);

    if (targetDeckId === 'A') {
      setDeckAState((prev) => ({
        ...prev,
        track,
        duration: track.duration,
        bpm: track.bpm,
        cueTime: track.firstBeat || 0.0
      }));
    } else {
      setDeckBState((prev) => ({
        ...prev,
        track,
        duration: track.duration,
        bpm: track.bpm,
        cueTime: track.firstBeat || 0.0
      }));
    }
  }, [activeDeckId]);

  const handleToggleDiscoBeat = useCallback(() => {
    djEngine.toggleDiscoBeat();
    setIsDiscoBeatActive(djEngine.isDiscoBeatActive);
  }, []);

  const handleOpenPresetEditor = useCallback((deckId, track) => {
    let currentTime = 0;
    if (deckId === 'A' && audioARef.current) {
      currentTime = audioARef.current.currentTime;
    } else if (deckId === 'B' && audioBRef.current) {
      currentTime = audioBRef.current.currentTime;
    }
    setPresetModalState({
      isOpen: true,
      track,
      deckId,
      currentDeckTime: currentTime
    });
  }, []);

  const handleClosePresetEditor = useCallback(() => {
    setPresetModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handlePresetSaved = useCallback((trackId, preset) => {
    // If active track on Deck A or B updated its start time or speed, update deck UI
    if (deckAState.track?.id === trackId && preset) {
      setDeckAState((prev) => ({
        ...prev,
        cueTime: preset.trimStart ?? prev.cueTime,
        rate: preset.speed ?? prev.rate
      }));
    }
    if (deckBState.track?.id === trackId && preset) {
      setDeckBState((prev) => ({
        ...prev,
        cueTime: preset.trimStart ?? prev.cueTime,
        rate: preset.speed ?? prev.rate
      }));
    }
  }, [deckAState.track, deckBState.track]);

  const activeTrack = activeDeckId === 'A' ? deckAState.track : deckBState.track;
  const nextTrack = activeDeckId === 'A' ? deckBState.track : deckAState.track;

  return (
    <div className="dj-app-wrapper">
      {/* Hidden Web Audio Media Elements */}
      <audio ref={audioARef} id="deckA-audio" playsInline />
      <audio ref={audioBRef} id="deckB-audio" playsInline />
      <audio ref={discoAudioRef} id="disco-beat-audio" src="/audio/disco_groove_beat.mp3" loop preload="auto" playsInline />

      <Header
        mode={mode}
        setMode={handleModeChange}
        playlistTitle={playlistData.playlistTitle}
        targetUrl={playlistData.targetUrl}
        trackCount={currentPlaylist.length}
      />

      <main className="dj-console-main">
        {/* Left: Deck A */}
        <Deck
          deckId="A"
          deckState={deckAState}
          isActiveMaster={activeDeckId === 'A'}
          isTransitioning={isTransitioning}
          mode={mode}
          currentBeat={beatA}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onEQChange={handleEQChange}
          onPlayPause={handleDeckPlayPause}
          onCueDown={handleCueDown}
          onCueUp={handleCueUp}
          onJogScratchStart={handleJogScratchStart}
          onJogScratchMove={handleJogScratchMove}
          onJogScratchEnd={handleJogScratchEnd}
          onOpenPresetEditor={handleOpenPresetEditor}
        />

        {/* Center: Mixer */}
        <Mixer
          isPlaying={isPlaying}
          autoDJEnabled={autoDJEnabled}
          crossfaderPos={crossfaderPos}
          isTransitioning={isTransitioning}
          transitionData={transitionData}
          activeDeckId={activeDeckId}
          activeTrack={activeTrack}
          nextTrack={nextTrack}
          mode={mode}
          mashupData={mashupData}
          isDiscoBeatActive={isDiscoBeatActive}
          onToggleDiscoBeat={handleToggleDiscoBeat}
          onTogglePlay={handleTogglePlay}
          onToggleAutoDJ={handleToggleAutoDJ}
          onCrossfaderChange={handleCrossfaderChange}
          onSkipTrack={handleSkipTrack}
          onJumpToTransition={handleJumpToTransition}
          onDropNextMashup={handleDropNextMashup}
          onSetMashupSegmentLength={handleSetMashupSegmentLength}
          getVisualizerData={() => djEngine.getVisualizerData()}
        />

        {/* Right: Deck B */}
        <Deck
          deckId="B"
          deckState={deckBState}
          isActiveMaster={activeDeckId === 'B'}
          isTransitioning={isTransitioning}
          mode={mode}
          currentBeat={beatB}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onEQChange={handleEQChange}
          onPlayPause={handleDeckPlayPause}
          onCueDown={handleCueDown}
          onCueUp={handleCueUp}
          onJogScratchStart={handleJogScratchStart}
          onJogScratchMove={handleJogScratchMove}
          onJogScratchEnd={handleJogScratchEnd}
          onOpenPresetEditor={handleOpenPresetEditor}
        />
      </main>

      {/* Playlist Drawer with All Target Tracks */}
      <PlaylistDrawer
        tracks={currentPlaylist}
        activeTrackId={activeTrack?.id}
        nextTrackId={nextTrack?.id}
        activeDeckId={activeDeckId}
        isBpmOrder={isBpmOrder}
        presets={presets}
        onToggleOrder={handleToggleOrder}
        onSelectTrack={handleSelectTrack}
        onOpenPresetEditor={handleOpenPresetEditor}
      />

      {/* Track Mix Preset Editor Modal */}
      <PresetEditorModal
        isOpen={presetModalState.isOpen}
        onClose={handleClosePresetEditor}
        track={presetModalState.track}
        deckId={presetModalState.deckId}
        currentDeckTime={presetModalState.currentDeckTime}
        onPresetSaved={handlePresetSaved}
      />
    </div>
  );
}
