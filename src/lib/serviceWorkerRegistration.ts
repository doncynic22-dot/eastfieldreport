/**
 * Service Worker Registration & Offline Data Protection Module
 * Ensures static assets and core database records are cached locally,
 * preventing data loss on unstable mobile networks.
 */

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW Registration] Service worker registered successfully with scope:', registration.scope);

        // Force an immediate update check against the server
        try {
          registration.update();
        } catch (e) {}

        // Check for updates to the service worker
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[SW Registration] New content is available; applying update.');
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  console.log('[SW Registration] Content is cached for offline use.');
                }
              }
            });
          }
        });

        // Trigger immediate core database snapshot caching
        syncCoreDatabaseSnapshot();
      })
      .catch((error) => {
        console.warn('[SW Registration] Service worker registration failed:', error);
      });

    // Handle service worker controller change (e.g. after skipWaiting)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        // Optional: reload or notify client
      }
    });
  });

  // Listen for online / offline status changes
  window.addEventListener('online', () => {
    console.log('[Network Monitor] Mobile connection restored. Triggering cloud synchronization...');
    window.dispatchEvent(new CustomEvent('app-connection-change', { detail: { online: true } }));
    syncCoreDatabaseSnapshot();
  });

  window.addEventListener('offline', () => {
    console.warn('[Network Monitor] Mobile network disconnected. Switched to offline database cache.');
    window.dispatchEvent(new CustomEvent('app-connection-change', { detail: { online: false } }));
    syncCoreDatabaseSnapshot();
  });

  // Set up periodic snapshot syncing every 30 seconds and on tab hide
  if (typeof window !== 'undefined') {
    setInterval(() => {
      syncCoreDatabaseSnapshot();
    }, 30000);

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        syncCoreDatabaseSnapshot();
      }
    });

    window.addEventListener('beforeunload', () => {
      syncCoreDatabaseSnapshot();
    });
  }
}

/**
 * Gathers core local database tables and sends a snapshot to the Service Worker
 * to be cached in persistent CacheStorage.
 */
export function syncCoreDatabaseSnapshot() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }

  try {
    const grades = localStorage.getItem('ea_grades') || localStorage.getItem('mock_supabase_ea_grades') || '[]';
    const students = localStorage.getItem('ea_students') || localStorage.getItem('mock_supabase_ea_students') || '[]';
    const attendance = localStorage.getItem('ea_attendance') || localStorage.getItem('mock_supabase_ea_attendance') || '[]';
    const reportConfigs = localStorage.getItem('ea_report_configs') || localStorage.getItem('mock_supabase_ea_report_configs') || '[]';
    const users = localStorage.getItem('ea_users') || localStorage.getItem('mock_supabase_ea_users') || '[]';
    const feePayments = localStorage.getItem('ea_fee_payments') || '[]';

    const payload = {
      grades: JSON.parse(grades),
      students: JSON.parse(students),
      attendance: JSON.parse(attendance),
      reportConfigs: JSON.parse(reportConfigs),
      users: JSON.parse(users),
      feePayments: JSON.parse(feePayments),
      savedAt: new Date().toISOString()
    };

    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_CORE_DATABASE_SNAPSHOT',
      payload,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[SW Snapshot] Failed to sync core database snapshot to Service Worker:', err);
  }
}
