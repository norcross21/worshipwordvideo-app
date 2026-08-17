import { useState } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface VersionRefreshButtonProps {
  buildTime?: string;
}

export function VersionRefreshButton({ buildTime = __BUILD_TIMESTAMP__ }: VersionRefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const formattedDate = () => {
    try {
      const d = new Date(buildTime);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return buildTime;
    }
  };

  const handleForceRefresh = async () => {
    setRefreshing(true);

    try {
      // 1. Clear Service Workers if present
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 2. Clear browser Cache Storage
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }

      // 3. Clear temporary tab state. Account sessions are stored separately,
      // so the master admin remains signed in after the update.
      sessionStorage.clear();

      setRefreshed(true);

      // 4. Force a fresh HTML request. Vite's hashed asset names then fetch the
      // exact JavaScript and CSS belonging to this Vercel deployment.
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('_admin_update', Date.now().toString());
        window.location.replace(url.toString());
      }, 500);
    } catch (err) {
      console.error('Failed to clear cache:', err);
      window.location.reload();
    }
  };

  return (
    <div className="version-refresh-wrapper">
      <button
        type="button"
        className={`version-refresh-btn ${refreshing ? 'is-refreshing' : ''}`}
        onClick={handleForceRefresh}
        title="Click to clear browser cache and force load the latest update from worshipwordvideo.org"
      >
        <RefreshCw size={12} className={refreshing ? 'spin-icon' : ''} />
        <span>
          {refreshing
            ? 'Updating to latest version...'
            : refreshed
            ? 'Updated! Reloading...'
            : `Build ${formattedDate()} · Fetch latest version`}
        </span>
      </button>
    </div>
  );
}
