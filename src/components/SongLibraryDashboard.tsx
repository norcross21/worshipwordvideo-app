import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  BadgeCheck,
  Plus,
  ListPlus,
  Pencil,
  Trash2,
  ExternalLink,
  BookOpen,
  Filter,
  CheckCircle2,
  Sparkles,
  Music
} from 'lucide-react';
import {
  getFullSongLibrary,
  updateSong,
  deleteSong,
  songMatchesSearch,
  songHymnalReferences,
  songMusicStyle,
  type MusicStyle,
  HYMNAL_COLLECTION_OPTIONS,
  MUSIC_STYLES,
} from '../data/songLibraryStore';
import type { WorshipSong } from '../data/worshipSongs';
import { CCLI_UK_TOP_100 } from '../data/ccliUkTop100';
import { assessWorshipVideo } from '../data/videoQuality';
import {
  getApprovedWorshipVideos,
  saveApprovedWorshipVideos,
  setWorshipVideoApproved,
  isCatalogueWordVideo,
} from '../data/videoApproval';
import { YouTubePlayer } from './YouTubePlayer';
import { AddSongModal } from './AddSongModal';
import { EditSongModal } from './EditSongModal';

interface SongLibraryDashboardProps {
  initialFilter?: 'all' | 'ccli' | 'hymnals' | 'verified';
  onAddToPlaylist: (song: WorshipSong) => void;
}

export function SongLibraryDashboard({ initialFilter = 'all', onAddToPlaylist }: SongLibraryDashboardProps) {
  const [songs, setSongs] = useState<WorshipSong[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Well-known' | MusicStyle>('All');
  const [selectedHymnal, setSelectedHymnal] = useState('all');
  const [onlyVerifiedWords, setOnlyVerifiedWords] = useState(initialFilter === 'verified');
  const [onlyCcliTop100, setOnlyCcliTop100] = useState(initialFilter === 'ccli');
  
  const [selectedSong, setSelectedSong] = useState<WorshipSong | null>(null);
  const [approvedVideoIds, setApprovedVideoIds] = useState<Set<string>>(new Set());
  const [quickLinkInput, setQuickLinkInput] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Sync initial tab changes
  useEffect(() => {
    if (initialFilter === 'ccli') {
      setOnlyCcliTop100(true);
      setOnlyVerifiedWords(false);
    } else if (initialFilter === 'verified') {
      setOnlyVerifiedWords(true);
      setOnlyCcliTop100(false);
    } else {
      setOnlyCcliTop100(false);
      setOnlyVerifiedWords(false);
    }
  }, [initialFilter]);

  const refreshData = () => {
    const loaded = getFullSongLibrary();
    setSongs(loaded);
    setApprovedVideoIds(getApprovedWorshipVideos());
    if (loaded.length > 0 && !selectedSong) {
      setSelectedSong(loaded[0]);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleToggleApprovedVideo = (youtubeId: string) => {
    const next = setWorshipVideoApproved(approvedVideoIds, youtubeId, !approvedVideoIds.has(youtubeId));
    saveApprovedWorshipVideos(next);
    setApprovedVideoIds(next);
  };

  const handleQuickOverrideLink = () => {
    if (!selectedSong || !quickLinkInput.trim()) return;
    const val = quickLinkInput.trim();
    const match = val.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^\s&?#]+)/);
    const finalId = match ? match[1] : val;

    if (finalId.length === 11) {
      updateSong(selectedSong.id, { youtubeId: finalId });
      const updated = { ...selectedSong, youtubeId: finalId };
      setSelectedSong(updated);
      refreshData();
      setQuickLinkInput('');
      setStatusMessage('✓ YouTube video link updated successfully!');
      setTimeout(() => setStatusMessage(''), 3500);
    } else {
      alert('Please enter a valid 11-character YouTube video ID or full YouTube URL.');
    }
  };

  const handleDeleteCurrentSong = () => {
    if (!selectedSong) return;
    if (window.confirm(`Are you sure you want to delete "${selectedSong.title}"?`)) {
      deleteSong(selectedSong.id);
      setSelectedSong(null);
      refreshData();
    }
  };

  // Filtered song list
  const filteredSongs = useMemo(() => {
    const ccliTitles = new Set(CCLI_UK_TOP_100.map((item) => item.catalogueTitle.toUpperCase()));

    return songs.filter((song) => {
      // 1. Search Query
      if (searchQuery.trim() && !songMatchesSearch(song, searchQuery)) {
        return false;
      }
      // 2. Music Style / Category
      if (selectedCategory !== 'All') {
        const style = songMusicStyle(song);
        if (selectedCategory === 'Well-known' && !isCatalogueWordVideo(song.youtubeId)) {
          return false;
        } else if (selectedCategory !== 'Well-known' && style !== selectedCategory) {
          return false;
        }
      }
      // 3. Hymnal Collection Filter
      if (selectedHymnal !== 'all') {
        const refs = songHymnalReferences(song);
        if (!refs.some((r) => r.hymnal === selectedHymnal)) {
          return false;
        }
      }
      // 4. CCLI Top 100 Filter
      if (onlyCcliTop100) {
        if (!ccliTitles.has(song.title.toUpperCase())) return false;
      }
      // 5. Only Verified Word Videos
      if (onlyVerifiedWords) {
        const isApproved = approvedVideoIds.has(song.youtubeId);
        const isWordVideo = isCatalogueWordVideo(song.youtubeId) || isApproved;
        if (!isWordVideo) return false;
      }

      return true;
    });
  }, [songs, searchQuery, selectedCategory, selectedHymnal, onlyCcliTop100, onlyVerifiedWords, approvedVideoIds]);

  return (
    <div className="music-dashboard">
      {/* Top Filter & Toolbar */}
      <div className="music-dashboard__toolbar">
        <div className="search-box">
          <Search size={18} className="search-box__icon" />
          <input
            type="text"
            className="search-box__input"
            placeholder="Search by title, artist, lyrics, or hymnal number (e.g. A&M 412, MP 120)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="search-box__clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn-add-song"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Add Custom Hymn / Video
          </button>
        </div>
      </div>

      {/* Filter Chips & Collections */}
      <div className="filter-bar">
        <div className="filter-chips">
          <span className="filter-bar__label"><Filter size={13} /> Style:</span>
          <button
            type="button"
            className={`chip ${selectedCategory === 'All' ? 'is-active' : ''}`}
            onClick={() => setSelectedCategory('All')}
          >
            All
          </button>
          {MUSIC_STYLES.slice(0, 6).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip ${selectedCategory === cat ? 'is-active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="filter-selects">
          <label className="select-wrapper">
            <BookOpen size={13} />
            <select
              value={selectedHymnal}
              onChange={(e) => setSelectedHymnal(e.target.value)}
            >
              <option value="all">All Hymnal Collections</option>
              {HYMNAL_COLLECTION_OPTIONS.map((h) => (
                <option key={h.code} value={h.code}>{h.shortName} ({h.name})</option>
              ))}
            </select>
          </label>

          <label className="checkbox-pill">
            <input
              type="checkbox"
              checked={onlyVerifiedWords}
              onChange={(e) => setOnlyVerifiedWords(e.target.checked)}
            />
            <BadgeCheck size={14} className="icon-gold" /> Only Verified Word Videos
          </label>

          <label className="checkbox-pill">
            <input
              type="checkbox"
              checked={onlyCcliTop100}
              onChange={(e) => setOnlyCcliTop100(e.target.checked)}
            />
            <Sparkles size={14} className="icon-purple" /> CCLI UK Top 100
          </label>
        </div>
      </div>

      {statusMessage && (
        <div className="status-banner" role="status">
          {statusMessage}
        </div>
      )}

      {/* Main Grid: Left List (35%) & Right Detail (65%) */}
      <div className="music-dashboard__grid">
        {/* Left Side: Song Catalog List */}
        <div className="song-list-panel">
          <div className="song-list-panel__header">
            <h3>Song Catalog</h3>
            <span className="song-count-badge">{filteredSongs.length} songs found</span>
          </div>

          <div className="song-list-panel__scroll">
            {filteredSongs.length === 0 ? (
              <div className="empty-search-state">
                <Music size={32} />
                <p>No songs match your criteria.</p>
                <button type="button" className="btn-secondary" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedHymnal('all'); setOnlyVerifiedWords(false); setOnlyCcliTop100(false); }}>
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredSongs.map((song) => {
                const isSelected = selectedSong?.id === song.id;
                const hymnalRefs = songHymnalReferences(song);
                const isWordVideo = isCatalogueWordVideo(song.youtubeId) || approvedVideoIds.has(song.youtubeId);

                return (
                  <div
                    key={song.id}
                    className={`song-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSong(song)}
                  >
                    <div className="song-card__main">
                      <h4 className="song-card__title">{song.title}</h4>
                      <p className="song-card__artist">{song.artist}</p>
                    </div>

                    <div className="song-card__meta">
                      <span className="song-card__category">{song.category}</span>
                      {isWordVideo && (
                        <span className="badge-verified-words" title="Verified Word Video">
                          <CheckCircle2 size={12} /> Words
                        </span>
                      )}
                      {hymnalRefs.length > 0 && (
                        <span className="badge-hymnal">
                          {hymnalRefs[0].shortName || hymnalRefs[0].hymnal} #{hymnalRefs[0].number}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detail & Embedded Player */}
        <div className="song-detail-panel">
          {selectedSong ? (
            <>
              <div className="song-detail-panel__header">
                <div>
                  <h2 className="song-detail__title">{selectedSong.title}</h2>
                  <p className="song-detail__artist">
                    <strong>By:</strong> {selectedSong.artist} | <strong>Category:</strong> {selectedSong.category}
                  </p>
                </div>

                <div className="song-detail__actions">
                  <button
                    type="button"
                    className="btn-add-playlist"
                    onClick={() => onAddToPlaylist(selectedSong)}
                  >
                    <ListPlus size={16} /> + Add to Playlist
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowEditModal(true)}
                    title="Edit Song Info / Video Link"
                  >
                    <Pencil size={15} />
                  </button>
                  {selectedSong.id.startsWith('custom-') && (
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={handleDeleteCurrentSong}
                      title="Delete Custom Song"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Hymnal References Banner */}
              {songHymnalReferences(selectedSong).length > 0 && (
                <div className="hymnal-refs-banner">
                  <strong><BookOpen size={14} /> Hymnal References:</strong>
                  {songHymnalReferences(selectedSong).map((ref, idx) => (
                    <span key={idx} className="hymnal-ref-pill">
                      {ref.hymnalName} #{ref.number}
                    </span>
                  ))}
                </div>
              )}

              {/* YouTube Video Player Embed */}
              {selectedSong.youtubeId ? (
                <div className="video-player-wrapper">
                  <YouTubePlayer
                    videoId={selectedSong.youtubeId}
                    title={`${selectedSong.title} - ${selectedSong.artist}`}
                    autoplay={false}
                  />
                </div>
              ) : (
                <div className="no-video-placeholder">
                  <Music size={40} />
                  <h4>No Video Linked Yet</h4>
                  <p>There is no default lyric video linked for this song yet. You can find and save one in seconds!</p>
                  <button
                    type="button"
                    className="btn-youtube-search"
                    onClick={() => {
                      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(selectedSong.title + ' ' + selectedSong.artist + ' lyric video')}`, '_blank');
                    }}
                  >
                    <Search size={14} /> Search YouTube for Lyric Video
                  </button>
                </div>
              )}

              {/* Quick YouTube Link Override Toolbar */}
              <div className="quick-link-box">
                <div className="quick-link-box__header">
                  <span>{selectedSong.youtubeId ? "Change or Fix Video Link:" : "Link a YouTube Video:"}</span>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(selectedSong.title + ' ' + selectedSong.artist + ' lyric video')}`, '_blank');
                    }}
                  >
                    <Search size={13} /> Find on YouTube <ExternalLink size={11} />
                  </button>
                </div>

                <div className="quick-link-box__input-row">
                  <input
                    type="text"
                    placeholder="Paste YouTube Link or Video ID (e.g. qLy8kBp2c5U)..."
                    value={quickLinkInput}
                    onChange={(e) => setQuickLinkInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary-sm"
                    onClick={handleQuickOverrideLink}
                  >
                    Save Link
                  </button>
                </div>
              </div>

              {/* Verified Words & Quality Approval Controls */}
              {selectedSong.youtubeId && (
                <div className="quality-controls-bar">
                  <button
                    type="button"
                    className={`btn-approval ${approvedVideoIds.has(selectedSong.youtubeId) ? 'is-approved' : ''}`}
                    onClick={() => handleToggleApprovedVideo(selectedSong.youtubeId)}
                  >
                    <BadgeCheck size={16} />
                    {approvedVideoIds.has(selectedSong.youtubeId) ? '✓ Verified Word Video (Approved)' : 'Mark as Verified Word Video'}
                  </button>
                </div>
              )}

              {/* Lyrics Panel */}
              {selectedSong.lyrics && (
                <div className="lyrics-panel">
                  <h4>Song Words / Lyrics</h4>
                  <pre className="lyrics-text">{selectedSong.lyrics}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="no-song-selected">
              <Music size={48} />
              <h3>Select a Song</h3>
              <p>Choose a hymn or worship song from the catalog on the left to preview its video, read lyrics, or add it to your service playlist.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => refreshData()}
        />
      )}

      {showEditModal && selectedSong && (
        <EditSongModal
          song={selectedSong}
          onClose={() => setShowEditModal(false)}
          onUpdated={(updated) => {
            setSelectedSong(updated);
            refreshData();
          }}
        />
      )}
    </div>
  );
}
