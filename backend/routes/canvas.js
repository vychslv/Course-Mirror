import express from 'express';
import { fetchCanvasData } from '../services/canvasService.js';
import { startSyncService, stopSyncService } from '../services/syncService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Proxy endpoint for Canvas files (with authentication)
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
    const CANVAS_ACCESS_TOKEN = process.env.CANVAS_ACCESS_TOKEN;

    if (!CANVAS_BASE_URL || !CANVAS_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Canvas not configured' });
    }

    // Fetch file from Canvas with authentication
    const fetch = (await import('node-fetch')).default;
    const fileUrl = `${CANVAS_BASE_URL}/api/v1/files/${fileId}?download=1`;
    const response = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${CANVAS_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'File not found' });
    }

    // Get content type and set headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', response.headers.get('content-disposition') || `attachment`);

    // Stream the file
    response.body.pipe(res);
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
    res.json({
      lastSynced: parsed.lastSynced,
      timestamp: parsed.timestamp,
      status: 'active'
    });
  } catch (error) {
    res.status(404).json({ error: 'No sync data available' });
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
      
      // Clear old cache data before switching tokens
      const cachePath = path.join(__dirname, '../data/cache.json');
      try {
        await fs.unlink(cachePath);
        console.log('🗑️  Cleared old cache data');
      } catch (err) {
        // Cache file might not exist, that's okay
        if (err.code !== 'ENOENT') {
          console.error('Error clearing cache:', err);
        }
      }
      
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

    // Clear cache
    const cachePath = path.join(__dirname, '../data/cache.json');
    try {
      await fs.unlink(cachePath);
      console.log('🗑️  Cleared cache data');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Error clearing cache:', err);
      }
    }

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

