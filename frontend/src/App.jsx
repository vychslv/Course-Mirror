import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import LoadingScreen from './components/LoadingScreen'
import Dashboard from './pages/Dashboard'
import Announcements from './pages/Announcements'
import Assignments from './pages/Assignments'
import Modules from './pages/Modules'
import Syllabus from './pages/Syllabus'
import Students from './pages/Students'
import Setup from './pages/Setup'
import ProtectedRoute from './components/ProtectedRoute'

// Component to handle routes
function AppRoutes({ isConfigured, syncStatus, canvasData, setIsConfigured, triggerRefresh, isLoading, handleSignOut }) {
  return (
    <Routes>
      {/* Login/Setup route - always accessible, shows login form */}
      <Route 
        path="/login" 
        element={
          isConfigured ? (
            <Navigate to="/" replace />
          ) : (
            <Setup 
              onConfigured={() => {
                setIsConfigured(true)
                // Trigger will be handled by the Setup component
              }}
              onTokenConfigured={triggerRefresh}
            />
          )
        } 
      />
      
      {/* Protected routes - require login */}
      <Route
        path="/"
        element={
          isConfigured ? (
            <>
              {isLoading && <LoadingScreen message="Loading courses and data..." />}
              <Dashboard data={canvasData} isLoading={isLoading} onSignOut={handleSignOut} />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/announcements"
        element={
          isConfigured ? (
            <>
              {isLoading && <LoadingScreen message="Loading announcements..." />}
              <Announcements data={canvasData} isLoading={isLoading} />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/assignments"
        element={
          isConfigured ? (
            <>
              {isLoading && <LoadingScreen message="Loading assignments..." />}
              <Assignments data={canvasData} isLoading={isLoading} />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/modules"
        element={
          isConfigured ? (
            <>
              {isLoading && <LoadingScreen message="Loading modules..." />}
              <Modules data={canvasData} isLoading={isLoading} />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/syllabus"
        element={
          isConfigured ? (
            <>
              {isLoading && <LoadingScreen message="Loading syllabus..." />}
              <Syllabus data={canvasData} isLoading={isLoading} />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/students"
        element={
          isConfigured ? (
            <>
              {isLoading && <LoadingScreen message="Loading students..." />}
              <Students data={canvasData} isLoading={isLoading} />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      
      {/* Redirect any unknown routes to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  const [syncStatus, setSyncStatus] = useState(null)
  const [canvasData, setCanvasData] = useState(null)
  const [isConfigured, setIsConfigured] = useState(false) // Always start with false - require login
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Trigger to force immediate refresh
  const [isLoading, setIsLoading] = useState(false) // Loading state

  // Note: We don't check for existing configuration on load
  // User must always provide credentials on page reload

  // Function to fetch data
  const fetchData = async (showLoading = false, retryCount = 0) => {
    if (showLoading) {
      setIsLoading(true)
    }
    
    try {
      const response = await fetch('/api/canvas/data')
      if (response.ok) {
        const data = await response.json()
        // Only update if we have actual data (not empty)
        if (data && (data.courses?.length > 0 || data.announcements?.length > 0 || data.todos?.length > 0)) {
          setCanvasData(data)
          setIsLoading(false)
        } else if (showLoading && retryCount < 10) {
          // If loading and no data yet, retry after a short delay
          setTimeout(() => fetchData(showLoading, retryCount + 1), 500)
        } else {
          // No data after retries, still set it (might be empty)
          setCanvasData(data)
          setIsLoading(false)
        }
      } else if (response.status === 404 && showLoading && retryCount < 10) {
        // Cache not found yet, retry
        setTimeout(() => fetchData(showLoading, retryCount + 1), 500)
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      if (showLoading && retryCount < 10) {
        // Retry on error if we're in loading state
        setTimeout(() => fetchData(showLoading, retryCount + 1), 500)
      } else {
        setIsLoading(false)
      }
    }

    try {
      const statusResponse = await fetch('/api/canvas/status')
      if (statusResponse.ok) {
        const status = await statusResponse.json()
        setSyncStatus(status)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  // Function to trigger immediate refresh (called after token configuration)
  const triggerRefresh = () => {
    // Clear existing data immediately and show loading
    setCanvasData(null)
    setSyncStatus(null)
    setIsLoading(true)
    // Increment trigger to force re-fetch
    setRefreshTrigger(prev => prev + 1)
  }

  // Handle sign out
  const handleSignOut = () => {
    // Clear all state
    setCanvasData(null)
    setSyncStatus(null)
    setIsConfigured(false)
    setRefreshTrigger(0)
    setIsLoading(false)
  }

  // Poll for updates every 5 seconds (only if configured)
  useEffect(() => {
    if (!isConfigured) return

    // If refresh was triggered, we're loading new data - show loading screen
    const isRefreshing = refreshTrigger > 0
    const shouldShowLoading = !canvasData || isRefreshing
    
    if (shouldShowLoading) {
      setIsLoading(true)
    }
    
    // Fetch data - if refreshing, keep retrying until we get new data
    fetchData(shouldShowLoading, 0)

    // Set up polling interval (don't show loading for background updates)
    // Only start polling if we have data (not during initial load/refresh)
    let interval = null
    if (canvasData && !isRefreshing) {
      interval = setInterval(() => fetchData(false), 5000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isConfigured, refreshTrigger]) // Also trigger on refreshTrigger change

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <AppRoutes 
          isConfigured={isConfigured}
          syncStatus={syncStatus}
          canvasData={canvasData}
          setIsConfigured={setIsConfigured}
          triggerRefresh={triggerRefresh}
          isLoading={isLoading}
          handleSignOut={handleSignOut}
        />
      </div>
    </Router>
  )
}

export default App

