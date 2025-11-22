import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Setup({ onConfigured, onTokenConfigured }) {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showTokenHelp, setShowTokenHelp] = useState(false)
  
  const canvasUrl = 'https://canvas.instructure.com' // Default Canvas URL

  const handleTokenSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/canvas/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          canvasBaseUrl: canvasUrl,
          accessToken: accessToken
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        
        // Trigger immediate data fetch with loading screen FIRST
        if (onTokenConfigured) {
          onTokenConfigured()
        }
        
        // Wait a moment for loading state to be set, then configure and navigate
        setTimeout(() => {
          if (onConfigured) onConfigured()
          navigate('/', { replace: true })
        }, 200)
      } else {
        setError(data.error || data.message || 'Failed to configure Canvas token')
      }
    } catch (err) {
      setError('Failed to connect to backend. Make sure the backend server is running.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">CourseMirror</h1>
        <p className="text-center text-gray-600 mb-6">Connect to Canvas to sync your courses</p>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            ✅ Configuration saved! Redirecting...
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleTokenSubmit} className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700">
                Canvas Access Token
              </label>
              <button
                type="button"
                onClick={() => setShowTokenHelp(!showTokenHelp)}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="How to get your Canvas access token"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            
            {showTokenHelp && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  How to Get Your Canvas Access Token
                </h3>
                <ol className="text-xs text-blue-800 space-y-2 list-decimal list-inside">
                  <li>Log in to your Canvas account</li>
                  <li>Click on your profile picture/icon in the top left corner</li>
                  <li>Select <strong>"Settings"</strong> from the dropdown menu</li>
                  <li>Scroll down to the <strong>"Approved Integrations"</strong> section</li>
                  <li>Click <strong>"+ New Access Token"</strong> button</li>
                  <li>Enter a description (e.g., "CourseMirror App")</li>
                  <li>Set an expiration date (optional, or leave blank for no expiration)</li>
                  <li>Click <strong>"Generate Token"</strong></li>
                  <li><strong>Copy the token immediately</strong> - you won't be able to see it again!</li>
                  <li>Paste the token into the field above</li>
                </ol>
              </div>
            )}
            
            <input
              type="text"
              id="accessToken"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste your Canvas access token here"
              className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Get your token from Canvas → Settings → Approved Integrations → New Access Token
            </p>
            <p className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded">
              ✅ Your token is stored securely and used only to sync your Canvas courses.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !accessToken}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed text-lg"
          >
            {isSubmitting ? 'Connecting...' : 'Connect to Canvas'}
          </button>
        </form>
      </div>
    </div>
  )
}
