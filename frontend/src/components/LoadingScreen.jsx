export default function LoadingScreen({ message = "Loading Canvas data..." }) {
  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
        <p className="text-gray-700 text-lg font-medium">{message}</p>
        <p className="text-gray-500 text-sm mt-2">Please wait while we sync your courses...</p>
      </div>
    </div>
  )
}

