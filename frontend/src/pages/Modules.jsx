import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import FileLink from '../components/FileLink'

export default function Modules({ data, isLoading }) {
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

  const selectedCourseModules = selectedCourse?.modules || []

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
              <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
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
                Select a course to view modules
              </div>
            ) : selectedCourseModules.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                No modules found for {selectedCourse.name}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedCourseModules.map((module) => (
                  <div key={module.id} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {module.name}
                      </h3>
                      {module.items_count !== undefined && (
                        <span className="text-sm text-gray-600">
                          {module.items_count} item{module.items_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {module.items && module.items.length > 0 && (
                      <div className="space-y-2 mt-4">
                        {module.items.map((item, itemIndex) => {
                          const isFile = item.type === 'File' && item.file;
                          const isImage = isFile && item.file.content_type?.startsWith('image/');
                          const isPdf = isFile && item.file.content_type === 'application/pdf';
                          const fileSize = isFile && item.file.size ? `${(item.file.size / 1024).toFixed(1)} KB` : '';
                          
                          return (
                            <div
                              key={item.id || itemIndex}
                              className={`flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${
                                isFile ? 'border border-gray-200' : ''
                              }`}
                            >
                              {isFile ? (
                                <FileLink
                                  file={item.file}
                                  fileIndex={itemIndex}
                                  className="flex-1"
                                />
                              ) : (
                                <>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {item.title || 'Untitled Item'}
                                      </span>
                                      {item.type && (
                                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                          {item.type}
                                        </span>
                                      )}
                                    </div>
                                    {item.url && (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline mt-1 block"
                                      >
                                        {item.url}
                                      </a>
                                    )}
                                  </div>
                                  {item.completion_requirement && (
                                    <div className="text-xs text-gray-500">
                                      {item.completion_requirement.type === 'must_view' && 'Must View'}
                                      {item.completion_requirement.type === 'must_submit' && 'Must Submit'}
                                      {item.completion_requirement.type === 'must_contribute' && 'Must Contribute'}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
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
