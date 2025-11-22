import express from 'express';
import { fetchCanvasData } from '../services/canvasService.js';
import { startSyncService, stopSyncService, getSyncStatus } from '../services/syncService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Proxy endpoint for Canvas files (with authentication)
// Note: Canvas API enforces file access permissions based on the access token.
// Users can only access files from courses they have access to.
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
    const CANVAS_ACCESS_TOKEN = process.env.CANVAS_ACCESS_TOKEN;

    if (!CANVAS_BASE_URL || !CANVAS_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Canvas not configured' });
    }

    const fetch = (await import('node-fetch')).default;
    
    // Fetch file metadata first to get content-type and filename efficiently
    // This is necessary to determine if it's a PDF and get the proper filename
    const fileInfoUrl = `${CANVAS_BASE_URL}/api/v1/files/${fileId}`;
    const fileInfoResponse = await fetch(fileInfoUrl, {
      headers: {
        'Authorization': `Bearer ${CANVAS_ACCESS_TOKEN}`
      }
    });

    if (!fileInfoResponse.ok) {
      return res.status(fileInfoResponse.status).json({ error: 'File not found or access denied' });
    }

    const fileInfo = await fileInfoResponse.json();
    const contentType = fileInfo['content-type'] || 'application/octet-stream';
    const filename = fileInfo.display_name || fileInfo.filename || 'file';

    // Use Canvas file download URL - this gives us the actual binary file
    // Canvas provides a pre-authenticated URL in the file info, or we construct it
    let fileUrl = fileInfo.url;
    
    // If fileInfo.url exists and includes access_token, use it directly
    // Otherwise, construct the download URL with our token
    if (!fileUrl || (!fileUrl.includes('access_token') && !fileUrl.includes(CANVAS_BASE_URL))) {
      // Construct download URL with access token
      fileUrl = `${CANVAS_BASE_URL}/api/v1/files/${fileId}?download=1`;
    }

    // Fetch the actual file content as binary stream
    const fileResponse = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${CANVAS_ACCESS_TOKEN}`
      }
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text().catch(() => 'Unknown error');
      console.error(`Failed to fetch file ${fileId}: ${fileResponse.status} - ${errorText}`);
      return res.status(fileResponse.status).json({ error: 'Failed to fetch file content' });
    }

    // Set proper headers before streaming
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Copy content length if available
    const contentLength = fileResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Stream the binary file content directly to response
    // node-fetch v2 returns a readable stream in body
    if (fileResponse.body) {
      fileResponse.body.pipe(res);
    } else {
      // Fallback: convert to buffer if body is not a stream
      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    }
  } catch (error) {
    console.error('Error proxying file:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// Get cached data
router.get('/data', async (req, res) => {
  try {
    const cachePath = path.join(__dirname, '../data/cache.json');
    const data = await fs.readFile(cachePath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(404).json({ error: 'No cached data available' });
  }
});

// Get sync status
router.get('/status', async (req, res) => {
  try {
    const cachePath = path.join(__dirname, '../data/cache.json');
    const data = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Check if sync service is actually running
    const syncServiceStatus = getSyncStatus();
    const status = syncServiceStatus.isRunning ? 'active' : 'inactive';
    
    res.json({
      lastSynced: parsed.lastSynced,
      timestamp: parsed.timestamp,
      status: status,
      isRunning: syncServiceStatus.isRunning,
      isSyncing: syncServiceStatus.isSyncing
    });
  } catch (error) {
    // Check if sync service is running even if cache doesn't exist
    const syncServiceStatus = getSyncStatus();
    if (syncServiceStatus.isRunning) {
      res.json({
        status: 'active',
        isRunning: true,
        isSyncing: syncServiceStatus.isSyncing,
        lastSynced: null,
        timestamp: null
      });
    } else {
      res.status(404).json({ 
        error: 'No sync data available',
        status: 'inactive',
        isRunning: false,
        isSyncing: false
      });
    }
  }
});

// Manual sync trigger (for testing)
router.post('/sync', async (req, res) => {
  try {
    const result = await fetchCanvasData();
    res.json({ 
      success: true, 
      message: 'Sync completed',
      timestamp: new Date().toISOString(),
      data: result
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Sync failed', 
      message: error.message 
    });
  }
});

// Configure Canvas credentials
router.post('/configure', async (req, res) => {
  try {
    const { canvasBaseUrl, accessToken } = req.body;

    // Use default Canvas URL if not provided
    const defaultCanvasUrl = 'https://canvas.instructure.com';
    const finalCanvasUrl = canvasBaseUrl || defaultCanvasUrl;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access Token is required' });
    }

    // Write to .env file
    const envPath = path.join(__dirname, '../.env');
    const envContent = `# Canvas API Configuration
CANVAS_BASE_URL=${finalCanvasUrl}
CANVAS_ACCESS_TOKEN=${accessToken}

# Server Configuration
PORT=3001
`;

    await fs.writeFile(envPath, envContent);

    // Update environment variables for current process
    process.env.CANVAS_BASE_URL = finalCanvasUrl;
    process.env.CANVAS_ACCESS_TOKEN = accessToken;

    // Test the connection
    try {
      const testUrl = `${finalCanvasUrl}/api/v1/users/self`;
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status}`);
      }

      const user = await response.json();
      
      // DO NOT clear cache - preserve all courses even when switching tokens
      // Courses are preserved in local storage and never deleted
      console.log('📦 Preserving existing cache data - courses are never deleted');
      
      // Restart sync service with new credentials
      stopSyncService();
      
      // Wait a moment for sync service to fully stop
      await new Promise(resolve => setTimeout(resolve, 100));
      
      startSyncService();
      
      // Trigger immediate sync to get fresh data (wait for it to complete)
      try {
        const { fetchCanvasData } = await import('../services/canvasService.js');
        // Wait for sync to complete before responding
        await fetchCanvasData();
        console.log('✅ Initial sync completed with new token');
      } catch (err) {
        console.error('Error triggering immediate sync:', err);
        // Still return success - sync will happen in background
      }
      
      res.json({ 
        success: true, 
        message: 'Configuration saved successfully',
        user: { name: user.name, email: user.email }
      });
    } catch (error) {
      res.status(400).json({ 
        error: 'Invalid token or Canvas URL',
        message: error.message 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to save configuration', 
      message: error.message 
    });
  }
});

// Check if configured
router.get('/configured', (req, res) => {
  try {
    // Check if env vars are set (simpler check)
    const hasToken = !!(process.env.CANVAS_ACCESS_TOKEN);
    const hasBaseUrl = !!(process.env.CANVAS_BASE_URL);
    const hasSession = !!(process.env.CANVAS_SESSION_ID);
    
    const isConfigured = (hasToken || hasSession) && hasBaseUrl;
    res.json({ configured: isConfigured });
  } catch (error) {
    console.error('Error checking configuration:', error);
    res.json({ configured: false });
  }
});

// Sign out - clear token and cache
router.post('/signout', async (req, res) => {
  try {
    // Clear environment variables
    process.env.CANVAS_ACCESS_TOKEN = '';
    process.env.CANVAS_BASE_URL = '';
    process.env.CANVAS_SESSION_ID = '';

    // Clear .env file
    const envPath = path.join(__dirname, '../.env');
    try {
      await fs.writeFile(envPath, `# Canvas API Configuration
# Token cleared - user signed out

# Server Configuration
PORT=3001
`);
      console.log('🗑️  Cleared token from .env file');
    } catch (err) {
      console.error('Error clearing .env file:', err);
    }

    // DO NOT clear cache - preserve all courses even on sign out
    // Courses are preserved in local storage and never deleted
    // Only clear credentials, but keep course data
    console.log('📦 Preserving cache data on sign out - courses are never deleted');

    // Stop sync service
    const { stopSyncService } = await import('../services/syncService.js');
    stopSyncService();

    res.json({ 
      success: true, 
      message: 'Signed out successfully' 
    });
  } catch (error) {
    console.error('Error signing out:', error);
    res.status(500).json({ 
      error: 'Failed to sign out',
      message: error.message 
    });
  }
});

export default router;

