import { useEffect, useState } from 'react'
import { loadRemarks, saveRemarks, clearRemarks } from '../utils/storage.js'

export default function RemarksBox({ lang, taskId }) {
  const [text, setText] = useState('')

  useEffect(() => {
    const saved = loadRemarks(lang, taskId)
    if (saved) setText(saved)
  }, [lang, taskId])

  useEffect(() => {
    saveRemarks(lang, taskId, text)
  }, [lang, taskId, text])

  const reset = () => {
    if (!confirm('Clear remarks for this task?')) return
    clearRemarks(lang, taskId)
    setText('')
  }

  return (
    <div className="card" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Remarks</h3>
        <button className="btn ghost" onClick={reset}>Clear</button>
      </div>
      <textarea
        placeholder="Write your remarks, issues, or confusion here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          marginTop: 10,
          width: '100%',
          height: '120px',
          resize: 'vertical',
          padding: '8px',
          borderRadius: '6px',
          border: '1px solid #ccc',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}
