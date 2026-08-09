import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Search,
  ArrowLeft,
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
  Music,
  Globe2,
  SlidersHorizontal
} from 'lucide-react';
import {
  getFullSongLibrary,
  normalizeYouTubeVideoId,
  updateSong,
  deleteSong,
  songMatchesSearch,
  songHymnalReferences,
  songMusicStyle,
  sortSongResults,
  type MusicStyle,
  HYMNAL_COLLECTION_OPTIONS,
  MUSIC_STYLES,
  LANGUAGE_FILTERS,
} from '../data/songLibraryStore';
import type { WorshipSong } from '../data/worshipSongs';
import {
  LANGUAGE_PRESENTATIONS,
  WORSHIP_ARRANGEMENTS,
  inferLanguagePresentation,
  inferWorshipArrangement,
  shortPresentationLabel,
} from '../data/songPresentation';
import {
  getApprovedWorshipVideos,
  saveApprovedWorshipVideos,
  setWorshipVideoApproved,
  isCatalogueWordVideo,
} from '../data/videoApproval';
import { YouTubePlayer } from './YouTubePlayer';
import { youtubeWatchUrl } from '../data/youtube';
import { firstPlayableSong } from '../data/songSelection';
import { AddSongModal } from './AddSongModal';
import { EditSongModal } from './EditSongModal';

interface SongLibraryDashboardProps {
  initialFilter?: 'all' | 'ccli' | 'hymnals' | 'verified';
  onAddToPlaylist: (song: WorshipSong) => void;
  playlistEnabled?: boolean;
}

const initialSongLibrary = getFullSongLibrary();
const initialFeaturedSong = initialSongLibrary.find((song) => song.ccliUkRank === 1)
  ?? initialSongLibrary.find((song) => Boolean(song.youtubeId))
  ?? null;
const MOBILE_CATALOGUE_QUERY = '(max-width: 900px)';

function initialQueryParameter(name: string): string {
  return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

const initialSearchQuery = initialQueryParameter('q');
const requestedLanguage = initialQueryParameter('language');
const initialLanguage = LANGUAGE_FILTERS.includes(requestedLanguage) ? requestedLanguage : 'all';
const requestedArrangement = initialQueryParameter('arrangement');
const initialArrangement = WORSHIP_ARRANGEMENTS.includes(requestedArrangement as (typeof WORSHIP_ARRANGEMENTS)[number]) ? requestedArrangement : 'all';
const requestedPresentation = initialQueryParameter('presentation');
const initialPresentation = LANGUAGE_PRESENTATIONS.includes(requestedPresentation as (typeof LANGUAGE_PRESENTATIONS)[number]) ? requestedPresentation : 'all';

export function SongLibraryDashboard({ initialFilter = 'all', onAddToPlaylist, playlistEnabled = false }: SongLibraryDashboardProps) {
  const [songs, setSongs] = useState<WorshipSong[]>(initialSongLibrary);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Well-known' | MusicStyle>('All');
  const [selectedHymnal, setSelectedHymnal] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [selectedArrangement, setSelectedArrangement] = useState(initialArrangement);
  const [selectedPresentation, setSelectedPresentation] = useState(initialPresentation);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [onlyVerifiedWords, setOnlyVerifiedWords] = useState(initialFilter === 'verified');
  const [onlyCcliTop100, setOnlyCcliTop100] = useState(initialFilter === 'ccli');
  
  const [selectedSong, setSelectedSong] = useState<WorshipSong | null>(initialFeaturedSong);
  const [approvedVideoIds, setApprovedVideoIds] = useState<Set<string>>(getApprovedWorshipVideos);
  const [quickLinkInput, setQuickLinkInput] = useState('');
  const [showVideoTools, setShowVideoTools] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [visibleSongCount, setVisibleSongCount] = useState(50);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearchPending = searchQuery !== deferredSearchQuery;

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
    setSelectedSong((current) => loaded.find((song) => song.id === current?.id) ?? sortSongResults(loaded)[0] ?? null);
  };

  const showSong = (song: WorshipSong) => {
    setSelectedSong(song);
    setMobileDetailOpen(true);
    if (window.matchMedia(MOBILE_CATALOGUE_QUERY).matches) {
      window.requestAnimationFrame(() => {
        document.querySelector('.music-dashboard__grid')?.scrollIntoView({ block: 'start' });
      });
    }
  };

  const showResults = () => {
    setMobileDetailOpen(false);
    if (window.matchMedia(MOBILE_CATALOGUE_QUERY).matches) {
      window.requestAnimationFrame(() => {
        document.querySelector('.music-dashboard__toolbar')?.scrollIntoView({ block: 'start' });
      });
    }
  };

  const handleToggleApprovedVideo = (youtubeId: string) => {
    const next = setWorshipVideoApproved(approvedVideoIds, youtubeId, !approvedVideoIds.has(youtubeId));
    saveApprovedWorshipVideos(next);
    setApprovedVideoIds(next);
  };

  const handleQuickOverrideLink = () => {
    if (!selectedSong || !quickLinkInput.trim()) return;
    const finalId = normalizeYouTubeVideoId(quickLinkInput);

    if (finalId) {
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
    const matches = songs.filter((song) => {
      // 1. Search Query
      if (deferredSearchQuery.trim() && !songMatchesSearch(song, deferredSearchQuery)) {
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
      if (selectedLanguage !== 'all') {
        const language = song.language ?? 'English';
        if (language !== selectedLanguage) return false;
      }
      if (selectedArrangement !== 'all' && inferWorshipArrangement(song) !== selectedArrangement) return false;
      if (selectedPresentation !== 'all' && inferLanguagePresentation(song) !== selectedPresentation) return false;
      // 3. Hymnal Collection Filter
      if (selectedHymnal !== 'all') {
        const refs = songHymnalReferences(song);
        if (!refs.some((r) => r.hymnal === selectedHymnal)) {
          return false;
        }
      }
      // 4. CCLI Top 100 Filter
      if (onlyCcliTop100) {
        if (song.ccliUkRank == null) return false;
      }
      // 5. Videos whose uploader identifies lyrics, words or subtitles
      if (onlyVerifiedWords) {
        const isApproved = approvedVideoIds.has(song.youtubeId);
        const isWordVideo = isCatalogueWordVideo(song.youtubeId) || isApproved;
        if (!isWordVideo) return false;
      }

      return true;
    });
    return sortSongResults(matches, deferredSearchQuery);
  }, [songs, deferredSearchQuery, selectedCategory, selectedHymnal, selectedLanguage, selectedArrangement, selectedPresentation, onlyCcliTop100, onlyVerifiedWords, approvedVideoIds]);

  useLayoutEffect(() => {
    setVisibleSongCount(50);
    setMobileDetailOpen(false);
    setSelectedSong(firstPlayableSong(filteredSongs));
  }, [deferredSearchQuery, selectedCategory, selectedHymnal, selectedLanguage, selectedArrangement, selectedPresentation, onlyCcliTop100, onlyVerifiedWords]);

  useEffect(() => {
    setShowVideoTools(false);
  }, [selectedSong?.id]);

  const selectedHymnalReferences = useMemo(
    () => selectedSong ? songHymnalReferences(selectedSong) : [],
    [selectedSong],
  );

  return (
    <div className="music-dashboard">
      <section className="library-intro">
        <div>
          <span className="library-intro__eyebrow">For English and multilingual churches</span>
          <h2>Find a worship video</h2>
          <p>Search by song, artist, language or hymn number. Choose a video, then add it to your service playlist.</p>
        </div>
      </section>

      {/* Top Filter & Toolbar */}
      <div className="music-dashboard__toolbar">
        <div className="search-box">
          <Search size={18} className="search-box__icon" />
          <input
            type="text"
            className="search-box__input"
            aria-label="Search songs, artists, languages, or hymn numbers"
            placeholder="Search songs, artists, languages or hymn numbers…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="search-box__clear" onClick={() => setSearchQuery('')} aria-label="Clear search">✕</button>
          )}
        </div>

        <div className="toolbar-actions">
          <label className="language-select">
            <Globe2 size={16} />
            <span className="sr-only">Language</span>
            <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value)} aria-label="Filter by language">
              <option value="all">All languages</option>
              {LANGUAGE_FILTERS.map((language) => <option key={language} value={language}>{language}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" aria-expanded={showAdvancedFilters} onClick={() => setShowAdvancedFilters((value) => !value)}>
            <SlidersHorizontal size={15} /> More filters
          </button>
        </div>
      </div>

      {/* Filter Chips & Collections */}
      {showAdvancedFilters && <div className="filter-bar">
        <div className="filter-chips">
          <span className="filter-bar__label"><Filter size={13} /> Style:</span>
          <button
            type="button"
            className={`chip ${selectedCategory === 'All' ? 'is-active' : ''}`}
            aria-pressed={selectedCategory === 'All'}
            onClick={() => setSelectedCategory('All')}
          >
            All
          </button>
          {MUSIC_STYLES.slice(0, 6).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip ${selectedCategory === cat ? 'is-active' : ''}`}
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="filter-selects">
          <label className="select-wrapper">
            <Music size={13} />
            <select value={selectedArrangement} onChange={(event) => setSelectedArrangement(event.target.value)} aria-label="Filter by musical arrangement">
              <option value="all">Any arrangement</option>
              {WORSHIP_ARRANGEMENTS.map((arrangement) => <option key={arrangement} value={arrangement}>{arrangement}</option>)}
            </select>
          </label>

          <label className="select-wrapper">
            <Globe2 size={13} />
            <select value={selectedPresentation} onChange={(event) => setSelectedPresentation(event.target.value)} aria-label="Filter by vocal and subtitle format">
              <option value="all">Any words / subtitle format</option>
              {LANGUAGE_PRESENTATIONS.map((presentation) => <option key={presentation} value={presentation}>{presentation}</option>)}
            </select>
          </label>

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
            <BadgeCheck size={14} className="icon-gold" /> Words or subtitles
          </label>

          <label className="checkbox-pill">
            <input
              type="checkbox"
              checked={onlyCcliTop100}
              onChange={(e) => setOnlyCcliTop100(e.target.checked)}
            />
            <Sparkles size={14} className="icon-purple" /> CCLI UK Top 100
          </label>

          <button
            type="button"
            className="btn-add-song btn-add-song--quiet"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={15} /> Add your own video
          </button>
        </div>
      </div>}

      {statusMessage && (
        <div className="status-banner" role="status">
          {statusMessage}
        </div>
      )}

      {/* Main Grid: Left List (35%) & Right Detail (65%) */}
      <div className={`music-dashboard__grid ${mobileDetailOpen ? 'is-mobile-detail' : ''}`}>
        {/* Left Side: Song Catalog List */}
        <div className="song-list-panel">
          <div className="song-list-panel__header">
            <h3>Results</h3>
            <span className="song-count-badge" aria-live="polite">{isSearchPending ? 'Searching…' : <>{filteredSongs.length.toLocaleString()} <span className="song-count-label">songs</span></>}</span>
          </div>

          <div className="song-list-panel__scroll">
            {filteredSongs.length === 0 ? (
              <div className="empty-search-state">
                <Music size={32} />
                <p>No songs match your criteria.</p>
                <button type="button" className="btn-secondary" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedHymnal('all'); setSelectedLanguage('all'); setSelectedArrangement('all'); setSelectedPresentation('all'); setOnlyVerifiedWords(false); setOnlyCcliTop100(false); }}>
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
              {filteredSongs.slice(0, visibleSongCount).map((song) => {
                const isSelected = selectedSong?.id === song.id;
                const hymnalRefs = songHymnalReferences(song);
                const isWordVideo = isCatalogueWordVideo(song.youtubeId) || approvedVideoIds.has(song.youtubeId);

                return (
                  <button
                    type="button"
                    key={song.id}
                    className={`song-card ${isSelected ? 'is-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => showSong(song)}
                  >
                    <div className="song-card__main">
                      <h4 className="song-card__title">{song.title}</h4>
                      {song.englishTitle && song.englishTitle !== song.title && <p className="song-card__translation">{song.englishTitle}</p>}
                      <p className="song-card__artist">{song.artist}</p>
                    </div>

                    <div className="song-card__meta">
                      {song.language && <span className="badge-language"><Globe2 size={11} /> {song.language}</span>}
                      <span className="badge-arrangement">{inferWorshipArrangement(song)}</span>
                      <span className="badge-presentation">{shortPresentationLabel(inferLanguagePresentation(song))}</span>
                      {song.versionType?.toLowerCase().includes('translation') && <span className="badge-version">Translation</span>}
                      {song.versionType === 'Familiar-song language version' && <span className="badge-version">Familiar song</span>}
                      {song.versionType === 'Modern word / subtitle video' && <span className="badge-version">Modern words</span>}
                      {song.versionType === 'Lyrics / subtitles indicated' && <span className="badge-version">Lyrics indicated</span>}
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
                  </button>
                );
              })}
              {filteredSongs.length > visibleSongCount && (
                <button
                  type="button"
                  className="btn-load-more"
                  onClick={() => setVisibleSongCount((count) => count + 50)}
                >
                  Show 50 more ({filteredSongs.length - visibleSongCount} remaining)
                </button>
              )}
              </>
            )}
          </div>
        </div>

        {/* Right Side: Detail & Embedded Player */}
        <div className="song-detail-panel">
          {selectedSong ? (
            <>
              <button type="button" className="mobile-results-back" onClick={showResults}>
                <ArrowLeft size={17} /> Back to results
              </button>
              <div className="song-detail-panel__header">
                <div>
                  <h2 className="song-detail__title">{selectedSong.title}</h2>
                  <p className="song-detail__artist">
                    <strong>By:</strong> {selectedSong.artist}
                    {selectedSong.language && <> · <strong>Language:</strong> {selectedSong.language}</>}
                    {selectedSong.region && <> · <strong>Region:</strong> {selectedSong.region}</>}
                  </p>
                  {selectedSong.sourceChannel && selectedSong.sourceChannel !== selectedSong.artist && <p className="song-detail__source">YouTube channel: {selectedSong.sourceChannel}</p>}
                  {selectedSong.englishTitle && selectedSong.englishTitle !== selectedSong.title && <p className="song-detail__translation">English: {selectedSong.englishTitle}</p>}
                  <div className="song-detail__format" aria-label="Video format">
                    <span><Music size={13} /> {inferWorshipArrangement(selectedSong)}</span>
                    <span><Globe2 size={13} /> {shortPresentationLabel(inferLanguagePresentation(selectedSong))}</span>
                  </div>
                  {selectedSong.catalogueReview && (
                    <p className="song-detail__review-note">
                      Video availability and uploader wording were checked{selectedSong.qualityCheckedOn ? ` on ${selectedSong.qualityCheckedOn}` : ''}. Arrangement and language-format labels are based on uploader metadata where they are not explicitly stated. Please preview the exact video and ask a native speaker or church leader to review translated words and theology before public use.
                    </p>
                  )}
                </div>

                <div className="song-detail__actions">
                  <button
                    type="button"
                    className="btn-add-playlist"
                    onClick={() => onAddToPlaylist({
                      ...selectedSong,
                      wordsIndicated: selectedSong.wordsIndicated || isCatalogueWordVideo(selectedSong.youtubeId) || approvedVideoIds.has(selectedSong.youtubeId),
                    })}
                  >
                    <ListPlus size={16} /> {playlistEnabled ? 'Add to service' : 'Create account to plan a service'}
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowEditModal(true)}
                    title="Edit Song Info / Video Link"
                    aria-label="Edit song information and video link"
                  >
                    <Pencil size={15} />
                  </button>
                  {selectedSong.id.startsWith('custom-') && (
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={handleDeleteCurrentSong}
                      title="Delete Custom Song"
                      aria-label="Delete custom song"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Hymnal References Banner */}
              {selectedHymnalReferences.length > 0 && (
                <div className="hymnal-refs-banner">
                  <strong><BookOpen size={14} /> Hymnal References:</strong>
                  {selectedHymnalReferences.map((ref, idx) => (
                    <span key={idx} className="hymnal-ref-pill">
                      {ref.hymnalName} #{ref.number}
                    </span>
                  ))}
                </div>
              )}

              {/* YouTube Video Player Embed */}
              {selectedSong.youtubeId ? (
                <>
                  <div className="video-player-wrapper">
                    <YouTubePlayer
                      videoId={selectedSong.youtubeId}
                      title={`${selectedSong.title} - ${selectedSong.artist}`}
                      autoplay={false}
                    />
                  </div>
                  <a className="video-fallback-link" href={youtubeWatchUrl(selectedSong.youtubeId)} target="_blank" rel="noreferrer">
                    Open directly on YouTube <ExternalLink size={13} />
                  </a>
                </>
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

              <button type="button" className="btn-manage-link" aria-expanded={showVideoTools} onClick={() => setShowVideoTools((visible) => !visible)}>
                {showVideoTools ? 'Hide video tools' : 'Video link needs changing?'}
              </button>

              {/* Link maintenance stays available without cluttering the normal planning flow. */}
              {showVideoTools && <div className="quick-link-box">
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
                    aria-label="YouTube link or video ID"
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
              </div>}

              {/* Verified Words & Quality Approval Controls */}
              {showVideoTools && selectedSong.youtubeId && (
                <div className="quality-controls-bar">
                  <button
                    type="button"
                    className={`btn-approval ${approvedVideoIds.has(selectedSong.youtubeId) ? 'is-approved' : ''}`}
                    aria-pressed={approvedVideoIds.has(selectedSong.youtubeId)}
                    onClick={() => handleToggleApprovedVideo(selectedSong.youtubeId)}
                  >
                    <BadgeCheck size={16} />
                    {approvedVideoIds.has(selectedSong.youtubeId) ? '✓ Verified Word Video (Approved)' : 'Mark as Verified Word Video'}
                  </button>
                </div>
              )}

            </>
          ) : (
            <div className="no-song-selected">
              <Music size={48} />
              <h3>Select a Song</h3>
              <p>Choose a hymn or worship song from the catalogue to preview its video and check the words. Members can add videos to a reusable service plan.</p>
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
