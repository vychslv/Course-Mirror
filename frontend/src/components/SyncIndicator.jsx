import { useState, useEffect } from 'react'

export default function SyncIndicator({ syncStatus }) {
  const [timeAgo, setTimeAgo] = useState('')

  useEffect(() => {
    if (!syncStatus?.lastSynced) return

    const updateTimeAgo = () => {
      const lastSynced = new Date(syncStatus.lastSynced)
      const now = new Date()
      const diffSeconds = Math.floor((now - lastSynced) / 1000)

      if (diffSeconds < 60) {
        setTimeAgo(`${diffSeconds} seconds ago`)
      } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60)
        setTimeAgo(`${minutes} minute${minutes !== 1 ? 's' : ''} ago`)
      } else {
        const hours = Math.floor(diffSeconds / 3600)
        setTimeAgo(`${hours} hour${hours !== 1 ? 's' : ''} ago`)
      }
    }

    updateTimeAgo()
    const interval = setInterval(updateTimeAgo, 1000)

    return () => clearInterval(interval)
  }, [syncStatus])

  if (!syncStatus) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <div className="container mx-auto text-sm text-yellow-800">
          ⚠️ Waiting for sync data...
        </div>
      </div>
    )
  }

  const lastSyncedTime = syncStatus.lastSynced
    ? new Date(syncStatus.lastSynced).toLocaleTimeString()
    : 'N/A'

  return (
    <div className="bg-green-50 border-b border-green-200 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2 text-green-800">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span>Last Synced: {timeAgo || 'Just now'}</span>
          <span className="text-green-600">({lastSyncedTime})</span>
        </div>
        <div className="text-green-600">
          Syncing every 5 seconds
        </div>
      </div>
    </div>
  )
}

