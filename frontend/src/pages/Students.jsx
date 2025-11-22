import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Students({ data, isLoading }) {
  const [selectedCourse, setSelectedCourse] = useState(null)

  const courses = data?.courses || []
  const userRoles = data?.userRoles || []
  const isProfessor = userRoles.includes('professor')

  // Filter courses where user is a teacher
  const teacherCourses = courses.filter(c => c.isTeacher)

  useEffect(() => {
    if (teacherCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(teacherCourses[0])
    }
  }, [teacherCourses, selectedCourse])

  if (!data || isLoading) {
    return null // Loading screen is handled by App.jsx
  }

  if (!isProfessor) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-2">Access Restricted</div>
          <div className="text-gray-400 text-sm">Only professors can view student information.</div>
        </div>
      </div>
    )
  }

  const selectedCourseStudents = selectedCourse?.students || []

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">My Courses</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {teacherCourses.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No teaching courses found</div>
          ) : (
            teacherCourses.map((course, index) => {
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
                      <div className={`text-xs ${isSelected ? color.textLight : 'text-gray-500'} mt-1`}>
                        {course.students?.length || 0} students
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
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
              <h1 className="text-2xl font-bold text-gray-900">Students</h1>
              {selectedCourse && (
                <p className="text-sm text-blue-600 mt-1">{selectedCourse.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {!selectedCourse ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                Select a course to view students
              </div>
            ) : selectedCourseStudents.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                No students enrolled in {selectedCourse.name}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedCourseStudents.length} Student{selectedCourseStudents.length !== 1 ? 's' : ''}
                    </h2>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Login ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedCourseStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {student.avatar_url ? (
                                <img
                                  className="h-10 w-10 rounded-full mr-3"
                                  src={student.avatar_url}
                                  alt={student.name}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                  <span className="text-blue-600 font-medium text-sm">
                                    {student.name?.charAt(0)?.toUpperCase() || '?'}
                                  </span>
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                {student.sortable_name && student.sortable_name !== student.name && (
                                  <div className="text-xs text-gray-500">{student.sortable_name}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{student.email || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              student.enrollment_state === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {student.enrollment_state || 'active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.last_activity_at 
                              ? new Date(student.last_activity_at).toLocaleDateString()
                              : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

