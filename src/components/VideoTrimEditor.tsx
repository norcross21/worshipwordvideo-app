import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Pause, Play, RotateCcw, RotateCw, Scissors } from 'lucide-react';
import { formatPlaybackTime, parsePlaybackTime, playbackTimingError } from '../data/worshipQueue';
import {
  loadYouTubeIframeApi,
  safeYouTubePlayerValue,
  type YouTubePlayerInstance,
} from '../lib/youtubeIframeApi';
import { YouTubePlayer } from './YouTubePlayer';

interface VideoTrimEditorProps {
  videoId: string;
  title: string;
  startValue: string;
  endValue: string;
  initialStartSeconds?: number;
  durationSeconds?: number;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function VideoTrimEditor({
  videoId,
  title,
  startValue,
  endValue,
  initialStartSeconds,
  durationSeconds,
  onStartChange,
  onEndChange,
}: VideoTrimEditorProps) {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const previewEndRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(initialStartSeconds ?? 0);
  const [videoDuration, setVideoDuration] = useState(durationSeconds ?? 0);
  const [playerError, setPlayerError] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');

  useEffect(() => {
    let disposed = false;
    let player: YouTubePlayerInstance | null = null;
    let positionTimer = 0;
    let durationNoticeTimer = 0;
    let loadingTimeout = 0;

    setReady(false);
    setPlayerError('');
    setCurrentSeconds(initialStartSeconds ?? 0);
    loadingTimeout = window.setTimeout(() => {
      if (!disposed && !playerRef.current) setPlayerError('The interactive timeline is taking too long to load. You can still preview the video and type exact times.');
    }, 9000);

    void loadYouTubeIframeApi()
      .then((api) => {
        if (disposed || !playerHostRef.current) return;
        const mount = document.createElement('div');
        playerHostRef.current.replaceChildren(mount);
        player = new api.Player(mount, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            controls: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
            start: Math.max(0, Math.floor(initialStartSeconds ?? 0)),
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              const detectedDuration = safeYouTubePlayerValue(() => event.target.getDuration(), durationSeconds ?? 0);
              setVideoDuration(detectedDuration);
              setCurrentSeconds(safeYouTubePlayerValue(() => event.target.getCurrentTime(), initialStartSeconds ?? 0));
              setReady(true);
              window.clearTimeout(loadingTimeout);
              durationNoticeTimer = window.setTimeout(() => {
                if (safeYouTubePlayerValue(() => event.target.getDuration(), 0) <= 0) {
                  setPreviewMessage('This upload is not exposing its timeline here. Try another video or enter exact times in the boxes.');
                }
              }, 2200);
              positionTimer = window.setInterval(() => {
                const activePlayer = playerRef.current;
                if (!activePlayer) return;
                const nextPosition = safeYouTubePlayerValue(() => activePlayer.getCurrentTime());
                setCurrentSeconds(nextPosition);
                const nextDuration = safeYouTubePlayerValue(() => activePlayer.getDuration(), 0);
                if (nextDuration > 0) setVideoDuration((current) => Math.abs(current - nextDuration) > 0.5 ? nextDuration : current);
                const previewEnd = previewEndRef.current;
                if (previewEnd != null && nextPosition >= previewEnd) {
                  activePlayer.pauseVideo();
                  previewEndRef.current = null;
                  setPreviewMessage('Preview reached your finish marker.');
                }
              }, 350);
            },
            onError: () => setPlayerError('YouTube could not load this video in the trim editor.'),
          },
        });
      })
      .catch((error: unknown) => {
        if (!disposed) setPlayerError(error instanceof Error ? error.message : 'The interactive video controls could not be loaded.');
      });

    return () => {
      disposed = true;
      window.clearInterval(positionTimer);
      window.clearTimeout(durationNoticeTimer);
      window.clearTimeout(loadingTimeout);
      previewEndRef.current = null;
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // The iframe may already have been removed while closing the editor.
      }
    };
  }, [durationSeconds, initialStartSeconds, videoId]);

  const parsedMarkers = useMemo(() => ({
    start: parsePlaybackTime(startValue),
    end: parsePlaybackTime(endValue),
  }), [endValue, startValue]);

  const duration = Math.max(0, videoDuration || durationSeconds || 0);
  const markerStyle = (seconds?: number) => ({
    left: `${duration > 0 && seconds != null ? Math.min(100, Math.max(0, (seconds / duration) * 100)) : 0}%`,
  });

  const seekTo = (seconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    previewEndRef.current = null;
    player.seekTo(Math.max(0, seconds), true);
    setCurrentSeconds(Math.max(0, seconds));
    setPreviewMessage('');
  };

  const captureMarker = (kind: 'start' | 'end') => {
    const player = playerRef.current;
    if (!player) return;
    const seconds = Math.floor(safeYouTubePlayerValue(() => player.getCurrentTime()));
    if (kind === 'start') onStartChange(formatPlaybackTime(seconds));
    else onEndChange(formatPlaybackTime(seconds));
    setPreviewMessage(`${kind === 'start' ? 'Start' : 'Finish'} marker set at ${formatPlaybackTime(seconds)}.`);
  };

  const nudge = (seconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    const current = safeYouTubePlayerValue(() => player.getCurrentTime());
    seekTo(Math.min(duration || Number.POSITIVE_INFINITY, Math.max(0, current + seconds)));
  };

  const previewSelection = () => {
    const player = playerRef.current;
    if (!player) return;
    const start = parsedMarkers.start ?? 0;
    const end = parsedMarkers.end;
    const error = playbackTimingError(parsedMarkers.start, end, duration || undefined);
    if (error) {
      setPreviewMessage(error);
      return;
    }
    previewEndRef.current = end ?? null;
    player.seekTo(start, true);
    player.playVideo();
    setPreviewMessage(end == null ? `Previewing from ${formatPlaybackTime(start)}.` : `Previewing ${formatPlaybackTime(start)}–${formatPlaybackTime(end)}.`);
  };

  return (
    <div className="video-trim-editor">
      <div className="video-trim-editor__screen">
        {playerError ? (
          <YouTubePlayer videoId={videoId} title={`${title} trim preview`} startSeconds={parsedMarkers.start} controls />
        ) : (
          <div className="video-trim-editor__player-mount" ref={playerHostRef} />
        )}
        {!ready && !playerError ? <span className="video-trim-editor__loading">Loading video editor…</span> : null}
      </div>

      <div className="video-trim-editor__timeline">
        <div className="video-trim-editor__time-row">
          <strong>{formatPlaybackTime(currentSeconds) || '0:00'}</strong>
          <span>{duration ? formatPlaybackTime(duration) : 'Video length loading…'}</span>
        </div>
        <div className="video-trim-editor__range-wrap">
          {parsedMarkers.start != null && duration ? <span className="video-trim-editor__marker is-start" style={markerStyle(parsedMarkers.start)} aria-hidden="true" /> : null}
          {parsedMarkers.end != null && duration ? <span className="video-trim-editor__marker is-end" style={markerStyle(parsedMarkers.end)} aria-hidden="true" /> : null}
          <input
            type="range"
            min="0"
            max={Math.max(1, Math.floor(duration))}
            step="1"
            value={Math.min(Math.floor(currentSeconds), Math.max(1, Math.floor(duration)))}
            onChange={(event) => seekTo(Number(event.target.value))}
            disabled={!ready || !duration}
            aria-label="Move through video"
          />
        </div>
      </div>

      <div className="video-trim-editor__capture-actions">
        <button type="button" onClick={() => nudge(-5)} disabled={!ready} title="Move back five seconds"><RotateCcw size={14} /> −5 sec</button>
        <button type="button" onClick={() => nudge(5)} disabled={!ready} title="Move forward five seconds">+5 sec <RotateCw size={14} /></button>
        <button type="button" onClick={() => captureMarker('start')} disabled={!ready}><Crosshair size={15} /> Set start here</button>
        <button type="button" onClick={() => captureMarker('end')} disabled={!ready}><Crosshair size={15} /> Set finish here</button>
        <button type="button" className="is-preview" onClick={previewSelection} disabled={!ready}><Play size={14} fill="currentColor" /> Preview selection</button>
        <button type="button" onClick={() => playerRef.current?.pauseVideo()} disabled={!ready} aria-label="Pause trim preview"><Pause size={15} /></button>
      </div>

      <p className="video-trim-editor__message" aria-live="polite"><Scissors size={13} /> {previewMessage || 'Play or drag through the video, pause on the right moment, then set a marker.'}</p>
    </div>
  );
}
