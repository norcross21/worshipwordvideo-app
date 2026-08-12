import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { addCustomSong, normalizeYouTubeVideoId } from '../data/songLibraryStore';
import type { MusicStyle } from '../data/songLibraryStore';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

interface AddSongModalProps {
  onClose: () => void;
  onAdded: () => void;
}

export function AddSongModal({ onClose, onAdded }: AddSongModalProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState<MusicStyle>('Contemporary worship');
  const [youtubeId, setYoutubeId] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useAccessibleDialog<HTMLDivElement>(onClose);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !youtubeId) return;

    const finalId = normalizeYouTubeVideoId(youtubeId);
    if (!finalId) {
      setError('Please enter a valid YouTube link or 11-character video ID.');
      return;
    }

    addCustomSong({
      title,
      artist: artist || 'Unknown Artist',
      category,
      youtubeId: finalId,
    });

    onAdded();
    onClose();
  };

  const handleOpenSearch = () => {
    if (!title) return;
    const query = `${title} ${artist} lyric video`;
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-song-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="add-song-title">Add New Hymn / Worship Video</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close add video"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="add-song-title-input">Song Title *</label>
            <input
              id="add-song-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. In Christ Alone"
            />
          </div>

          <div className="form-group">
            <label htmlFor="add-song-artist">Artist / Author</label>
            <input
              id="add-song-artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Keith Getty & Stuart Townend"
            />
          </div>

          <div className="form-group">
            <label htmlFor="add-song-category">Category / Style</label>
            <select id="add-song-category" value={category} onChange={(e) => setCategory(e.target.value as MusicStyle)}>
              <option value="Contemporary worship">Contemporary worship</option>
              <option value="Traditional hymn">Traditional hymn</option>
              <option value="Gospel and spiritual">Gospel and spiritual</option>
              <option value="Children and family">Children and family</option>
              <option value="Sung liturgy">Sung liturgy</option>
              <option value="Gregorian chant">Gregorian chant</option>
            </select>
          </div>

          {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}

          <div className="form-group">
            <div className="form-group__header">
              <label htmlFor="add-song-youtube">YouTube Video Link or 11-Character ID *</label>
              {title && (
                <button type="button" className="btn-link" onClick={handleOpenSearch}>
                  <Search size={13} /> Find on YouTube
                </button>
              )}
            </div>
            <input
              id="add-song-youtube"
              type="text"
              required
              value={youtubeId}
              onChange={(e) => setYoutubeId(e.target.value)}
              placeholder="e.g. qLy8kBp2c5U or https://www.youtube.com/watch?v=..."
            />
          </div>

          <p className="copyright-note">This app stores the YouTube link, not a copy of the song lyrics. Please choose an authorised upload that the channel allows to be embedded.</p>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Song Video</button>
          </div>
        </form>
      </div>
    </div>
  );
}
