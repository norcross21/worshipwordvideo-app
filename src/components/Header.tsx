import { ListMusic } from 'lucide-react';

interface HeaderProps {
  activeTab: 'all' | 'playlist';
  onSelectTab: (tab: 'all' | 'playlist') => void;
  playlistCount: number;
  activeServiceTitle: string | null;
}

export function Header({ activeTab, onSelectTab, playlistCount, activeServiceTitle }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__container">
        <button type="button" className="app-header__brand" onClick={() => onSelectTab('all')} aria-label="Worship Word Video home">
          <span className="app-header__logo" aria-hidden="true">
            <img src="/worship-word-video-logo.svg" alt="" />
          </span>
          <div className="app-header__brand-copy">
            <span className="app-header__title"><span>Worship</span>{' '}Word Video</span>
            <p className="app-header__subtitle">Find the words. Plan the service. Press play.</p>
          </div>
        </button>

        <nav className="app-header__nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-tab nav-tab--playlist ${activeTab === 'playlist' ? 'is-active' : ''}`}
            aria-pressed={activeTab === 'playlist'}
            onClick={() => onSelectTab('playlist')}
            title={activeServiceTitle ? `Open ${activeServiceTitle}` : 'Open service planning'}
          >
            <ListMusic size={17} /> <span className="nav-tab__label">Service plan</span>
            {playlistCount > 0 && <span className="playlist-badge">{playlistCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
