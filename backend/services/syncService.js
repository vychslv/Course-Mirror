import { fetchCanvasData } from './canvasService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let syncInterval = null;
let isSyncing = false;

export function startSyncService() {
  if (syncInterval) {
    console.log('⚠️  Sync service already running');
    return;
  }

  // Reload environment variables before starting (in case they were updated)
  const envPath = path.join(__dirname, '.env');
  try {
    dotenv.config({ path: envPath, override: true });
    console.log('🔄 Reloaded environment variables');
  } catch (err) {
    console.log('⚠️  Could not reload .env file:', err.message);
  }

  // Check if credentials are available
  if (!process.env.CANVAS_ACCESS_TOKEN || !process.env.CANVAS_BASE_URL) {
    console.log('⚠️  Canvas credentials not configured. Cannot start sync service.');
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
  isSyncing = false; // Reset syncing flag when stopping
}

// Export function to check if sync service is running
export function isSyncServiceRunning() {
  return syncInterval !== null;
}

// Export function to get sync status
export function getSyncStatus() {
  return {
    isRunning: syncInterval !== null,
    isSyncing: isSyncing
  };
}

async function performSync() {
  if (isSyncing) {
    console.log('⏳ Sync already in progress, will retry after current sync completes...');
    return;
  }

  // Check if credentials are available (process.env is updated directly by configure/login)
  // This ensures we use the same credentials as when you login
  if (!process.env.CANVAS_ACCESS_TOKEN || !process.env.CANVAS_BASE_URL) {
    console.log('⚠️  Canvas credentials not configured. Skipping sync.');
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

