import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AuthProvider, CURRENT_TERMS_VERSION, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { LegalModal } from './components/LegalModal';
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
import { ServiceWorkspaceBar } from './components/ServiceWorkspaceBar';
import { SeoDiscoverySection } from './components/SeoDiscoverySection';
import { supabase, supabaseErrorMessage, type SavedUserPlaylist } from './lib/supabase';
import { accountSetupIsCurrent, accountSetupPromptKey } from './lib/accountSetup';
import { recordUsageEvent } from './lib/usageAnalytics';
import {
  PROJECTION_WINDOW_NAME,
  chooseProjectionScreen,
  projectionPopupFeatures,
  publishProjectionState,
  type ProjectionScreenInfo,
  type WindowWithScreenDetails,
} from './data/projection';

const SongLibraryDashboard = lazy(() => import('./components/SongLibraryDashboard').then((module) => ({ default: module.SongLibraryDashboard })));
const WorshipQueue = lazy(() => import('./components/WorshipQueue').then((module) => ({ default: module.WorshipQueue })));
const SavedPlaylistsModal = lazy(() => import('./components/SavedPlaylistsModal').then((module) => ({ default: module.SavedPlaylistsModal })));
const DonateModal = lazy(() => import('./components/DonateModal').then((module) => ({ default: module.DonateModal })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const AuthModal = lazy(() => import('./components/AuthModal').then((module) => ({ default: module.AuthModal })));
const AccountModal = lazy(() => import('./components/AccountModal').then((module) => ({ default: module.AccountModal })));
const DONATION_PROMPT_MINIMUM_DELAY_MS = 75_000;

function LoadingPanel({ label = 'Loading Worship Word Video…' }: { label?: string }) {
  return <div className="app-loading" role="status">{label}</div>;
}

function MainApp() {
  const { user, loading: authLoading, profile, profileLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'playlist' | 'admin'>('all');
  const [finderReady, setFinderReady] = useState(false);
  const handleFinderReady = useCallback(() => setFinderReady(true), []);
  const [queue, setQueue] = useState<WorshipQueueItem[]>([]);
  const [queueOwnerId, setQueueOwnerId] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<SavedUserPlaylist | null>(null);
  const [availableServices, setAvailableServices] = useState<SavedUserPlaylist[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSaveState, setServiceSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pendingPlaylistItem, setPendingPlaylistItem] = useState<WorshipQueueItem | null>(null);
  const lastCloudItemsRef = useRef('');
  const [toastMessage, setToastMessage] = useState('');
  const [showSavedPlaylistsModal, setShowSavedPlaylistsModal] = useState(false);
  const [serviceModalMode, setServiceModalMode] = useState<'create' | 'manage'>('manage');
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donationDelayElapsed, setDonationDelayElapsed] = useState(false);
  const [guestHasEngaged, setGuestHasEngaged] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(() =>
    new URLSearchParams(window.location.search).get('legal') === '1'
  );
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup' | 'recover' | 'new-password' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reset-password') === '1' || params.get('invite') === '1' ? 'new-password' : null;
  });

  useEffect(() => {
    if (!authLoading) recordUsageEvent('visit', 'page');
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    if (!user) {
      setQueue([]);
      setQueueOwnerId(null);
      setActiveService(null);
      setAvailableServices([]);
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
      if (!supabase) {
        if (!active) return;
        setActiveService(null);
        setAvailableServices([]);
        setQueue(localQueue);
        lastCloudItemsRef.current = '';
        setQueueOwnerId(user.id);
        setServiceLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_playlists')
        .select('id,user_id,title,items,service_date,notes,archived_at,created_at,updated_at')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (!active) return;
      const playlists = error || !data ? [] : data as SavedUserPlaylist[];
      setAvailableServices(playlists);
      const restored = activeServiceId ? playlists.find((playlist) => playlist.id === activeServiceId) : null;
      if (!restored) {
        saveActiveServiceId(null, user.id);
        setActiveService(null);
        setQueue(localQueue);
        lastCloudItemsRef.current = '';
      } else {
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
  }, [authLoading, user]);

  useEffect(() => {
    if (user && queueOwnerId === user.id) saveWorshipQueue(queue, user.id);
  }, [queue, queueOwnerId, user]);

  useEffect(() => {
    if (!user || queueOwnerId !== user.id) return;
    setActiveService((current) => current ? { ...current, items: queue } : current);
    setAvailableServices((current) => current.map((service) => service.id === activeService?.id ? { ...service, items: queue } : service));
  }, [activeService?.id, queue, queueOwnerId, user]);

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
        .eq('updated_at', activeService.updated_at)
        .select('updated_at')
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) {
            setServiceSaveState('error');
            setToastMessage(error
              ? 'This service could not be saved. Check your connection and try again.'
              : 'This service was changed in another tab. Reopen it before making more changes.');
            window.setTimeout(() => setToastMessage(''), 4500);
            return;
          }
          lastCloudItemsRef.current = serialisedItems;
          setActiveService((current) => current?.id === activeService.id ? { ...current, items: queue, updated_at: data.updated_at } : current);
          setAvailableServices((current) => current.map((service) => service.id === activeService.id
            ? { ...service, items: queue, updated_at: data.updated_at }
            : service));
          setServiceSaveState('saved');
          window.setTimeout(() => setServiceSaveState('idle'), 1800);
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeService, queue, queueOwnerId, user]);

  useEffect(() => {
    if (!user || profileLoading || !profile || accountSetupIsCurrent(profile, CURRENT_TERMS_VERSION) || authModalTab) return;
    try {
      // A dismissed reminder stays dismissed on this device for this terms
      // version. A genuinely new version gets one fresh, non-repeating prompt.
      if (localStorage.getItem(accountSetupPromptKey(user.id, CURRENT_TERMS_VERSION)) === 'dismissed') return;
    } catch {
      // Do not repeatedly interrupt people when durable storage is restricted.
      return;
    }
    setShowAccountModal(true);
  }, [authModalTab, profile, profileLoading, user]);

  const closeAccountModal = () => {
    if (user) {
      try {
        localStorage.setItem(accountSetupPromptKey(user.id, CURRENT_TERMS_VERSION), 'dismissed');
      } catch {
        // Closing account settings must always work.
      }
    }
    setShowAccountModal(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setShowDonateModal(false);
      setDonationDelayElapsed(false);
      setGuestHasEngaged(false);
      return;
    }

    const timer = window.setTimeout(() => setDonationDelayElapsed(true), DONATION_PROMPT_MINIMUM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || user || !donationDelayElapsed || !guestHasEngaged) return;

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

    // Ask only after a guest has had time to search or choose a video, and never
    // stack the optional invitation over an account or service dialog.
    timer = window.setTimeout(openWhenInterfaceIsSettled, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authLoading, donationDelayElapsed, guestHasEngaged, user]);

  const recordGuestEngagement = useCallback(() => {
    setGuestHasEngaged(true);
  }, []);

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
      setServiceModalMode('manage');
      setShowSavedPlaylistsModal(true);
      setToastMessage('Choose a service or create a new one before adding this video.');
      window.setTimeout(() => setToastMessage(''), 3500);
      return;
    }
    const nextQueue = addToWorshipQueue(queue, item);

    setQueue(nextQueue);
    if (nextQueue.length > queue.length) recordUsageEvent('playlist_add');
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
    if (pendingPlaylistItem) recordUsageEvent('playlist_add');
    lastCloudItemsRef.current = JSON.stringify(items);
    setActiveService(nextService);
    setAvailableServices((current) => [nextService, ...current.filter((service) => service.id !== nextService.id)]);
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
    setAvailableServices((current) => current.filter((service) => service.id !== serviceId));
    if (activeService?.id !== serviceId) return;
    setActiveService(null);
    setQueue([]);
    lastCloudItemsRef.current = '';
    saveActiveServiceId(null, user?.id);
  };

  const handleServiceUpsert = (service: SavedUserPlaylist) => {
    if (service.archived_at) return;
    setAvailableServices((current) => [service, ...current.filter((item) => item.id !== service.id)]);
    if (activeService?.id === service.id) setActiveService(service);
  };

  const handlePresentSingleVideo = async (song: WorshipSong) => {
    if (!user || !song.youtubeId) return;
    const item = worshipQueueItem(song);
    const playbackRevision = Date.now();
    publishProjectionState({ queue: [item], playingIndex: 0, playbackRevision });

    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('projection', '1');
    url.searchParams.set('launch', `single-${playbackRevision}`);
    url.hash = '';
    const initialPlacement: ProjectionScreenInfo = {
      availLeft: window.screenX + 40,
      availTop: window.screenY + 40,
      availWidth: Math.min(1280, window.screen.availWidth),
      availHeight: Math.min(720, window.screen.availHeight),
    };
    const popup = window.open('', PROJECTION_WINDOW_NAME, projectionPopupFeatures(initialPlacement));
    if (!popup) {
      setToastMessage('Your browser blocked the presentation window. Allow pop-ups for this site, then try again.');
      window.setTimeout(() => setToastMessage(''), 4000);
      return;
    }
    recordUsageEvent('projection_open');

    let alreadyOpen = false;
    try {
      alreadyOpen = new URL(popup.location.href).searchParams.get('projection') === '1';
    } catch {
      alreadyOpen = true;
    }

    if (!alreadyOpen) {
      try {
        popup.document.title = 'Preparing church screen…';
        popup.document.body.style.cssText = 'display:grid;place-items:center;min-height:100vh;margin:0;color:#fff;background:#06162d;font:700 22px system-ui,sans-serif';
        popup.document.body.textContent = 'Preparing the church screen…';
      } catch {
        // The projection URL still loads if the temporary blank window is restricted.
      }
      const multiScreenWindow = window as WindowWithScreenDetails;
      if (multiScreenWindow.getScreenDetails) {
        try {
          const details = await multiScreenWindow.getScreenDetails();
          const target = chooseProjectionScreen(details);
          if (target) {
            popup.moveTo(target.availLeft, target.availTop);
            popup.resizeTo(target.availWidth, target.availHeight);
            url.searchParams.set('placed', '1');
          }
        } catch {
          // The clean window still opens when automatic screen placement is unavailable.
        }
      }
      popup.location.replace(url.toString());
    } else {
      // Re-publish after focusing so an already-open church screen changes immediately.
      publishProjectionState({ queue: [item], playingIndex: 0, playbackRevision: playbackRevision + 1 });
    }
    popup.focus();
    setToastMessage(`Showing “${song.title}” on the church screen.`);
    window.setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to the song finder</a>
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        playlistCount={queue.length}
        activeServiceTitle={activeService?.title ?? null}
        onOpenSavedPlaylists={() => {
          setServiceModalMode('manage');
          setShowSavedPlaylistsModal(true);
        }}
        onOpenAuth={setAuthModalTab}
        onOpenAccount={() => setShowAccountModal(true)}
        onOpenDonate={() => setShowDonateModal(true)}
      />

      {!authLoading && !user && (
        <section className="member-value-bar" aria-label="Member account benefits">
          <div className="member-value-bar__message">
            <span className="member-value-bar__icon" aria-hidden="true"><Sparkles size={17} /></span>
            <p><strong>Planning a service?</strong> Save playlists, tidy start and finish points, and use a clean church screen.</p>
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
        {user && activeTab !== 'admin' && (
          <ServiceWorkspaceBar
            services={availableServices}
            activeService={activeService}
            loading={serviceLoading}
            saveState={serviceSaveState}
            onSelectService={handleActivateService}
            onCreateService={() => {
              setPendingPlaylistItem(null);
              setServiceModalMode('create');
              setShowSavedPlaylistsModal(true);
            }}
            onManageServices={() => {
              setPendingPlaylistItem(null);
              setServiceModalMode('manage');
              setShowSavedPlaylistsModal(true);
            }}
          />
        )}
        <Suspense fallback={<LoadingPanel />}>
          {activeTab === 'admin' ? (
            <AdminDashboard />
          ) : activeTab === 'playlist' ? (
            <WorshipQueue
              key={activeService?.id ?? 'no-service'}
              queue={queue}
              onChange={setQueue}
              activeService={activeService}
              serviceLoading={serviceLoading}
              onOpenSavedPlaylists={() => {
                setServiceModalMode('create');
                setShowSavedPlaylistsModal(true);
              }}
              onBrowseSongs={() => setActiveTab('all')}
            />
          ) : (
            <>
              <SongLibraryDashboard
                initialFilter="all"
                onAddToPlaylist={handleAddToPlaylist}
                playlistEnabled={Boolean(user)}
                activeServiceTitle={activeService?.title ?? null}
                onPresentVideo={user ? handlePresentSingleVideo : undefined}
                onVisitorEngaged={!user ? recordGuestEngagement : undefined}
                onCatalogueReady={handleFinderReady}
              />
              {finderReady && <SeoDiscoverySection />}
            </>
          )}
        </Suspense>
      </main>

      {showSavedPlaylistsModal && (
        <Suspense fallback={null}>
          <SavedPlaylistsModal
            activePlaylistId={activeService?.id ?? null}
            activePlaylist={activeService}
            pendingItem={pendingPlaylistItem}
            initialMode={serviceModalMode}
            onActivatePlaylist={handleActivateService}
            onPlaylistUpsert={handleServiceUpsert}
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
          <AccountModal savedServiceCount={availableServices.length} onClose={closeAccountModal} />
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
            <a href="/formats/">Lyrics & subtitles</a>
            <a href="/songs/">Songs across languages</a>
            <a href="/seasons/">Church seasons</a>
            <a href="/arrangements/">Worship styles</a>
            <a href="/guides/">Church guides</a>
            <a href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20enquiry">Contact: stephen@kairoshousing.org.uk</a>
            <button type="button" onClick={() => setShowLegalModal(true)}>Terms, Privacy & Copyright</button>
            <a href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20content%20report">Report a content concern</a>
          </div>
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
