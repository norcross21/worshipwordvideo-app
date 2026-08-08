import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { SongLibraryDashboard } from './components/SongLibraryDashboard';
import { WorshipQueue } from './components/WorshipQueue';
import { SavedPlaylistsModal } from './components/SavedPlaylistsModal';
import { DonateModal } from './components/DonateModal';
import { VersionRefreshButton } from './components/VersionRefreshButton';
import { getWorshipQueue, addToWorshipQueue, worshipQueueItem, type WorshipQueueItem } from './data/worshipQueue';
import { getApprovedWorshipVideos } from './data/videoApproval';
import type { WorshipSong } from './data/worshipSongs';
import { Heart, Sparkles } from 'lucide-react';
import './App.css';

function MainApp() {
  const [activeTab, setActiveTab] = useState<'all' | 'ccli' | 'hymnals' | 'verified' | 'playlist'>('all');
  const [queue, setQueue] = useState<WorshipQueueItem[]>([]);
  const [approvedVideoIds, setApprovedVideoIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState('');
  const [showSavedPlaylistsModal, setShowSavedPlaylistsModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);

  useEffect(() => {
    setQueue(getWorshipQueue());
    setApprovedVideoIds(getApprovedWorshipVideos());
  }, []);

  const handleAddToPlaylist = (song: WorshipSong) => {
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
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        playlistCount={queue.length}
        onOpenSavedPlaylists={() => setShowSavedPlaylistsModal(true)}
        onOpenDonate={() => setShowDonateModal(true)}
      />

      {toastMessage && (
        <div className="toast-notification" role="status">
          {toastMessage}
        </div>
      )}

      <main className="app-main">
        {activeTab === 'playlist' ? (
          <WorshipQueue
            queue={queue}
            onChange={setQueue}
            approvedVideoIds={approvedVideoIds}
            onOpenSavedPlaylists={() => setShowSavedPlaylistsModal(true)}
          />
        ) : (
          <SongLibraryDashboard
            initialFilter={activeTab}
            onAddToPlaylist={handleAddToPlaylist}
          />
        )}
      </main>

      {/* Charity Support Callout Banner */}
      <section className="charity-banner" aria-label="Charity Partner Support">
        <div className="charity-banner__container">
          <div className="charity-banner__content">
            <span className="charity-banner__badge"><Heart size={14} fill="currentColor" /> 100% Free App</span>
            <h3>Supporting Homelessness & Sanctuary Support</h3>
            <p>Worship Word Video is completely free for all church leaders and congregations. If you find this app helpful in your worship ministry, please consider making a voluntary gift to our charity partner.</p>
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
        <SavedPlaylistsModal
          currentQueue={queue}
          onLoadPlaylist={handleLoadPlaylistFromCloud}
          onClose={() => setShowSavedPlaylistsModal(false)}
        />
      )}

      {showDonateModal && (
        <DonateModal
          onClose={() => setShowDonateModal(false)}
        />
      )}

      <footer className="app-footer">
        <div className="app-footer__container">
          <p>© {new Date().getFullYear()} Worship Word Video (<a href="https://worshipwordvideo.org" target="_blank" rel="noreferrer">worshipwordvideo.org</a>) — UK Hymn & Worship Lyric Video Finder for Churches.</p>
          <p className="app-footer__sub">Privacy-focused ad-free sing-along embeds powered by YouTube.</p>
          <VersionRefreshButton />
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
