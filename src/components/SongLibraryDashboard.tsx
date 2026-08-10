import { startTransition, useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Search,
  ArrowLeft,
  BadgeCheck,
  ListPlus,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Music,
  Globe2,
  CalendarDays,
  SlidersHorizontal,
  MonitorUp,
} from 'lucide-react';
import {
  loadRuntimeSongLibrary,
  languageFiltersForSongs,
  getApprovedRuntimeVideos,
  songMatchesSearch,
  songHymnalReferences,
  songMusicStyle,
  sortSongResults,
  type MusicStyle,
  HYMNAL_COLLECTION_OPTIONS,
  MUSIC_STYLES,
} from '../data/songLibraryRuntime';
import type { WorshipSong } from '../data/worshipSongs';
import {
  LANGUAGE_PRESENTATIONS,
  WORSHIP_ARRANGEMENTS,
  inferLanguagePresentation,
  inferWorshipArrangement,
  shortPresentationLabel,
} from '../data/songPresentation';
import { inferWorshipSeasons, WORSHIP_SEASONS, type WorshipSeason } from '../data/songSeason';
import { YouTubePlayer } from './YouTubePlayer';
import { youtubeWatchUrl } from '../data/youtube';
import { firstPlayableSong } from '../data/songSelection';

interface SongLibraryDashboardProps {
  initialFilter?: 'all' | 'ccli' | 'hymnals' | 'verified';
  onAddToPlaylist: (song: WorshipSong) => void;
  playlistEnabled?: boolean;
  activeServiceTitle?: string | null;
  onPresentVideo?: (song: WorshipSong) => void;
}

const seasonsBySongId = new Map<string, WorshipSeason[]>();
const MOBILE_CATALOGUE_QUERY = '(max-width: 900px)';

function seasonsForSong(song: WorshipSong): WorshipSeason[] {
  const cached = seasonsBySongId.get(song.id);
  if (cached) return cached;
  const seasons = inferWorshipSeasons(song);
  seasonsBySongId.set(song.id, seasons);
  return seasons;
}

function initialQueryParameter(name: string): string {
  return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

const initialSearchQuery = initialQueryParameter('q');
const requestedLanguage = initialQueryParameter('language');
const initialLanguage = requestedLanguage || 'all';
const requestedSeason = initialQueryParameter('season');
const initialSeason = WORSHIP_SEASONS.includes(requestedSeason as WorshipSeason) ? requestedSeason as WorshipSeason : 'all';
const requestedArrangement = initialQueryParameter('arrangement');
const initialArrangement = WORSHIP_ARRANGEMENTS.includes(requestedArrangement as (typeof WORSHIP_ARRANGEMENTS)[number]) ? requestedArrangement : 'all';
const requestedPresentation = initialQueryParameter('presentation');
const initialPresentation = LANGUAGE_PRESENTATIONS.includes(requestedPresentation as (typeof LANGUAGE_PRESENTATIONS)[number]) ? requestedPresentation : 'all';

export function SongLibraryDashboard({
  initialFilter = 'all',
  onAddToPlaylist,
  playlistEnabled = false,
  activeServiceTitle = null,
  onPresentVideo,
}: SongLibraryDashboardProps) {
  const [songs, setSongs] = useState<WorshipSong[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState('');
  const [catalogueReloadToken, setCatalogueReloadToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Well-known' | MusicStyle>('All');
  const [selectedHymnal, setSelectedHymnal] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [selectedSeason, setSelectedSeason] = useState<'all' | WorshipSeason>(initialSeason);
  const [selectedArrangement, setSelectedArrangement] = useState(initialArrangement);
  const [selectedPresentation, setSelectedPresentation] = useState(initialPresentation);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    initialSeason !== 'all' || initialArrangement !== 'all' || initialPresentation !== 'all',
  );
  const [onlyVerifiedWords, setOnlyVerifiedWords] = useState(initialFilter === 'verified');
  const [onlyCcliTop100, setOnlyCcliTop100] = useState(initialFilter === 'ccli');
  
  const [selectedSong, setSelectedSong] = useState<WorshipSong | null>(null);
  const [approvedVideoIds] = useState<Set<string>>(getApprovedRuntimeVideos);
  const [visibleSongCount, setVisibleSongCount] = useState(50);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearchPending = searchQuery !== deferredSearchQuery;
  const languageFilters = useMemo(() => languageFiltersForSongs(songs), [songs]);
  const advancedFilterCount = Number(selectedSeason !== 'all')
    + Number(selectedCategory !== 'All')
    + Number(selectedArrangement !== 'all')
    + Number(selectedPresentation !== 'all')
    + Number(selectedHymnal !== 'all')
    + Number(onlyVerifiedWords)
    + Number(onlyCcliTop100);

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

  useEffect(() => {
    let active = true;
    setCatalogueLoading(true);
    setCatalogueError('');
    void loadRuntimeSongLibrary()
      .then((library) => {
        if (!active) return;
        startTransition(() => {
          setSongs(library);
          setCatalogueLoading(false);
        });
      })
      .catch(() => {
        if (!active) return;
        setCatalogueLoading(false);
        setCatalogueError('The worship catalogue could not be loaded. Check your connection and try again.');
      });
    return () => { active = false; };
  }, [catalogueReloadToken]);

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
        if (selectedCategory === 'Well-known' && song.wordsIndicated !== true) {
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
      if (selectedSeason !== 'all' && !seasonsForSong(song).includes(selectedSeason)) return false;
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
        const isWordVideo = song.wordsIndicated === true || isApproved;
        if (!isWordVideo) return false;
      }

      return true;
    });
    return sortSongResults(matches, deferredSearchQuery);
  }, [songs, deferredSearchQuery, selectedCategory, selectedHymnal, selectedLanguage, selectedSeason, selectedArrangement, selectedPresentation, onlyCcliTop100, onlyVerifiedWords, approvedVideoIds]);

  useLayoutEffect(() => {
    setVisibleSongCount(50);
    setMobileDetailOpen(false);
    setSelectedSong(firstPlayableSong(filteredSongs));
  }, [filteredSongs]);

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
              {languageFilters.map((language) => <option key={language} value={language}>{language}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" aria-expanded={showAdvancedFilters} onClick={() => setShowAdvancedFilters((value) => !value)}>
            <SlidersHorizontal size={15} /> Filters {advancedFilterCount > 0 ? <span className="filter-count">{advancedFilterCount}</span> : null}
          </button>
        </div>
      </div>

      {/* Optional filters stay out of the main search path until requested. */}
      {showAdvancedFilters && <div className="filter-bar">
        <div className="filter-bar__grid">
          <label className="filter-field">
            <span><CalendarDays size={13} /> Church season</span>
            <select value={selectedSeason} onChange={(event) => setSelectedSeason(event.target.value as 'all' | WorshipSeason)} aria-label="Filter by church season">
              <option value="all">Any season</option>
              {WORSHIP_SEASONS.map((season) => <option key={season} value={season}>{season}</option>)}
            </select>
          </label>

          <label className="filter-field">
            <span><Music size={13} /> Worship style</span>
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as 'All' | 'Well-known' | MusicStyle)} aria-label="Filter by worship style">
              <option value="All">All styles</option>
              {MUSIC_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
            </select>
          </label>

          <label className="filter-field">
            <span><SlidersHorizontal size={13} /> Arrangement</span>
            <select value={selectedArrangement} onChange={(event) => setSelectedArrangement(event.target.value)} aria-label="Filter by musical arrangement">
              <option value="all">Any arrangement</option>
              {WORSHIP_ARRANGEMENTS.map((arrangement) => <option key={arrangement} value={arrangement}>{arrangement}</option>)}
            </select>
          </label>

          <label className="filter-field">
            <span><Globe2 size={13} /> Words and language</span>
            <select value={selectedPresentation} onChange={(event) => setSelectedPresentation(event.target.value)} aria-label="Filter by vocal and subtitle format">
              <option value="all">Any word or subtitle format</option>
              {LANGUAGE_PRESENTATIONS.map((presentation) => <option key={presentation} value={presentation}>{presentation}</option>)}
            </select>
          </label>

          <label className="filter-field">
            <span><BookOpen size={13} /> Hymn book</span>
            <select
              value={selectedHymnal}
              onChange={(e) => setSelectedHymnal(e.target.value)}
            >
              <option value="all">Any hymn book</option>
              {HYMNAL_COLLECTION_OPTIONS.map((h) => (
                <option key={h.code} value={h.code}>{h.shortName} ({h.name})</option>
              ))}
            </select>
          </label>

          <div className="filter-options" aria-label="Quick filter options">
            <label className="checkbox-pill">
              <input type="checkbox" checked={onlyVerifiedWords} onChange={(e) => setOnlyVerifiedWords(e.target.checked)} />
              <BadgeCheck size={14} /> Words on screen
            </label>
            <label className="checkbox-pill">
              <input type="checkbox" checked={onlyCcliTop100} onChange={(e) => setOnlyCcliTop100(e.target.checked)} />
              <Sparkles size={14} /> CCLI UK Top 100
            </label>
          </div>
        </div>
      </div>}

      {/* Main Grid: Left List (35%) & Right Detail (65%) */}
      <div className={`music-dashboard__grid ${mobileDetailOpen ? 'is-mobile-detail' : ''}`}>
        {/* Left Side: Song Catalog List */}
        <div className="song-list-panel">
          <div className="song-list-panel__header">
            <h3>Results</h3>
            <span className="song-count-badge" aria-live="polite">{catalogueLoading ? 'Loading…' : isSearchPending ? 'Searching…' : <>{filteredSongs.length.toLocaleString()} <span className="song-count-label">songs</span></>}</span>
          </div>

          <div className="song-list-panel__scroll">
            {catalogueLoading ? (
              <div className="catalogue-loading-state" role="status"><span aria-hidden="true" /><strong>Loading the worship catalogue…</strong><small>The playlist and account controls remain ready while the finder opens.</small></div>
            ) : catalogueError ? (
              <div className="empty-search-state" role="alert">
                <Music size={32} />
                <p>{catalogueError}</p>
                <button type="button" className="btn-secondary" onClick={() => setCatalogueReloadToken((value) => value + 1)}>Try again</button>
              </div>
            ) : filteredSongs.length === 0 ? (
              <div className="empty-search-state">
                <Music size={32} />
                <p>No songs match your criteria.</p>
                <button type="button" className="btn-secondary" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedHymnal('all'); setSelectedLanguage('all'); setSelectedSeason('all'); setSelectedArrangement('all'); setSelectedPresentation('all'); setOnlyVerifiedWords(false); setOnlyCcliTop100(false); }}>
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
              {filteredSongs.slice(0, visibleSongCount).map((song) => {
                const isSelected = selectedSong?.id === song.id;
                const hymnalRefs = songHymnalReferences(song);
                const isWordVideo = song.wordsIndicated === true || approvedVideoIds.has(song.youtubeId);

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
                      Checked{selectedSong.qualityCheckedOn ? ` on ${selectedSong.qualityCheckedOn}` : ''}. Preview the exact video before using it in church.
                    </p>
                  )}
                </div>

                <div className="song-detail__actions">
                  {playlistEnabled && onPresentVideo && selectedSong.youtubeId && (
                    <button
                      type="button"
                      className="btn-present-single"
                      onClick={() => onPresentVideo({
                        ...selectedSong,
                        wordsIndicated: selectedSong.wordsIndicated || approvedVideoIds.has(selectedSong.youtubeId),
                      })}
                    >
                      <MonitorUp size={16} /> Send to screen
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-add-playlist"
                    onClick={() => onAddToPlaylist({
                      ...selectedSong,
                      wordsIndicated: selectedSong.wordsIndicated || approvedVideoIds.has(selectedSong.youtubeId),
                    })}
                  >
                    <ListPlus size={16} /> {playlistEnabled
                      ? activeServiceTitle ? `Add to ${activeServiceTitle}` : 'Choose a service first'
                      : 'Create account to plan a service'}
                  </button>
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

    </div>
  );
}
