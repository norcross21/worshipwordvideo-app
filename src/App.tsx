import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SongLibraryDashboard } from './components/SongLibraryDashboard';
import { WorshipQueue } from './components/WorshipQueue';
import { getWorshipQueue, addToWorshipQueue, worshipQueueItem, type WorshipQueueItem } from './data/worshipQueue';
import { getApprovedWorshipVideos } from './data/videoApproval';
import type { WorshipSong } from './data/worshipSongs';
import './App.css';

export function App() {
  const [activeTab, setActiveTab] = useState<'all' | 'ccli' | 'hymnals' | 'verified' | 'playlist'>('all');
  const [queue, setQueue] = useState<WorshipQueueItem[]>([]);
  const [approvedVideoIds, setApprovedVideoIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState('');

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

  return (
    <div className="app-layout">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        playlistCount={queue.length}
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
          />
        ) : (
          <SongLibraryDashboard
            initialFilter={activeTab}
            onAddToPlaylist={handleAddToPlaylist}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="app-footer__container">
          <p>© {new Date().getFullYear()} Worship Word Video (<a href="https://worshipwordvideo.org" target="_blank" rel="noreferrer">worshipwordvideo.org</a>) — UK Hymn & Worship Lyric Video Finder for Churches.</p>
          <p className="app-footer__sub">Privacy-focused ad-free sing-along embeds powered by YouTube.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
