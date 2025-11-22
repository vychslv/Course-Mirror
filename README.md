# CourseMirror

A read-only mirror application and cloud for Canvas LMS that syncs course data every 5 seconds. Perfect for hackathons and testing Canvas API integrations.

## 🎯 Purpose

- **READ-ONLY**: This app does NOT modify Canvas. It only fetches data using GET requests.
- **Canvas View**: Mirrors what a student and professors can see in Canvas.
- **No Modifications**: Cannot alter modules, assignments, or submissions.

## 🚀 Quick Start

### 1. Get Your Canvas Access Token

1. Log into Canvas at canvas.instructure.com
2. Go to **Account** → **Settings**
3. Scroll down to **Approved Integrations**
4. Click **+ New Access Token**
5. Copy the generated token

### 2. Backend Setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Edit .env with your Canvas token
npm run dev
```

### 3. Frontend Setup (New Terminal)

```powershell
cd frontend
npm install
npm run dev
```

### 4. Open Browser

Go to: `http://localhost:3000`

## 📁 Project Structure

```
canvas-live-mirror/
├── backend/          # Node.js + Express server
├── frontend/         # React + Vite app
└── README.md
```

## 🔒 Important

- Never commit `.env` file (contains your access token)
- App is READ-ONLY - cannot modify Canvas data
- Syncs every 5 seconds automatically

---

**Built for 2-Day Hackathon** 🚀

