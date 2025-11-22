import { fetchCanvasData } from './canvasService.js';

let syncInterval = null;
let isSyncing = false;

export function startSyncService() {
  if (syncInterval) {
    console.log('⚠️  Sync service already running');
    return;
  }

  console.log('🔄 Starting sync service (5 second intervals)...');
  
  // Initial sync
  performSync();

  // Set up interval - use setTimeout chain instead of setInterval to ensure syncs don't overlap
  const scheduleNextSync = () => {
    syncInterval = setTimeout(() => {
      performSync().finally(() => {
        scheduleNextSync(); // Schedule next sync after current one completes
      });
    }, 5000);
  };
  
  scheduleNextSync();
}

export function stopSyncService() {
  if (syncInterval) {
    clearTimeout(syncInterval);
    syncInterval = null;
    console.log('⏹️  Sync service stopped');
  }
}

async function performSync() {
  if (isSyncing) {
    console.log('⏳ Sync already in progress, will retry after current sync completes...');
    return;
  }

  isSyncing = true;
  const syncStartTime = Date.now();
  try {
    const syncTime = new Date().toLocaleTimeString();
    console.log(`🔄 [${syncTime}] Starting sync...`);
    await fetchCanvasData();
    const syncDuration = ((Date.now() - syncStartTime) / 1000).toFixed(2);
    console.log(`✅ [${syncTime}] Sync completed in ${syncDuration}s - Next sync in 5s`);
  } catch (error) {
    const syncDuration = ((Date.now() - syncStartTime) / 1000).toFixed(2);
    console.error(`❌ Sync error after ${syncDuration}s:`, error.message);
    console.error('Stack:', error.stack);
  } finally {
    isSyncing = false;
  }
}

