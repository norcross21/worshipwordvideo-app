import { useState } from 'react';
import { BadgeCheck, Film, ListMusic, Search, Sparkles, BookOpen, User, LogIn, LogOut, Cloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

interface HeaderProps {
  activeTab: 'all' | 'ccli' | 'hymnals' | 'verified' | 'playlist';
  onSelectTab: (tab: 'all' | 'ccli' | 'hymnals' | 'verified' | 'playlist') => void;
  playlistCount: number;
  onOpenSavedPlaylists?: () => void;
}

export function Header({ activeTab, onSelectTab, playlistCount, onOpenSavedPlaylists }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signin');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const openAuth = (tab: 'signin' | 'signup') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

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

        {/* User Account Controls */}
        <div className="app-header__user">
          {user ? (
            <div className="user-menu-wrapper">
              <button
                type="button"
                className="user-pill"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar">
                  <User size={14} />
                </div>
                <span className="user-email">{user.email?.split('@')[0]}</span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-dropdown__info">
                    <strong>Signed in as</strong>
                    <p>{user.email}</p>
                  </div>
                  {onOpenSavedPlaylists && (
                    <button
                      type="button"
                      className="user-dropdown__item"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSavedPlaylists();
                      }}
                    >
                      <Cloud size={15} /> My Saved Playlists
                    </button>
                  )}
                  <button
                    type="button"
                    className="user-dropdown__item user-dropdown__item--logout"
                    onClick={() => {
                      setShowUserMenu(false);
                      void signOut();
                    }}
                  >
                    <LogOut size={15} /> Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                type="button"
                className="btn-login"
                onClick={() => openAuth('signin')}
              >
                <LogIn size={15} /> Log In
              </button>
              <button
                type="button"
                className="btn-register"
                onClick={() => openAuth('signup')}
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal
          initialTab={authModalTab}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </header>
  );
}
