import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ListMusic, Play, RotateCcw, SkipBack, SkipForward, Trash2, X, Cloud, Save, LogIn } from 'lucide-react';
import { YouTubePlayer } from './YouTubePlayer';
import { isCatalogueWordVideo } from '../data/videoApproval';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import {
  WORSHIP_QUEUE_LIMIT,
  moveWorshipQueueItem,
  saveWorshipQueue,
  type WorshipQueueItem,
} from '../data/worshipQueue';

interface WorshipQueueProps {
  queue: WorshipQueueItem[];
  onChange: (queue: WorshipQueueItem[]) => void;
  approvedVideoIds: ReadonlySet<string>;
  onOpenSavedPlaylists?: () => void;
}

export function WorshipQueue({ queue, onChange, approvedVideoIds, onOpenSavedPlaylists }: WorshipQueueProps) {
  const { user } = useAuth();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const playingItem = playingIndex == null ? null : queue[playingIndex] ?? null;

  useEffect(() => {
    saveWorshipQueue(queue);
    if (playingIndex != null && playingIndex >= queue.length) {
      setPlayingIndex(queue.length ? queue.length - 1 : null);
    }
  }, [playingIndex, queue]);

  const update = (next: WorshipQueueItem[]) => onChange(next.slice(0, WORSHIP_QUEUE_LIMIT));

  const removeAt = (index: number) => {
    update(queue.filter((_, itemIndex) => itemIndex !== index));
    if (playingIndex === index) setPlayingIndex(null);
    else if (playingIndex != null && playingIndex > index) setPlayingIndex(playingIndex - 1);
  };

  const clearQueue = () => {
    if (window.confirm('Clear all songs from current service playlist?')) {
      update([]);
      setPlayingIndex(null);
    }
  };

  return (
    <section className="worship-queue" aria-labelledby="worship-queue-title">
      <div className="worship-queue__heading">
        <div>
          <span className="worship-queue__eyebrow"><ListMusic size={16} /> Worship Word Video Playlist</span>
          <h2 id="worship-queue-title">Service Video Queue ({queue.length}/{WORSHIP_QUEUE_LIMIT})</h2>
        </div>

        <div className="worship-queue__heading-actions">
          {user ? (
            <button
              type="button"
              className="worship-queue__btn-cloud"
              onClick={onOpenSavedPlaylists}
            >
              <Cloud size={15} /> Saved Playlists
            </button>
          ) : (
            <button
              type="button"
              className="worship-queue__btn-login"
              onClick={() => setShowAuthModal(true)}
            >
              <LogIn size={14} /> Log In to Save Playlists
            </button>
          )}

          {queue.length > 0 && (
            <>
              <button
                type="button"
                className="worship-queue__btn-secondary"
                onClick={() => setPlayingIndex(0)}
              >
                <Play size={14} /> Start Singalong
              </button>
              <button
                type="button"
                className="worship-queue__btn-icon-danger"
                onClick={clearQueue}
                title="Clear Playlist"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {playingItem && (
        <div className="worship-queue__player-card">
          <div className="worship-queue__player-header">
            <div>
              <span className="worship-queue__now-playing">NOW PLAYING #{playingIndex! + 1}</span>
              <h3>{playingItem.title}</h3>
              <p>{playingItem.artist}</p>
            </div>
            <button
              type="button"
              className="worship-queue__icon-btn"
              onClick={() => setPlayingIndex(null)}
              title="Close Player"
            >
              <X size={18} />
            </button>
          </div>

          <div className="worship-queue__video-container">
            <YouTubePlayer
              videoId={playingItem.youtubeId}
              title={`${playingItem.title} - ${playingItem.artist}`}
              autoplay
            />
          </div>

          <div className="worship-queue__player-controls">
            <button
              type="button"
              disabled={playingIndex! <= 0}
              onClick={() => setPlayingIndex((prev) => (prev != null && prev > 0 ? prev - 1 : prev))}
            >
              <SkipBack size={16} /> Previous
            </button>
            <button
              type="button"
              onClick={() => setPlayingIndex(0)}
            >
              <RotateCcw size={16} /> Restart
            </button>
            <button
              type="button"
              disabled={playingIndex! >= queue.length - 1}
              onClick={() => setPlayingIndex((prev) => (prev != null && prev < queue.length - 1 ? prev + 1 : prev))}
            >
              Next <SkipForward size={16} />
            </button>
          </div>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="worship-queue__empty">
          <ListMusic size={32} />
          <p>No videos in service playlist yet.</p>
          <span>Search or browse songs below and click <strong>"+ Add to Playlist"</strong> to build your service playlist (up to {WORSHIP_QUEUE_LIMIT} songs).</span>
        </div>
      ) : (
        <ol className="worship-queue__list">
          {queue.map((item, index) => {
            const isWordVideo = isCatalogueWordVideo(item.youtubeId) || approvedVideoIds.has(item.youtubeId);
            const isPlaying = playingIndex === index;
            return (
              <li key={item.id} className={`worship-queue__item ${isPlaying ? 'is-playing' : ''}`}>
                <div className="worship-queue__item-index">{index + 1}</div>
                <div className="worship-queue__item-body">
                  <div className="worship-queue__item-title">
                    <strong>{item.title}</strong>
                    {isWordVideo && (
                      <span className="badge-verified-words" title="Verified Word / Lyric Video">✓ Verified Words</span>
                    )}
                  </div>
                  <div className="worship-queue__item-sub">{item.artist}</div>
                </div>

                <div className="worship-queue__item-actions">
                  <button
                    type="button"
                    className="worship-queue__btn-play"
                    onClick={() => setPlayingIndex(index)}
                  >
                    <Play size={13} /> {isPlaying ? 'Playing' : 'Play'}
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => update(moveWorshipQueueItem(queue, index, -1))}
                    title="Move Up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === queue.length - 1}
                    onClick={() => update(moveWorshipQueueItem(queue, index, 1))}
                    title="Move Down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="worship-queue__btn-remove"
                    onClick={() => removeAt(index)}
                    title="Remove from Queue"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {showAuthModal && (
        <AuthModal
          initialTab="signin"
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </section>
  );
}
