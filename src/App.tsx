import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
import {
  loadSavedServices,
  upsertSavedService,
  type SavedService,
} from './data/localServices';
import type { WorshipSong } from './data/worshipSongs';
import './App.css';
import { ProjectionScreen } from './components/ProjectionScreen';
import { ServiceWorkspaceBar } from './components/ServiceWorkspaceBar';
import { ProjectionControllerDock } from './components/ProjectionControllerDock';
import { SeoDiscoverySection } from './components/SeoDiscoverySection';
import { configureUsageAnalytics, recordUsageEvent } from './lib/usageAnalytics';
import { openProjectionWindow, publishProjectionState } from './data/projection';
import { PUBLIC_CONTACT_EMAIL, contactMailto } from './data/contact';

const SongLibraryDashboard = lazy(() => import('./components/SongLibraryDashboard').then((module) => ({ default: module.SongLibraryDashboard })));
const WorshipQueue = lazy(() => import('./components/WorshipQueue').then((module) => ({ default: module.WorshipQueue })));
const SavedPlaylistsModal = lazy(() => import('./components/SavedPlaylistsModal').then((module) => ({ default: module.SavedPlaylistsModal })));

interface PlanningState {
  services: SavedService[];
  activeService: SavedService | null;
  queue: WorshipQueueItem[];
}

function currentServices(services = loadSavedServices()): SavedService[] {
  return services.filter((service) => !service.archived_at);
}

function restorePlanningState(): PlanningState {
  const services = currentServices();
  const activeServiceId = getActiveServiceId();
  const activeService = activeServiceId ? services.find((service) => service.id === activeServiceId) ?? null : null;
  if (activeServiceId && !activeService) saveActiveServiceId(null);
  return {
    services,
    activeService,
    queue: activeService?.items ?? getWorshipQueue(),
  };
}

function LoadingPanel({ label = 'Loading Worship Word Video…' }: { label?: string }) {
  return <div className="app-loading" role="status">{label}</div>;
}

function MainApp() {
  const [initialPlanning] = useState(restorePlanningState);
  const [activeTab, setActiveTab] = useState<'all' | 'playlist'>('all');
  const [queue, setQueue] = useState<WorshipQueueItem[]>(initialPlanning.queue);
  const [activeService, setActiveService] = useState<SavedService | null>(initialPlanning.activeService);
  const [availableServices, setAvailableServices] = useState<SavedService[]>(initialPlanning.services);
  const [serviceSaveState, setServiceSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pendingPlaylistItem, setPendingPlaylistItem] = useState<WorshipQueueItem | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showSavedPlaylistsModal, setShowSavedPlaylistsModal] = useState(false);
  const [serviceModalMode, setServiceModalMode] = useState<'create' | 'manage'>('manage');
  const [showLegalModal, setShowLegalModal] = useState(() => new URLSearchParams(window.location.search).get('legal') === '1');
  const activeServiceRef = useRef(activeService);
  const savedStateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    configureUsageAnalytics({ accessToken: null, suppressed: false });
    recordUsageEvent('visit', 'page');
  }, []);

  useEffect(() => {
    activeServiceRef.current = activeService;
  }, [activeService]);

  useEffect(() => () => {
    if (savedStateTimerRef.current) window.clearTimeout(savedStateTimerRef.current);
  }, []);

  useEffect(() => {
    saveWorshipQueue(queue);
    const current = activeServiceRef.current;
    if (!current || JSON.stringify(current.items) === JSON.stringify(queue)) return;

    setServiceSaveState('saving');
    const updated = { ...current, items: queue, updated_at: new Date().toISOString() };
    const stored = upsertSavedService(updated);
    activeServiceRef.current = updated;
    setActiveService(updated);
    setAvailableServices(currentServices(stored));
    setServiceSaveState('saved');
    if (savedStateTimerRef.current) window.clearTimeout(savedStateTimerRef.current);
    savedStateTimerRef.current = window.setTimeout(() => setServiceSaveState('idle'), 1_800);
  }, [queue]);

  const showToast = (message: string, duration = 3_000) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), duration);
  };

  const handleAddToPlaylist = (song: WorshipSong) => {
    if (!song.youtubeId) {
      window.alert('This song does not have a video link yet. Please choose a playable YouTube video.');
      return;
    }

    const item = worshipQueueItem(song);
    if (!activeService) {
      setPendingPlaylistItem(item);
      setServiceModalMode(availableServices.length ? 'manage' : 'create');
      setShowSavedPlaylistsModal(true);
      showToast('Choose a saved service or create a new one for this video.');
      return;
    }

    const nextQueue = addToWorshipQueue(queue, item);
    setQueue(nextQueue);
    if (nextQueue.length > queue.length) recordUsageEvent('playlist_add');
    showToast(nextQueue.length === queue.length
      ? `“${song.title}” is already in ${activeService.title}.`
      : `✓ Added “${song.title}” to ${activeService.title}`);
  };

  const handleActivateService = async (playlist: SavedService) => {
    let items = Array.isArray(playlist.items) ? playlist.items : [];
    const recoveredItems = activeService ? [] : queue;
    for (const recoveredItem of recoveredItems) items = addToWorshipQueue(items, recoveredItem);
    if (pendingPlaylistItem) items = addToWorshipQueue(items, pendingPlaylistItem);

    const nextService = {
      ...playlist,
      items,
      updated_at: JSON.stringify(items) === JSON.stringify(playlist.items) ? playlist.updated_at : new Date().toISOString(),
    };
    const stored = upsertSavedService(nextService);
    if (pendingPlaylistItem) recordUsageEvent('playlist_add');
    activeServiceRef.current = nextService;
    setActiveService(nextService);
    setAvailableServices(currentServices(stored));
    setQueue(items);
    saveWorshipQueue(items);
    saveActiveServiceId(playlist.id);
    setPendingPlaylistItem(null);
    setServiceSaveState('saved');
    showToast(pendingPlaylistItem
      ? `✓ Added “${pendingPlaylistItem.title}” to ${playlist.title}`
      : recoveredItems.length
        ? `✓ Opened ${playlist.title} and recovered ${recoveredItems.length} video${recoveredItems.length === 1 ? '' : 's'}`
        : `✓ ${playlist.title} is now your active service`);
  };

  const handleServiceDeleted = (serviceId: string) => {
    setAvailableServices((current) => current.filter((service) => service.id !== serviceId));
    if (activeService?.id !== serviceId) return;
    activeServiceRef.current = null;
    setActiveService(null);
    setQueue([]);
    saveWorshipQueue([]);
    saveActiveServiceId(null);
  };

  const handleServiceUpsert = (service: SavedService) => {
    if (service.archived_at) return;
    setAvailableServices((current) => [service, ...current.filter((item) => item.id !== service.id)]);
    if (activeService?.id === service.id) {
      activeServiceRef.current = service;
      setActiveService(service);
    }
  };

  const handlePresentSingleVideo = async (song: WorshipSong) => {
    if (!song.youtubeId) return;
    const item = worshipQueueItem(song);
    const playbackRevision = Date.now();
    const launchId = `single-${playbackRevision}`;
    publishProjectionState({
      queue: [item],
      playingIndex: 0,
      playbackRevision,
      launchId,
      stopped: false,
      autoAdvance: false,
    });

    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('projection', '1');
    url.searchParams.set('launch', launchId);
    url.hash = '';
    const launch = await openProjectionWindow(url);
    if (launch.result === 'blocked') {
      showToast('Your browser blocked the presentation window. Allow pop-ups for this site, then try again.', 4_000);
      return;
    }
    if (launch.result === 'single-screen') {
      showToast('Connect a second display and choose Extend, then try Send to screen again.', 4_000);
      return;
    }
    recordUsageEvent('projection_open');
    publishProjectionState({
      queue: [item],
      playingIndex: 0,
      playbackRevision: playbackRevision + 1,
      launchId,
      stopped: false,
      autoAdvance: false,
    });
    showToast(launch.result === 'placed'
      ? `Showing “${song.title}” on the second screen.`
      : `Showing “${song.title}” in the linked church-screen window.`);
  };

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to the song finder</a>
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        playlistCount={queue.length}
        activeServiceTitle={activeService?.title ?? null}
      />

      <ProjectionControllerDock />

      {toastMessage && <div className="toast-notification" role="status">{toastMessage}</div>}

      <main className="app-main" id="main-content">
        <ServiceWorkspaceBar
          services={availableServices}
          activeService={activeService}
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

        <Suspense fallback={<LoadingPanel />}>
          {activeTab === 'playlist' ? (
            <WorshipQueue
              key={activeService?.id ?? 'no-service'}
              queue={queue}
              onChange={setQueue}
              activeService={activeService}
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
                activeServiceTitle={activeService?.title ?? null}
                onPresentVideo={handlePresentSingleVideo}
              />
              <SeoDiscoverySection />
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

      {showLegalModal && <LegalModal onClose={() => setShowLegalModal(false)} />}

      <footer className="app-footer">
        <div className="app-footer__container">
          <p>© {new Date().getFullYear()} Worship Word Video (<a href="https://worshipwordvideo.org" target="_blank" rel="noreferrer">worshipwordvideo.org</a>) — UK Hymn &amp; Worship Lyric Video Finder for Churches.</p>
          <p className="app-footer__sub">The catalogue is available without charge. Videos are provided by YouTube and remain subject to YouTube's own terms.</p>
          <p className="app-footer__kairos">Optional charity support: <a href="https://operations.kairoshousing.org.uk/donate" target="_blank" rel="noreferrer">Kairos Housing — Rebuilding lives with dignity</a></p>
          <div className="app-footer__legal-links">
            <a href="/videos/">Featured videos</a>
            <a href="/languages/">Languages</a>
            <a href="/formats/">Lyrics &amp; subtitles</a>
            <a href="/songs/">Songs across languages</a>
            <a href="/seasons/">Church seasons</a>
            <a href="/arrangements/">Worship styles</a>
            <a href="/guides/">Church guides</a>
            <a href="/about/">About &amp; catalogue method</a>
            <a href={contactMailto('enquiry')}>Contact: {PUBLIC_CONTACT_EMAIL}</a>
            <button type="button" onClick={() => setShowLegalModal(true)}>Terms, Privacy &amp; Copyright</button>
            <a href={contactMailto('content report')}>Report a content concern</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  if (new URLSearchParams(window.location.search).get('projection') === '1') return <ProjectionScreen />;
  return <MainApp />;
}

export default App;
