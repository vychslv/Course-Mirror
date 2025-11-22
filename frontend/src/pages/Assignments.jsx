import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Assignments({ data, isLoading }) {
  const [selectedCourse, setSelectedCourse] = useState(null)

  const courses = data?.courses || []
  const allAssignments = courses.flatMap(course => 
    (course.assignments || []).map(assignment => ({
      ...assignment,
      courseName: course.name,
      courseCode: course.course_code
    }))
  )

  // Filter by selected course
  const filteredAssignments = selectedCourse
    ? allAssignments.filter(a => a.courseName === selectedCourse.name)
    : allAssignments

  // Sort by due date
  filteredAssignments.sort((a, b) => {
    const dateA = a.due_at ? new Date(a.due_at) : new Date(0)
    const dateB = b.due_at ? new Date(b.due_at) : new Date(0)
    return dateA - dateB
  })

  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0])
    }
  }, [courses, selectedCourse])

  if (!data || isLoading) {
    return null // Loading screen is handled by App.jsx
  }

  const getDueDateStatus = (dueAt) => {
    if (!dueAt) return { text: 'No due date', color: 'gray' }
    const due = new Date(dueAt)
    const now = new Date()
    const diff = due - now
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: 'Overdue', color: 'red' }
    if (days === 0) return { text: 'Due today', color: 'orange' }
    if (days <= 7) return { text: `Due in ${days} day${days !== 1 ? 's' : ''}`, color: 'yellow' }
    return { text: `Due ${due.toLocaleDateString()}`, color: 'green' }
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
              <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
              {selectedCourse && (
                <p className="text-sm text-blue-600 mt-1">{selectedCourse.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {filteredAssignments.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                No assignments found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAssignments.map((assignment) => {
                  const dueStatus = getDueDateStatus(assignment.due_at)
                  
                  return (
                    <div
                      key={assignment.id}
                      className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {assignment.name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {assignment.courseName}
                            {assignment.courseCode && ` (${assignment.courseCode})`}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          {assignment.due_at && (
                            <div className="text-sm font-medium text-gray-900 mb-1">
                              {new Date(assignment.due_at).toLocaleString()}
                            </div>
                          )}
                          <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                            dueStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                            dueStatus.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                            dueStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {dueStatus.text}
                          </span>
                        </div>
                      </div>

                      {assignment.description && (
                        <div 
                          className="text-gray-700 mt-3 text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: assignment.description.substring(0, 200) + (assignment.description.length > 200 ? '...' : '')
                          }}
                        />
                      )}

                      <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                        {assignment.points_possible && (
                          <span>Points: {assignment.points_possible}</span>
                        )}
                        {assignment.submission_types && assignment.submission_types.length > 0 && (
                          <span>Type: {assignment.submission_types.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
