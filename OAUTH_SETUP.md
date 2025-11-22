# OAuth2 Setup Guide for Canvas Live Mirror

## What is OAuth2?

OAuth2 allows users to "Login with Canvas" - they click a button, log into Canvas, and the app gets access. No need to manually copy tokens!

## Requirements

To use OAuth2, you need:
1. **Canvas Admin Access** OR ability to create Developer Keys
2. Your Canvas instance URL

## Step-by-Step Setup

### 1. Create a Canvas Developer Key

1. Log into your Canvas instance as an admin
2. Go to: **Admin** → **Developer Keys** (or visit: `https://YOUR-CANVAS.instructure.com/accounts/self/developer_keys`)
3. Click **"+ Developer Key"** → **"+ API Key"**
4. Fill in:
   - **Key Name**: "Canvas Live Mirror"
   - **Redirect URI**: `http://localhost:3001/api/oauth/callback`
     - For production, use your actual domain
   - **Scopes**: Select these scopes:
     - `url:GET|/api/v1/courses`
     - `url:GET|/api/v1/assignments`
     - `url:GET|/api/v1/announcements`
     - `url:GET|/api/v1/users/self/todo`
5. Click **Save**
6. **Copy the Client ID and Client Secret** (you'll need these!)

### 2. Configure Backend

Add to `backend/.env`:

```env
CANVAS_BASE_URL=https://YOUR-CANVAS.instructure.com
CANVAS_CLIENT_ID=your_client_id_here
CANVAS_CLIENT_SECRET=your_client_secret_here
PORT=3001
```

### 3. Restart Backend

```powershell
cd backend
npm run dev
```

### 4. Use OAuth Login

1. Open `http://localhost:3000`
2. Click **"Login with Canvas (OAuth2)"**
3. You'll be redirected to Canvas login
4. Log in with your Canvas credentials
5. Authorize the app
6. You'll be redirected back and connected!

## Troubleshooting

### "OAuth2 Setup Required" page appears
- Make sure `CANVAS_CLIENT_ID` is set in `.env`
- Restart the backend server

### "Invalid redirect_uri" error
- Make sure the redirect URI in Canvas matches exactly: `http://localhost:3001/api/oauth/callback`
- No trailing slashes!

### "Client authentication failed"
- Check that `CANVAS_CLIENT_SECRET` is correct in `.env`
- Restart backend after changing `.env`

### Can't access Developer Keys
- You need admin access to your Canvas instance
- Contact your Canvas administrator
- For hackathons, you might need to use the token method instead

## For Hackathons

**If you don't have admin access:**
- Use the **Access Token method** instead (the "OR" option on the setup page)
- It's simpler and doesn't require Canvas admin access
- Just as secure for read-only access

## Security Notes

- Never commit `.env` file (it contains secrets)
- OAuth2 is more secure than tokens for production apps
- Tokens are fine for personal/hackathon use

