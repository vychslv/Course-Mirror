import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Syllabus({ data, isLoading }) {
  const [selectedCourse, setSelectedCourse] = useState(null)

  const courses = data?.courses || []

  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0])
    }
  }, [courses, selectedCourse])

  if (!data || isLoading) {
    return null // Loading screen is handled by App.jsx
  }

  const selectedCourseSyllabus = selectedCourse?.syllabus || null

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Courses</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
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
                    <div className={`font-medium ${isSelected ? color.text : 'text-gray-900'}`}>
                      {course.name}
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
              <h1 className="text-2xl font-bold text-gray-900">Syllabus</h1>
              {selectedCourse && (
                <p className="text-sm text-blue-600 mt-1">{selectedCourse.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {!selectedCourse ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                Select a course to view syllabus
              </div>
            ) : !selectedCourseSyllabus ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                No syllabus available for {selectedCourse.name}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div 
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedCourseSyllabus }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

