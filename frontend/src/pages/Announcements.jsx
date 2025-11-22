import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import FileLink from '../components/FileLink'

export default function Announcements({ data, isLoading }) {
  const [selectedCourse, setSelectedCourse] = useState(null)

  const courses = data?.courses || []
  const announcements = data?.announcements || []
  
  // Debug: Log announcements
  useEffect(() => {
    console.log('Announcements data:', announcements)
    console.log('Announcements count:', announcements.length)
  }, [announcements])
  
  // Filter announcements by selected course if any
  // Try multiple ways to match announcements to courses
  const filteredAnnouncements = selectedCourse 
    ? announcements.filter(a => {
        // Check if announcement belongs to selected course
        const contextName = a.context_name || '';
        const courseName = selectedCourse.name || '';
        const courseId = selectedCourse.id;
        const contextCode = a.context_code || '';
        
        return contextName.includes(courseName) || 
               contextCode.includes(`course_${courseId}`) ||
               a.course_id === courseId ||
               (a.context_code && a.context_code === `course_${courseId}`);
      })
    : announcements

  // Don't auto-select a course - let user choose "All Courses" or specific course
  // useEffect(() => {
  //   if (courses.length > 0 && !selectedCourse) {
  //     setSelectedCourse(courses[0])
  //   }
  // }, [courses, selectedCourse])

  if (!data || isLoading) {
    return null // Loading screen is handled by App.jsx
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Courses</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div
            onClick={() => setSelectedCourse(null)}
            className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
              !selectedCourse ? 'bg-blue-50 border-2 border-blue-200' : 'hover:bg-gray-50'
            }`}
          >
            <div className="font-medium text-gray-900">All Courses</div>
            <div className="text-xs text-gray-600">View all announcements</div>
          </div>
          {courses.map((course, index) => {
            const colorIndex = index % 4
            const isSelected = selectedCourse?.id === course.id
            
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
                  isSelected ? `${color.bg} border-2 ${color.border}` : 'hover:bg-gray-50'
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
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
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
                <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
                {selectedCourse && (
                  <p className="text-sm text-blue-600 mt-1">{selectedCourse.name}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {announcements.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                <p className="mb-2">No announcements found</p>
                <p className="text-xs text-gray-400">Announcements will appear here once they are synced from Canvas.</p>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                <p className="mb-2">No announcements found for {selectedCourse?.name || 'selected course'}</p>
                <p className="text-xs text-gray-400">Try selecting "All Courses" to see all announcements.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Showing {filteredAnnouncements.length} of {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
                </div>
                {filteredAnnouncements.map((announcement, index) => (
                  <div key={announcement.id || `ann-${index}`} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 flex-1">
                        {announcement.title || announcement.name || 'Untitled Announcement'}
                      </h3>
                      {(announcement.posted_at || announcement.created_at) && (
                        <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                          {new Date(announcement.posted_at || announcement.created_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    {(announcement.message || announcement.body) && (
                      <div 
                        className="text-gray-700 mt-3 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: announcement.message || announcement.body }}
                      />
                    )}

                    {/* Display attached files */}
                    {announcement.files && announcement.files.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Attachments ({announcement.files.length}):</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {announcement.files.map((file, fileIndex) => (
                            <FileLink
                              key={file.id || fileIndex}
                              file={file}
                              fileIndex={fileIndex}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {(announcement.context_name || announcement.context_code) && (
                      <div className="mt-4 flex items-center gap-2">
                        <span className="inline-block px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {announcement.context_name || announcement.context_code}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
