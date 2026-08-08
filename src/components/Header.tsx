import { BadgeCheck, Film, ListMusic, Music2, Search, Sparkles, BookOpen } from 'lucide-react';

interface HeaderProps {
  activeTab: 'all' | 'ccli' | 'hymnals' | 'verified' | 'playlist';
  onSelectTab: (tab: 'all' | 'ccli' | 'hymnals' | 'verified' | 'playlist') => void;
  playlistCount: number;
}

export function Header({ activeTab, onSelectTab, playlistCount }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__container">
        <div className="app-header__brand">
          <div className="app-header__logo">
            <Film size={26} className="app-header__icon" />
          </div>
          <div>
            <h1 className="app-header__title">Worship Word Video</h1>
            <p className="app-header__subtitle">UK Worship & Hymn Lyric Video Finder — <span className="app-header__domain">worshipwordvideo.org</span></p>
          </div>
        </div>

        <nav className="app-header__nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'all' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('all')}
          >
            <Search size={16} /> All Songs & Hymns
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'ccli' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('ccli')}
          >
            <Sparkles size={16} /> CCLI Top 100
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'hymnals' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('hymnals')}
          >
            <BookOpen size={16} /> Hymnal Numbers
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'verified' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('verified')}
          >
            <BadgeCheck size={16} /> Verified Words
          </button>
          <button
            type="button"
            className={`nav-tab nav-tab--playlist ${activeTab === 'playlist' ? 'is-active' : ''}`}
            onClick={() => onSelectTab('playlist')}
          >
            <ListMusic size={16} /> Playlist {playlistCount > 0 && <span className="playlist-badge">{playlistCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
