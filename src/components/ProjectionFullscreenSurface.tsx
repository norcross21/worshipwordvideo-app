import { useEffect, useRef, useState } from 'react';
import {
  PROJECTION_HEARTBEAT_INTERVAL_MS,
  publishProjectionCommand,
  readProjectionState,
  registerProjectionSurface,
  subscribeToProjectionState,
  type ProjectionState,
} from '../data/projection';
import { formatPlaybackTime } from '../data/worshipQueue';
import { YouTubePlayer } from './YouTubePlayer';

export function ProjectionFullscreenSurface() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const wasFullscreenRef = useRef(false);
  const [projection, setProjection] = useState<ProjectionState>(readProjectionState);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const item = projection.playingIndex == null ? null : projection.queue[projection.playingIndex] ?? null;

  useEffect(() => {
    registerProjectionSurface(surfaceRef.current);
    return () => registerProjectionSurface(null);
  }, []);

  useEffect(() => subscribeToProjectionState(setProjection), []);

  useEffect(() => {
    const update = () => {
      const active = document.fullscreenElement === surfaceRef.current;
      setIsFullscreen(active);
      if (!active && wasFullscreenRef.current && projection.launchId) {
        publishProjectionCommand('closed', projection.launchId);
      }
      wasFullscreenRef.current = active;
    };
    document.addEventListener('fullscreenchange', update);
    update();
    return () => document.removeEventListener('fullscreenchange', update);
  }, [projection.launchId]);

  useEffect(() => {
    if (!isFullscreen || !projection.launchId) return;
    const announceReady = () => publishProjectionCommand('ready', projection.launchId);
    const announceHeartbeat = () => publishProjectionCommand('heartbeat', projection.launchId);
    announceReady();
    const heartbeat = window.setInterval(announceHeartbeat, PROJECTION_HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(heartbeat);
  }, [isFullscreen, projection.launchId]);

  return (
    <div ref={surfaceRef} className="projection-fullscreen-surface" aria-hidden={!isFullscreen}>
      {isFullscreen && item && (
        <>
          <YouTubePlayer
            key={`${item.id}-${item.startSeconds ?? 0}-${item.endSeconds ?? 0}-${projection.playbackRevision}`}
            videoId={item.youtubeId}
            title={`${item.title} - ${item.artist}`}
            autoplay
            startSeconds={item.startSeconds}
            endSeconds={item.endSeconds}
            className="projection-fullscreen-surface__player"
            onEnded={() => publishProjectionCommand('ended', projection.launchId, item.id)}
          />
          <div className="projection-fullscreen-surface__caption">
            <strong>{item.title}</strong>
            {(item.startSeconds != null || item.endSeconds != null) && (
              <span>{formatPlaybackTime(item.startSeconds) || '0:00'} → {formatPlaybackTime(item.endSeconds) || 'video end'}</span>
            )}
          </div>
        </>
      )}
      {isFullscreen && !item && <div className="projection-fullscreen-surface__waiting">Church screen ready</div>}
    </div>
  );
}
