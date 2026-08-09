import { useState } from 'react';
import { ListMusic, User, LogIn, LogOut, Cloud, Heart, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  activeTab: 'all' | 'playlist' | 'admin';
  onSelectTab: (tab: 'all' | 'playlist' | 'admin') => void;
  playlistCount: number;
  onOpenSavedPlaylists?: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
  onOpenAccount: () => void;
  onOpenDonate: () => void;
}

export function Header({ activeTab, onSelectTab, playlistCount, onOpenSavedPlaylists, onOpenAuth, onOpenAccount, onOpenDonate }: HeaderProps) {
  const { user, profile, adminRole, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const memberName = profile?.display_name?.trim() || user?.user_metadata?.display_name || user?.email?.split('@')[0];

  return (
    <header className="app-header">
      <div className="app-header__container">
        <button type="button" className="app-header__brand" onClick={() => onSelectTab('all')} aria-label="Worship Word Video home">
          <span className="app-header__logo" aria-hidden="true">
            <img src="/worship-word-video-logo-512.png" alt="" />
          </span>
          <div className="app-header__brand-copy">
            <h1 className="app-header__title"><span>Worship</span>{' '}Word Video</h1>
            <p className="app-header__subtitle">Find the words. Plan the service. Press play.</p>
          </div>
        </button>

        <nav className="app-header__nav" aria-label="Main Navigation">
          {adminRole === 'master_admin' && (
            <button type="button" className={`nav-tab ${activeTab === 'admin' ? 'is-active' : ''}`} aria-pressed={activeTab === 'admin'} onClick={() => onSelectTab('admin')}>
              <ShieldCheck size={16} /> Admin
            </button>
          )}
          {user && (
            <button
              type="button"
              className={`nav-tab nav-tab--playlist ${activeTab === 'playlist' ? 'is-active' : ''}`}
              aria-pressed={activeTab === 'playlist'}
              onClick={() => onSelectTab('playlist')}
            >
              <ListMusic size={17} /> <span className="nav-tab__label">My service</span> {playlistCount > 0 && <span className="playlist-badge">{playlistCount}</span>}
            </button>
          )}
          <button
            type="button"
            className="nav-tab nav-tab--donate"
            onClick={onOpenDonate}
            aria-label="Support Kairos Housing charity"
          >
            <Heart size={16} /> <span className="nav-tab__label">Support Kairos</span>
          </button>
        </nav>

        {/* User Account & Donate Controls */}
        <div className="app-header__right-controls">
          <div className="app-header__user">
            {user ? (
              <div className="user-menu-wrapper">
                <button
                  type="button"
                  className="user-pill"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-expanded={showUserMenu}
                  aria-haspopup="menu"
                >
                  <div className="user-avatar">
                    <User size={14} />
                  </div>
                  <span className="user-email">{memberName}</span>
                </button>

                {showUserMenu && (
                  <div className="user-dropdown" role="menu">
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
                      className="user-dropdown__item"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAccount();
                      }}
                    >
                      <Settings size={15} /> Account & email choices
                    </button>
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
                  onClick={() => onOpenAuth('signin')}
                >
                  <LogIn size={15} /> <span>Log In</span>
                </button>
                <button
                  type="button"
                  className="btn-register"
                  onClick={() => onOpenAuth('signup')}
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </header>
  );
}
