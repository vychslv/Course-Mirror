export default function FileLink({ file, fileIndex, className = '', showIcon = true }) {
  const isImage = file.content_type?.startsWith('image/')
  const isPdf = file.content_type === 'application/pdf'
  const fileSize = file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 ${className}`}
    >
      {showIcon && (
        <div className="flex-shrink-0">
          {isImage && file.thumbnail_url ? (
            <img 
              src={file.thumbnail_url} 
              alt={file.display_name}
              className="w-12 h-12 object-cover rounded"
            />
          ) : isPdf ? (
            <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
              <svg className="w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {file.display_name || file.filename}
        </div>
        {fileSize && (
          <div className="text-xs text-gray-500">{fileSize}</div>
        )}
      </div>
      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

