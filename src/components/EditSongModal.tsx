import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { updateSong, songMusicStyle } from '../data/songLibraryStore';
import type { WorshipSong } from '../data/worshipSongs';
import type { MusicStyle } from '../data/songLibraryStore';

interface EditSongModalProps {
  song: WorshipSong;
  onClose: () => void;
  onUpdated: (updatedSong: WorshipSong) => void;
}

export function EditSongModal({ song, onClose, onUpdated }: EditSongModalProps) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [category, setCategory] = useState<MusicStyle>(songMusicStyle(song));
  const [youtubeId, setYoutubeId] = useState(song.youtubeId);
  const [lyrics, setLyrics] = useState(song.lyrics || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const match = youtubeId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^\s&?#]+)/);
    const finalId = match ? match[1] : youtubeId.trim();

    const updates = {
      title,
      artist,
      category: category as any,
      youtubeId: finalId,
      lyrics,
    };

    updateSong(song.id, updates);
    onUpdated({ ...song, ...updates });
    onClose();
  };

  const handleOpenSearch = () => {
    const query = `${title} ${artist} lyric video`;
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Song & Video Link</h3>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Song Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Artist / Author</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Category / Style</label>
            <select value={category} onChange={(e: any) => setCategory(e.target.value)}>
              <option value="Contemporary worship">Contemporary worship</option>
              <option value="Traditional hymn">Traditional hymn</option>
              <option value="Gospel and spiritual">Gospel and spiritual</option>
              <option value="Children and family">Children and family</option>
              <option value="Sung liturgy">Sung liturgy</option>
              <option value="Gregorian chant">Gregorian chant</option>
            </select>
          </div>

          <div className="form-group">
            <div className="form-group__header">
              <label>YouTube Video Link or 11-Character ID</label>
              <button type="button" className="btn-link" onClick={handleOpenSearch}>
                <Search size={13} /> Find on YouTube
              </button>
            </div>
            <input
              type="text"
              value={youtubeId}
              onChange={(e) => setYoutubeId(e.target.value)}
              placeholder="e.g. qLy8kBp2c5U or full URL"
            />
          </div>

          <div className="form-group">
            <label>Lyrics / Words (Optional)</label>
            <textarea
              rows={4}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Update Song</button>
          </div>
        </form>
      </div>
    </div>
  );
}
