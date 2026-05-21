import { useState, useRef, useCallback } from 'react'

const MAX_SIZE = 200 * 1024 * 1024

export default function FileUpload({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const upload = useCallback((file) => {
    setError(null)

    if (!file.name.toLowerCase().endsWith('.parquet')) {
      setError('Only .parquet files are supported.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('File exceeds the 200 MB limit.')
      return
    }

    setUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status === 200) {
        onUpload(JSON.parse(xhr.responseText))
      } else {
        let msg = 'Upload failed.'
        try { msg = JSON.parse(xhr.responseText).detail || msg } catch (_) {}
        setError(msg)
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setError('Network error — could not reach the server.')
    }
    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }, [onUpload])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [upload])

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)
  const onInputChange = (e) => { if (e.target.files[0]) upload(e.target.files[0]) }

  return (
    <div className="w-full max-w-xl">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'}
          ${uploading ? 'cursor-not-allowed opacity-80' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".parquet"
          className="hidden"
          onChange={onInputChange}
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 font-medium">Uploading… {progress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 font-semibold text-lg">
                {isDragging ? 'Drop it here' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-gray-400 text-sm mt-1">Parquet files only · up to 200 MB</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}
