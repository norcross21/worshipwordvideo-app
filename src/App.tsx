import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { LegalModal } from './components/LegalModal';
import { VersionRefreshButton } from './components/VersionRefreshButton';
import { getWorshipQueue, addToWorshipQueue, saveWorshipQueue, worshipQueueItem, type WorshipQueueItem } from './data/worshipQueue';
import type { WorshipSong } from './data/worshipSongs';
import { Heart, Sparkles } from 'lucide-react';
import './App.css';
import { ProjectionScreen } from './components/ProjectionScreen';
import { SeoDiscoverySection } from './components/SeoDiscoverySection';

const SongLibraryDashboard = lazy(() => import('./components/SongLibraryDashboard').then((module) => ({ default: module.SongLibraryDashboard })));
const WorshipQueue = lazy(() => import('./components/WorshipQueue').then((module) => ({ default: module.WorshipQueue })));
const SavedPlaylistsModal = lazy(() => import('./components/SavedPlaylistsModal').then((module) => ({ default: module.SavedPlaylistsModal })));
const DonateModal = lazy(() => import('./components/DonateModal').then((module) => ({ default: module.DonateModal })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const AuthModal = lazy(() => import('./components/AuthModal').then((module) => ({ default: module.AuthModal })));
const AccountModal = lazy(() => import('./components/AccountModal').then((module) => ({ default: module.AccountModal })));

function LoadingPanel({ label = 'Loading Worship Word Video…' }: { label?: string }) {
  return <div className="app-loading" role="status">{label}</div>;
}

function MainApp() {
  const { user, loading: authLoading, profile, profileLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'playlist' | 'admin'>('all');
  const [queue, setQueue] = useState<WorshipQueueItem[]>([]);
  const [queueOwnerId, setQueueOwnerId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showSavedPlaylistsModal, setShowSavedPlaylistsModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(() =>
    new URLSearchParams(window.location.search).get('legal') === '1'
  );
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup' | 'recover' | 'new-password' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reset-password') === '1' || params.get('invite') === '1' ? 'new-password' : null;
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setQueue([]);
      setQueueOwnerId(null);
      setActiveTab('all');
      setShowSavedPlaylistsModal(false);
      setShowAccountModal(false);
      return;
    }
    setQueue(getWorshipQueue(user.id));
    setQueueOwnerId(user.id);
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (user && queueOwnerId === user.id) saveWorshipQueue(queue, user.id);
  }, [queue, queueOwnerId, user?.id]);

  useEffect(() => {
    if (!user || profileLoading || !profile || profile.terms_accepted_at || authModalTab) return;
    const key = `worship_account_setup_prompt:${user.id}`;
    try {
      if (sessionStorage.getItem(key) === 'seen') return;
      sessionStorage.setItem(key, 'seen');
    } catch {
      // Account setup can still open when browser storage is restricted.
    }
    setShowAccountModal(true);
  }, [authModalTab, profile, profileLoading, user]);

  useEffect(() => {
    if (authLoading || user) return;

    let cancelled = false;
    let timer = 0;
    const promptWasSeen = () => {
      try {
        return sessionStorage.getItem('worship_donation_prompt_seen') === 'yes';
      } catch {
        return false;
      }
    };
    const openWhenInterfaceIsSettled = () => {
      if (cancelled || promptWasSeen()) return;
      if (document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(openWhenInterfaceIsSettled, 1500);
        return;
      }
      setShowDonateModal(true);
    };

    // Let the catalogue settle and never stack this invitation over another dialog.
    timer = window.setTimeout(openWhenInterfaceIsSettled, 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authLoading, user]);

  const closeDonateModal = () => {
    try {
      sessionStorage.setItem('worship_donation_prompt_seen', 'yes');
    } catch {
      // Closing the modal must always work, even in strict privacy modes.
    }
    setShowDonateModal(false);
  };

  const handleAddToPlaylist = (song: WorshipSong) => {
    if (!user) {
      setAuthModalTab('signup');
      setToastMessage('Create an account to build, trim and save service playlists.');
      window.setTimeout(() => setToastMessage(''), 3500);
      return;
    }
    if (!song.youtubeId) {
      alert('This song does not have a video link yet. Please add or link a YouTube video first.');
      return;
    }

    const item = worshipQueueItem(song);
    const nextQueue = addToWorshipQueue(queue, item);

    setQueue(nextQueue);
    setToastMessage(`✓ Added "${song.title}" to Service Playlist`);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleLoadPlaylistFromCloud = (items: WorshipQueueItem[]) => {
    setQueue(items);
    setToastMessage(`✓ Loaded playlist into active queue (${items.length} songs)`);
    setTimeout(() => setToastMessage(''), 3500);
  };

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to the song finder</a>
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        playlistCount={queue.length}
        onOpenSavedPlaylists={() => setShowSavedPlaylistsModal(true)}
        onOpenDonate={() => setShowDonateModal(true)}
        onOpenAuth={setAuthModalTab}
        onOpenAccount={() => setShowAccountModal(true)}
      />

      {!authLoading && !user && (
        <section className="member-value-bar" aria-label="Member account benefits">
          <div className="member-value-bar__message">
            <span className="member-value-bar__icon" aria-hidden="true"><Sparkles size={17} /></span>
            <p><strong>Planning a worship service?</strong> Create an account to save and reuse services, set clean video start and finish points, and present on a distraction-free second screen.</p>
          </div>
          <div className="member-value-bar__actions">
            <button type="button" className="member-value-bar__login" onClick={() => setAuthModalTab('signin')}>Already a member? Log in</button>
            <button type="button" className="member-value-bar__create" onClick={() => setAuthModalTab('signup')}>Create account</button>
          </div>
        </section>
      )}

      {toastMessage && (
        <div className="toast-notification" role="status">
          {toastMessage}
        </div>
      )}

      <main className="app-main" id="main-content">
        <Suspense fallback={<LoadingPanel />}>
          {activeTab === 'admin' ? (
            <AdminDashboard />
          ) : activeTab === 'playlist' ? (
            <WorshipQueue
              queue={queue}
              onChange={setQueue}
              onOpenSavedPlaylists={() => setShowSavedPlaylistsModal(true)}
              onBrowseSongs={() => setActiveTab('all')}
            />
          ) : (
            <SongLibraryDashboard
              initialFilter="all"
              onAddToPlaylist={handleAddToPlaylist}
              playlistEnabled={Boolean(user)}
            />
          )}
        </Suspense>
        {activeTab === 'all' && <SeoDiscoverySection />}
      </main>

      {/* Charity Support Callout Banner */}
      <section className="charity-banner" aria-label="Charity Partner Support">
        <div className="charity-banner__container">
          <div className="charity-banner__content">
            <span className="charity-banner__badge"><Heart size={14} fill="currentColor" /> Optional charity support</span>
            <h3>Kairos Housing — Rebuilding lives with dignity</h3>
            <p>Catalogue browsing and member tools are currently provided without charge. If the app helps your church, you may choose to support Kairos Housing.</p>
          </div>
          <button
            type="button"
            className="btn-charity-gift"
            onClick={() => setShowDonateModal(true)}
          >
            <Sparkles size={15} /> Gift to Charity Partner
          </button>
        </div>
      </section>

      {showSavedPlaylistsModal && (
        <Suspense fallback={null}>
          <SavedPlaylistsModal
            currentQueue={queue}
            onLoadPlaylist={handleLoadPlaylistFromCloud}
            onClose={() => setShowSavedPlaylistsModal(false)}
          />
        </Suspense>
      )}

      {authModalTab && (
        <Suspense fallback={null}>
          <AuthModal initialTab={authModalTab} onClose={() => setAuthModalTab(null)} />
        </Suspense>
      )}

      {showAccountModal && user && (
        <Suspense fallback={null}>
          <AccountModal onClose={() => setShowAccountModal(false)} />
        </Suspense>
      )}

      {showDonateModal && (
        <Suspense fallback={null}>
          <DonateModal onClose={closeDonateModal} />
        </Suspense>
      )}

      {showLegalModal && (
        <LegalModal onClose={() => setShowLegalModal(false)} />
      )}

      <footer className="app-footer">
        <div className="app-footer__container">
          <p>© {new Date().getFullYear()} Worship Word Video (<a href="https://worshipwordvideo.org" target="_blank" rel="noreferrer">worshipwordvideo.org</a>) — UK Hymn & Worship Lyric Video Finder for Churches.</p>
          <p className="app-footer__sub">The catalogue is currently available without charge. Videos are provided by YouTube and remain subject to YouTube's own terms.</p>
          <div className="app-footer__legal-links">
            <a href="/languages/">Languages</a>
            <a href="/arrangements/">Worship styles</a>
            <a href="/guides/">Church guides</a>
            <button type="button" onClick={() => setShowLegalModal(true)}>Terms, Privacy & Copyright</button>
            <a href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20content%20report">Report a content concern</a>
          </div>
          <VersionRefreshButton />
        </div>
      </footer>
    </div>
  );
}

export function App() {
  if (new URLSearchParams(window.location.search).get('projection') === '1') return <ProjectionScreen />;
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
