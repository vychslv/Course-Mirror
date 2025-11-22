import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Dashboard({ data, isLoading, onSignOut }) {
  const navigate = useNavigate()
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const courses = data?.courses || []
  const todos = data?.todos || []
  const announcements = data?.announcements || []
  const userRoles = data?.userRoles || []
  const user = data?.user || {}
  const isProfessor = userRoles.includes('professor')
  const isStudent = userRoles.includes('student')
  
  // Debug: Log all courses including past courses
  useEffect(() => {
    console.log('📚 All courses:', courses.length)
    console.log('📚 Courses list:', courses.map(c => ({ id: c.id, name: c.name, pastCourse: c.pastCourse || c.previousQuarter })))
    const pastCourses = courses.filter(c => c.pastCourse || c.previousQuarter)
    console.log('📚 Past courses:', pastCourses.length, pastCourses.map(c => c.name))
  }, [courses])

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) {
      return
    }

    setIsSigningOut(true)
    try {
      const response = await fetch('/api/canvas/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Clear frontend state
        if (onSignOut) {
          onSignOut()
        }
        // Redirect to login
        navigate('/login', { replace: true })
      } else {
        alert('Failed to sign out. Please try again.')
        setIsSigningOut(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      alert('Failed to sign out. Please try again.')
      setIsSigningOut(false)
    }
  }

  // Select first course by default
  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0])
    }
  }, [courses, selectedCourse])

  if (!data || isLoading) {
    return null // Loading screen is handled by App.jsx
  }

  const currentCourse = selectedCourse || courses[0]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Courses */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Courses</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {courses.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No courses found</div>
          ) : (
            <div className="p-2">
              {courses.map((course, index) => {
                const colorIndex = index % 4
                const isSelected = currentCourse?.id === course.id
                
                const colorClasses = [
                  { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', text: 'text-blue-900', textLight: 'text-blue-700' },
                  { bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', text: 'text-green-900', textLight: 'text-green-700' },
                  { bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500', text: 'text-purple-900', textLight: 'text-purple-700' },
                  { bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', text: 'text-orange-900', textLight: 'text-orange-700' }
                ]
                const color = colorClasses[colorIndex]
                
                return (
                  <div
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
                      isSelected 
                        ? `${color.bg} border-2 ${color.border}` 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color.dot}`}></div>
                      <div className="flex-1">
                        <div className={`font-medium ${isSelected ? color.text : 'text-gray-900'} flex items-center gap-2`}>
                          {course.name}
                          {(course.previousQuarter || course.pastCourse) && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                              Past Course
                            </span>
                          )}
                        </div>
                        {course.course_code && (
                          <div className={`text-xs ${isSelected ? color.textLight : 'text-gray-600'}`}>
                            {course.course_code}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentCourse?.name || 'Dashboard'}
              </h1>
              {currentCourse?.course_code && (
                <p className="text-sm text-blue-600 mt-1">{currentCourse.course_code}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Welcome, <span className="font-medium">{data.user?.name || 'User'}</span></span>
                {isProfessor && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    👨‍🏫 Professor
                  </span>
                )}
                {isStudent && !isProfessor && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    🎓 Student
                  </span>
                )}
                {isProfessor && isStudent && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    👨‍🏫🎓 Both
                  </span>
                )}
              </div>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed flex items-center gap-2"
                title="Sign out"
              >
                {isSigningOut ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing out...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        {currentCourse && (
          <div className="bg-white border-b border-gray-200 px-6">
            <div className="flex gap-6">
              <Link
                to="/"
                className="px-4 py-3 border-b-2 border-blue-600 text-blue-600 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </Link>
              <Link
                to="/announcements"
                className="px-4 py-3 text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Announcements
              </Link>
              <Link
                to="/assignments"
                className="px-4 py-3 text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Assignments
              </Link>
              <Link
                to="/modules"
                className="px-4 py-3 text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Modules
              </Link>
              <Link
                to="/syllabus"
                className="px-4 py-3 text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Syllabus
              </Link>
              {isProfessor && (
                <Link
                  to="/students"
                  className="px-4 py-3 text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Students
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentCourse ? (
            <div className="max-w-4xl mx-auto">
              {/* Welcome Section */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Course Home</h2>
                <p className="text-blue-600 mb-6">
                  Welcome to {currentCourse.name}! This is your course home page where you can find important information and quick links.
                </p>

                {/* Quick Links Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link
                    to="/modules"
                    className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex flex-col items-center text-center">
                      <svg className="w-12 h-12 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <h3 className="font-semibold text-gray-900 mb-1">Course Modules</h3>
                      <p className="text-sm text-blue-600">Access all course content</p>
                    </div>
                  </Link>

                  <Link
                    to="/assignments"
                    className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex flex-col items-center text-center">
                      <svg className="w-12 h-12 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="font-semibold text-gray-900 mb-1">Assignments</h3>
                      <p className="text-sm text-blue-600">View all assignments</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-2xl font-bold text-blue-600">{currentCourse.assignments?.length || 0}</div>
                  <div className="text-sm text-gray-600 mt-1">Assignments</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-2xl font-bold text-green-600">{currentCourse.modules?.length || 0}</div>
                  <div className="text-sm text-gray-600 mt-1">Modules</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-2xl font-bold text-orange-600">{todos.length}</div>
                  <div className="text-sm text-gray-600 mt-1">To-Do Items</div>
                </div>
              </div>

              {/* Recent Announcements */}
              {announcements.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Announcements</h3>
                  <div className="space-y-3">
                    {announcements.slice(0, 3).map((announcement, index) => (
                      <div key={announcement.id || index} className="border-l-4 border-blue-500 pl-4 py-2">
                        <h4 className="font-medium text-gray-900">{announcement.title || 'Announcement'}</h4>
                        {announcement.posted_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(announcement.posted_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">No courses available</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
