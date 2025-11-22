import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// OAuth2 configuration
// Note: For Canvas OAuth2, you need to register an app in Canvas
// This is a simplified version that shows the flow

router.get('/authorize', (req, res) => {
  const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
  const CLIENT_ID = process.env.CANVAS_CLIENT_ID;
  
  // Determine redirect URI - use localhost for development
  const isProduction = process.env.NODE_ENV === 'production';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3001';
  const REDIRECT_URI = `${protocol}://${host}/api/oauth/callback`;
  
  if (!CLIENT_ID) {
    // Return HTML page explaining how to set up OAuth
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>OAuth Setup Required</title></head>
        <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>OAuth2 Setup Required</h1>
          <p>To use OAuth2 login, you need to:</p>
          <ol>
            <li>Go to your Canvas instance: <a href="${CANVAS_BASE_URL}/accounts/self/developer_keys" target="_blank">Developer Keys</a></li>
            <li>Click "Developer Key" → "API Key"</li>
            <li>Set Redirect URI to: <code>${REDIRECT_URI}</code></li>
            <li>Copy the Client ID and Client Secret</li>
            <li>Add them to your <code>backend/.env</code> file:
              <pre>CANVAS_CLIENT_ID=your_client_id
CANVAS_CLIENT_SECRET=your_client_secret</pre>
            </li>
            <li>Restart the backend server</li>
          </ol>
          <p><a href="/">← Back to Setup</a></p>
        </body>
      </html>
    `);
  }

  const authUrl = `${CANVAS_BASE_URL}/login/oauth2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=url:GET|/api/v1/courses url:GET|/api/v1/assignments url:GET|/api/v1/announcements url:GET|/api/v1/users/self/todo url:GET|/api/v1/announcements`;
  
  console.log(`🔐 OAuth redirect to: ${authUrl}`);
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
  const CLIENT_ID = process.env.CANVAS_CLIENT_ID;
  const CLIENT_SECRET = process.env.CANVAS_CLIENT_SECRET;
  
  // Determine redirect URI - must match the one used in authorize
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3001';
  const REDIRECT_URI = `${protocol}://${host}/api/oauth/callback`;

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>OAuth Error</h1>
          <p>Error: ${error}</p>
          <p><a href="http://localhost:3000">← Back to Setup</a></p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.redirect('http://localhost:3000?error=no_code');
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>OAuth Not Configured</title></head>
        <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>OAuth Not Configured</h1>
          <p>Please set CANVAS_CLIENT_ID and CANVAS_CLIENT_SECRET in your .env file.</p>
          <p><a href="http://localhost:3000">← Back to Setup</a></p>
        </body>
      </html>
    `);
  }

  try {
    console.log('🔄 Exchanging OAuth code for token...');
    
    // Exchange code for token
    const tokenResponse = await fetch(`${CANVAS_BASE_URL}/login/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ OAuth token exchange failed:', errorText);
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>OAuth Error</title></head>
          <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1>OAuth Token Exchange Failed</h1>
            <p>Error: ${errorText}</p>
            <p><a href="http://localhost:3000">← Back to Setup</a></p>
          </body>
        </html>
      `);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.access_token) {
      console.log('✅ OAuth token received successfully');
      
      // Save token to .env
      const envPath = path.join(__dirname, '../.env');
      let envContent = `# Canvas API Configuration
CANVAS_BASE_URL=${CANVAS_BASE_URL}
CANVAS_ACCESS_TOKEN=${tokenData.access_token}
`;

      // Preserve OAuth credentials if they exist
      if (CLIENT_ID) {
        envContent += `CANVAS_CLIENT_ID=${CLIENT_ID}\n`;
      }
      if (CLIENT_SECRET) {
        envContent += `CANVAS_CLIENT_SECRET=${CLIENT_SECRET}\n`;
      }
      
      envContent += `\n# Server Configuration\nPORT=3001\n`;

      await fs.writeFile(envPath, envContent);
      
      // Update process env
      process.env.CANVAS_ACCESS_TOKEN = tokenData.access_token;
      process.env.CANVAS_BASE_URL = CANVAS_BASE_URL;

      // Restart sync service
      const { stopSyncService, startSyncService } = await import('../services/syncService.js');
      stopSyncService();
      startSyncService();

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Success!</title>
            <meta http-equiv="refresh" content="2;url=http://localhost:3000">
          </head>
          <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto; text-align: center;">
            <h1>✅ Successfully Connected!</h1>
            <p>Your Canvas account has been connected via OAuth2.</p>
            <p>Redirecting to dashboard...</p>
            <p><a href="http://localhost:3000">Click here if not redirected</a></p>
          </body>
        </html>
      `);
    } else {
      console.error('❌ No access token in response:', tokenData);
      res.redirect('http://localhost:3000?error=token_failed');
    }
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>OAuth Error</h1>
          <p>Error: ${error.message}</p>
          <p><a href="http://localhost:3000">← Back to Setup</a></p>
        </body>
      </html>
    `);
  }
});

export default router;

