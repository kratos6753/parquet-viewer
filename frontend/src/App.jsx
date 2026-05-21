import { useState } from 'react'
import FileUpload from './components/FileUpload'
import DataTable from './components/DataTable'

export default function App() {
  const [fileInfo, setFileInfo] = useState(null)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Parquet Viewer</h1>
          <p className="text-slate-400 text-xs mt-0.5">Upload and explore Parquet files in your browser</p>
        </div>
        {fileInfo && (
          <button
            onClick={() => setFileInfo(null)}
            className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded transition-colors"
          >
            ↑ Upload New File
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col">
        {!fileInfo ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <FileUpload onUpload={setFileInfo} />
          </div>
        ) : (
          <DataTable fileInfo={fileInfo} />
        )}
      </main>
    </div>
  )
}
