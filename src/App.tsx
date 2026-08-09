import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { LegalModal } from './components/LegalModal';
import { VersionRefreshButton } from './components/VersionRefreshButton';
import {
  getActiveServiceId,
  getWorshipQueue,
  addToWorshipQueue,
  saveActiveServiceId,
  saveWorshipQueue,
  worshipQueueItem,
  type WorshipQueueItem,
} from './data/worshipQueue';
import type { WorshipSong } from './data/worshipSongs';
import { Sparkles } from 'lucide-react';
import './App.css';
import { ProjectionScreen } from './components/ProjectionScreen';
import { SeoDiscoverySection } from './components/SeoDiscoverySection';
import { supabase, supabaseErrorMessage, type SavedUserPlaylist } from './lib/supabase';

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
  const [activeService, setActiveService] = useState<SavedUserPlaylist | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSaveState, setServiceSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pendingPlaylistItem, setPendingPlaylistItem] = useState<WorshipQueueItem | null>(null);
  const lastCloudItemsRef = useRef('');
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
    let active = true;
    if (!user) {
      setQueue([]);
      setQueueOwnerId(null);
      setActiveService(null);
      setServiceLoading(false);
      setActiveTab('all');
      setShowSavedPlaylistsModal(false);
      setShowAccountModal(false);
      return;
    }

    const restoreService = async () => {
      setServiceLoading(true);
      setQueueOwnerId(null);
      const localQueue = getWorshipQueue(user.id);
      const activeServiceId = getActiveServiceId(user.id);
      if (!supabase || !activeServiceId) {
        if (!active) return;
        setActiveService(null);
        setQueue(localQueue);
        lastCloudItemsRef.current = '';
        setQueueOwnerId(user.id);
        setServiceLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_playlists')
        .select('id,user_id,title,items,service_date,notes,created_at,updated_at')
        .eq('id', activeServiceId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        saveActiveServiceId(null, user.id);
        setActiveService(null);
        setQueue(localQueue);
        lastCloudItemsRef.current = '';
      } else {
        const restored = data as SavedUserPlaylist;
        const items = Array.isArray(restored.items) ? restored.items : [];
        lastCloudItemsRef.current = JSON.stringify(items);
        setActiveService(restored);
        setQueue(items);
      }
      setQueueOwnerId(user.id);
      setServiceLoading(false);
    };

    void restoreService();
    return () => { active = false; };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (user && queueOwnerId === user.id) saveWorshipQueue(queue, user.id);
  }, [queue, queueOwnerId, user?.id]);

  useEffect(() => {
    if (!user || queueOwnerId !== user.id) return;
    setActiveService((current) => current ? { ...current, items: queue } : current);
  }, [queue, queueOwnerId, user?.id]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user || !activeService || queueOwnerId !== user.id) return;
    const serialisedItems = JSON.stringify(queue);
    if (serialisedItems === lastCloudItemsRef.current) return;
    setServiceSaveState('saving');
    const timer = window.setTimeout(() => {
      void client
        .from('user_playlists')
        .update({ items: queue })
        .eq('id', activeService.id)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) {
            setServiceSaveState('error');
            return;
          }
          lastCloudItemsRef.current = serialisedItems;
          setActiveService((current) => current?.id === activeService.id ? { ...current, items: queue, updated_at: new Date().toISOString() } : current);
          setServiceSaveState('saved');
          window.setTimeout(() => setServiceSaveState('idle'), 1800);
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeService?.id, queue, queueOwnerId, user?.id]);

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
  }, [authLoading, user?.id]);

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
    if (!activeService) {
      setPendingPlaylistItem(item);
      setShowSavedPlaylistsModal(true);
      setToastMessage('Choose a service or create a new one before adding this video.');
      window.setTimeout(() => setToastMessage(''), 3500);
      return;
    }
    const nextQueue = addToWorshipQueue(queue, item);

    setQueue(nextQueue);
    setToastMessage(nextQueue.length === queue.length
      ? `“${song.title}” is already in ${activeService.title}.`
      : `✓ Added “${song.title}” to ${activeService.title}`);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleActivateService = async (playlist: SavedUserPlaylist) => {
    if (!user) return;
    let items = Array.isArray(playlist.items) ? playlist.items : [];
    const recoveredItems = activeService ? [] : queue;
    for (const recoveredItem of recoveredItems) items = addToWorshipQueue(items, recoveredItem);
    if (pendingPlaylistItem) items = addToWorshipQueue(items, pendingPlaylistItem);
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(playlist.items ?? []);
    if (itemsChanged) {
      if (!supabase) throw new Error('Cloud services are unavailable. Please refresh and try again.');
      const { error } = await supabase
        .from('user_playlists')
        .update({ items })
        .eq('id', playlist.id)
        .eq('user_id', user.id);
      if (error) throw new Error(supabaseErrorMessage(error, 'The video could not be added to this service.'));
    }
    const nextService = { ...playlist, items };
    lastCloudItemsRef.current = JSON.stringify(items);
    setActiveService(nextService);
    setQueue(items);
    setQueueOwnerId(user.id);
    saveActiveServiceId(playlist.id, user.id);
    setPendingPlaylistItem(null);
    setServiceSaveState('saved');
    setToastMessage(pendingPlaylistItem
      ? `✓ Added “${pendingPlaylistItem.title}” to ${playlist.title}`
      : recoveredItems.length
        ? `✓ Opened ${playlist.title} and recovered ${recoveredItems.length} unsaved video${recoveredItems.length === 1 ? '' : 's'}`
      : `✓ ${playlist.title} is now your active service`);
    window.setTimeout(() => {
      setToastMessage('');
      setServiceSaveState('idle');
    }, 3000);
  };

  const handleServiceDeleted = (serviceId: string) => {
    if (activeService?.id !== serviceId) return;
    setActiveService(null);
    setQueue([]);
    lastCloudItemsRef.current = '';
    saveActiveServiceId(null, user?.id);
  };

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to the song finder</a>
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        playlistCount={queue.length}
        activeServiceTitle={activeService?.title ?? null}
        onOpenSavedPlaylists={() => setShowSavedPlaylistsModal(true)}
        onOpenAuth={setAuthModalTab}
        onOpenAccount={() => setShowAccountModal(true)}
        onOpenDonate={() => setShowDonateModal(true)}
      />

      {!authLoading && !user && (
        <section className="member-value-bar" aria-label="Member account benefits">
          <div className="member-value-bar__message">
            <span className="member-value-bar__icon" aria-hidden="true"><Sparkles size={17} /></span>
            <p><strong>Planning a worship service?</strong> Create an account to save and reuse services, set clean video start and finish points, and present on a distraction-free second screen.</p>
          </div>
          <div className="member-value-bar__actions">
            <button type="button" className="member-value-bar__create" onClick={() => setAuthModalTab('signup')}>Create an account</button>
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
              activeService={activeService}
              serviceLoading={serviceLoading}
              saveState={serviceSaveState}
              onOpenSavedPlaylists={() => setShowSavedPlaylistsModal(true)}
              onBrowseSongs={() => setActiveTab('all')}
            />
          ) : (
            <SongLibraryDashboard
              initialFilter="all"
              onAddToPlaylist={handleAddToPlaylist}
              playlistEnabled={Boolean(user)}
              activeServiceTitle={activeService?.title ?? null}
              onOpenServiceManager={() => {
                setPendingPlaylistItem(null);
                setShowSavedPlaylistsModal(true);
              }}
            />
          )}
        </Suspense>
        {activeTab === 'all' && <SeoDiscoverySection />}
      </main>

      {showSavedPlaylistsModal && (
        <Suspense fallback={null}>
          <SavedPlaylistsModal
            activePlaylistId={activeService?.id ?? null}
            activePlaylist={activeService}
            pendingItem={pendingPlaylistItem}
            onActivatePlaylist={handleActivateService}
            onPlaylistDeleted={handleServiceDeleted}
            onClose={() => {
              setPendingPlaylistItem(null);
              setShowSavedPlaylistsModal(false);
            }}
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

      {showDonateModal && !user && (
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
