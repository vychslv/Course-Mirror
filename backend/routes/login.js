import express from 'express';
import { loginWithPassword, canvasRequestWithSession } from '../services/canvasLoginService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { stopSyncService, startSyncService } from '../services/syncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Store active sessions (in production, use Redis or database)
const activeSessions = new Map();

// Redirect to Canvas login page
router.get('/canvas-redirect', (req, res) => {
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
  
  // Store the return URL in a cookie or session for later
  const returnUrl = `http://localhost:3000?canvas_login=true`;
  
  // Redirect directly to Canvas login
  // After login, Canvas will redirect to dashboard, but we'll intercept
  const loginUrl = `${canvasUrl}/login/canvas`;
  
  console.log('🔄 Redirecting to Canvas login page');
  console.log(`📍 Canvas URL: ${loginUrl}`);
  console.log(`📍 Will return to: ${returnUrl}`);
  
  // Set a cookie to track that we're doing Canvas redirect login
  res.cookie('canvas_redirect_login', 'true', { maxAge: 300000 }); // 5 minutes
  res.redirect(loginUrl);
});

// Check if user logged into Canvas (called from frontend after redirect)
router.get('/check-canvas-session', async (req, res) => {
  try {
    const canvasUrl = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
    
    // This endpoint is called from frontend after user returns from Canvas
    // We can't access Canvas cookies directly due to CORS, so we'll need
    // the user to provide credentials or use OAuth2
    
    res.json({ 
      message: 'Please use the email/password form below to complete login',
      requiresCredentials: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login with email and password
router.post('/login', async (req, res) => {
  try {
    // Accept both 'uniqueId' (from frontend) and 'email' (for compatibility)
    const { uniqueId, email, password, canvasUrl } = req.body;
    // 'uniqueId' or 'email' can actually be username, email, or student ID - Canvas accepts all
    const loginIdentifier = uniqueId || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ 
        error: 'Username/Email/Student ID and password are required' 
      });
    }

    const baseUrl = canvasUrl || process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
    
    console.log(`🔐 Attempting login with: ${loginIdentifier.substring(0, 3)}*** (username/email/student ID)`);
    
    // Attempt login - Canvas accepts username, email, or student ID
    const loginResult = await loginWithPassword(baseUrl, loginIdentifier, password);
    
    if (loginResult.success) {
      // Generate a session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store session
      activeSessions.set(sessionId, {
        user: loginResult.user,
        cookies: loginResult.cookies,
        canvasUrl: baseUrl,
        createdAt: new Date()
      });
      
      // Save session info for sync service
      const envPath = path.join(__dirname, '../.env');
      const envContent = `# Canvas API Configuration (Password-based login)
CANVAS_BASE_URL=${baseUrl}
CANVAS_ACCESS_TOKEN=session_${sessionId}
CANVAS_SESSION_ID=${sessionId}

# Server Configuration
PORT=3001
`;

      await fs.writeFile(envPath, envContent);
      
      // Update process env
      process.env.CANVAS_BASE_URL = baseUrl;
      process.env.CANVAS_SESSION_ID = sessionId;
      process.env.CANVAS_ACCESS_TOKEN = `session_${sessionId}`;
      
      // Restart sync service
      stopSyncService();
      startSyncService();
      
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          name: loginResult.user.name,
          email: loginResult.user.email || loginIdentifier,
          login: loginIdentifier // Store what they used to login (username/email/student ID)
        },
        sessionId: sessionId
      });
    } else {
      res.status(401).json({
        error: 'Login failed',
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = error.message || 'Invalid email or password';
    
    // Provide more helpful error messages
    let userMessage = errorMessage;
    if (errorMessage.includes('CSRF token')) {
      userMessage = 'Canvas login method not supported. Please use an access token instead. Go to Canvas Settings → Approved Integrations to create one.';
    } else if (errorMessage.includes('API access failed')) {
      userMessage = 'Login successful but API access denied. Your Canvas instance may require using an access token instead of password login.';
    }
    
    res.status(401).json({
      error: 'Login failed',
      message: userMessage,
      details: errorMessage
    });
  }
});

// Get session info
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (session) {
    res.json({
      valid: true,
      user: session.user,
      createdAt: session.createdAt
    });
  } else {
    res.status(404).json({ valid: false });
  }
});

export { activeSessions };
export default router;
