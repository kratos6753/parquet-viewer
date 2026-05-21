import { useState, useEffect, useCallback } from 'react'
import Pagination from './Pagination'

function typeBadgeClass(type) {
  const t = type.toLowerCase()
  if (/int|uint/.test(t)) return 'bg-blue-100 text-blue-700'
  if (/float|double|decimal/.test(t)) return 'bg-orange-100 text-orange-700'
  if (/string|utf8|large_string/.test(t)) return 'bg-emerald-100 text-emerald-700'
  if (/bool/.test(t)) return 'bg-purple-100 text-purple-700'
  if (/date|timestamp|time/.test(t)) return 'bg-amber-100 text-amber-700'
  if (/binary/.test(t)) return 'bg-rose-100 text-rose-700'
  return 'bg-gray-100 text-gray-500'
}

function isNumericType(type) {
  return /int|uint|float|double|decimal/.test(type.toLowerCase())
}

function CellValue({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-300 select-none">—</span>
  }
  if (typeof value === 'boolean') {
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${value ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
        {value.toString()}
      </span>
    )
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value)
    const truncated = str.length > 60 ? str.slice(0, 60) + '…' : str
    return <span className="font-mono text-xs text-gray-500 cursor-help" title={str}>{truncated}</span>
  }
  const str = String(value)
  if (str.length > 60) {
    return <span className="cursor-help" title={str}>{str.slice(0, 60)}…</span>
  }
  return <>{str}</>
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500]

export default function DataTable({ fileInfo }) {
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [meta, setMeta] = useState({ totalRows: 0, totalPages: 1, startRow: 1, endRow: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [downloadingKey, setDownloadingKey] = useState(null)

  const fetchData = useCallback(async (p, ps) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/data/${fileInfo.file_id}?page=${p}&page_size=${ps}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const json = await res.json()
      setData(json.data)
      setMeta({
        totalRows: json.total_rows,
        totalPages: json.total_pages,
        startRow: json.start_row,
        endRow: json.end_row,
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [fileInfo.file_id])

  useEffect(() => {
    fetchData(page, pageSize)
  }, [fetchData, page, pageSize])

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value))
    setPage(1)
  }

  const handleDownload = async (scope, format) => {
    const key = `${scope}-${format}`
    setDownloadingKey(key)
    const params = new URLSearchParams({ scope, format, page, page_size: pageSize })
    const url = `/api/download/${fileInfo.file_id}?${params}`
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'csv' ? `data_${scope}.csv` : `data_${scope}.parquet`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setTimeout(() => setDownloadingKey(null), 1500)
    }
  }

  const columns = fileInfo.columns || []

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Info bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-gray-800 truncate max-w-xs" title={fileInfo.filename}>
          {fileInfo.filename}
        </span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-600">{fileInfo.row_count.toLocaleString()} rows</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-600">{fileInfo.col_count} columns</span>
        <button
          onClick={() => setSchemaOpen(o => !o)}
          className="ml-auto text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
        >
          {schemaOpen ? '▲' : '▼'} Schema
        </button>
      </div>

      {/* Schema panel */}
      {schemaOpen && (
        <div className="bg-slate-50 border-b border-gray-200 px-4 py-3">
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {columns.map((col) => (
              <div key={col.name} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1">
                <span className="text-gray-700 text-xs font-medium">{col.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${typeBadgeClass(col.type)}`}>
                  {col.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table area */}
      <div className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
        {!error && (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-[5]">
              <tr className="bg-slate-800 text-white">
                <th className="w-12 px-3 py-2.5 text-right text-slate-400 font-normal text-xs border-r border-slate-700">#</th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className={`px-3 py-2.5 text-left whitespace-nowrap font-medium border-r border-slate-700 last:border-r-0 ${
                      isNumericType(col.type) ? 'text-right' : ''
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${isNumericType(col.type) ? 'justify-end' : ''}`}>
                      <span className="truncate max-w-[160px]" title={col.name}>{col.name}</span>
                      <span className={`text-xs px-1 py-0.5 rounded font-mono flex-shrink-0 ${typeBadgeClass(col.type)}`}>
                        {col.type.length > 12 ? col.type.slice(0, 12) + '…' : col.type}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-1.5 text-right text-gray-300 text-xs border-r border-gray-100 select-none">
                    {meta.startRow + i}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.name}
                      className={`px-3 py-1.5 border-r border-gray-100 last:border-r-0 ${
                        isNumericType(col.type) ? 'text-right font-mono text-xs' : ''
                      }`}
                    >
                      <CellValue value={row[col.name]} />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-12 text-gray-400">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex flex-wrap items-center gap-3">
        {/* Row info */}
        <span className="text-xs text-gray-500 whitespace-nowrap">
          Rows {meta.startRow.toLocaleString()}–{meta.endRow.toLocaleString()} of {meta.totalRows.toLocaleString()}
        </span>

        {/* Page size */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Rows/page:</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Pagination */}
        <div className="flex-1 flex justify-center">
          <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={setPage} />
        </div>

        {/* Downloads */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400">Download:</span>
          {[
            { scope: 'page', format: 'csv', label: 'Page CSV' },
            { scope: 'page', format: 'parquet', label: 'Page Parquet' },
            { scope: 'all', format: 'csv', label: 'All CSV' },
            { scope: 'all', format: 'parquet', label: 'All Parquet' },
          ].map(({ scope, format, label }) => {
            const key = `${scope}-${format}`
            const busy = downloadingKey === key
            return (
              <button
                key={key}
                onClick={() => handleDownload(scope, format)}
                disabled={!!downloadingKey}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  busy
                    ? 'border-blue-300 bg-blue-50 text-blue-400 cursor-wait'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {busy ? '…' : `↓ ${label}`}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
