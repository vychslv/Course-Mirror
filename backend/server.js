import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import canvasRoutes from './routes/canvas.js';
import oauthRoutes from './routes/oauth.js';
import loginRoutes from './routes/login.js';
import { startSyncService } from './services/syncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug: Check if env vars are loaded
console.log('🔍 Environment check:');
console.log('  CANVAS_BASE_URL:', process.env.CANVAS_BASE_URL ? '✅ Set' : '❌ Missing');
console.log('  CANVAS_ACCESS_TOKEN:', process.env.CANVAS_ACCESS_TOKEN ? '✅ Set (hidden)' : '❌ Missing');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/canvas', canvasRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/login', loginRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Canvas Live Mirror Backend running on http://localhost:${PORT}`);
  
  // Start sync service
  if (process.env.CANVAS_ACCESS_TOKEN && process.env.CANVAS_BASE_URL) {
    console.log('🔄 Starting sync service...');
    startSyncService();
  } else {
    console.log('⚠️  Canvas credentials not found. Sync service will start when token is configured.');
  }
});

