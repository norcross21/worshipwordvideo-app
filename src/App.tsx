import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { SongLibraryDashboard } from './components/SongLibraryDashboard';
import { WorshipQueue } from './components/WorshipQueue';
import { SavedPlaylistsModal } from './components/SavedPlaylistsModal';
import { getWorshipQueue, addToWorshipQueue, worshipQueueItem, type WorshipQueueItem } from './data/worshipQueue';
import { getApprovedWorshipVideos } from './data/videoApproval';
import type { WorshipSong } from './data/worshipSongs';
import './App.css';

function MainApp() {
  const [activeTab, setActiveTab] = useState<'all' | 'ccli' | 'hymnals' | 'verified' | 'playlist'>('all');
  const [queue, setQueue] = useState<WorshipQueueItem[]>([]);
  const [approvedVideoIds, setApprovedVideoIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState('');
  const [showSavedPlaylistsModal, setShowSavedPlaylistsModal] = useState(false);

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

      {showSavedPlaylistsModal && (
        <SavedPlaylistsModal
          currentQueue={queue}
          onLoadPlaylist={handleLoadPlaylistFromCloud}
          onClose={() => setShowSavedPlaylistsModal(false)}
        />
      )}

      <footer className="app-footer">
        <div className="app-footer__container">
          <p>© {new Date().getFullYear()} Worship Word Video (<a href="https://worshipwordvideo.org" target="_blank" rel="noreferrer">worshipwordvideo.org</a>) — UK Hymn & Worship Lyric Video Finder for Churches.</p>
          <p className="app-footer__sub">Privacy-focused ad-free sing-along embeds powered by YouTube & Supabase Auth.</p>
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
