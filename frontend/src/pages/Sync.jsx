import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Sync({ data, isLoading }) {
  const [syncStatus, setSyncStatus] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [syncHistory, setSyncHistory] = useState([])

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/canvas/status')
      if (response.ok) {
        const status = await response.json()
        setSyncStatus(status)
        if (status.lastSynced) {
          setLastSyncTime(new Date(status.lastSynced))
        }
      }
    } catch (error) {
      console.error('Error fetching sync status:', error)
    }
  }

  // Manual sync trigger
  const triggerManualSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        setSyncHistory(prev => [{
          timestamp: new Date(),
          status: 'success',
          message: result.message || 'Sync completed successfully'
        }, ...prev.slice(0, 9)]) // Keep last 10 syncs
        
        // Refresh status after sync
        setTimeout(() => {
          fetchSyncStatus()
          setIsSyncing(false)
        }, 1000)
      } else {
        const error = await response.json()
        setSyncHistory(prev => [{
          timestamp: new Date(),
          status: 'error',
          message: error.message || 'Sync failed'
        }, ...prev.slice(0, 9)])
        setIsSyncing(false)
      }
    } catch (error) {
      console.error('Error triggering sync:', error)
      setSyncHistory(prev => [{
        timestamp: new Date(),
        status: 'error',
        message: 'Failed to trigger sync. Please try again.'
      }, ...prev.slice(0, 9)])
      setIsSyncing(false)
    }
  }

  // Poll for sync status updates
  useEffect(() => {
    fetchSyncStatus()
    const interval = setInterval(fetchSyncStatus, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const formatTime = (date) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleString()
  }

  const getTimeAgo = (date) => {
    if (!date) return 'Never'
    const now = new Date()
    const diff = now - new Date(date)
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (seconds < 60) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    return formatTime(date)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Sync</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <Link
            to="/"
            className="p-3 rounded-lg mb-2 hover:bg-gray-50 transition-colors block"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <div className="font-medium text-gray-900">Back to Dashboard</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
              title="Back to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Canvas Synchronization</h1>
              <p className="text-sm text-gray-600 mt-1">Monitor and control Canvas data synchronization</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Sync Status Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Sync Status</h2>
                <button
                  onClick={triggerManualSync}
                  disabled={isSyncing}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isSyncing
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync Now
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="text-lg font-semibold text-gray-900 flex items-center gap-2 mt-1">
                      {syncStatus?.status === 'active' ? (
                        <>
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          Active
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                          Inactive
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Last Sync</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">
                      {formatTime(lastSyncTime)}
                    </div>
                    {lastSyncTime && (
                      <div className="text-xs text-gray-500 mt-1">
                        {getTimeAgo(lastSyncTime)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-800">
                    <strong>Auto-sync:</strong> Canvas data is automatically synchronized every 5 seconds in the background.
                  </div>
                </div>
              </div>
            </div>

            {/* Sync History */}
            {syncHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync History</h2>
                <div className="space-y-2">
                  {syncHistory.map((sync, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg flex items-center justify-between ${
                        sync.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {sync.status === 'success' ? (
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <div>
                          <div className={`font-medium ${
                            sync.status === 'success' ? 'text-green-900' : 'text-red-900'
                          }`}>
                            {sync.message}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {sync.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Summary */}
            {data && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Synced Data Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{data.courses?.length || 0}</div>
                    <div className="text-sm text-gray-600 mt-1">Courses</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{data.announcements?.length || 0}</div>
                    <div className="text-sm text-gray-600 mt-1">Announcements</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{data.todos?.length || 0}</div>
                    <div className="text-sm text-gray-600 mt-1">To-Do Items</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

