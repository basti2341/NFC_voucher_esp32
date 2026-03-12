import { useMemo, useState } from 'react'
import './App.css'

const API_BASE = ''

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = { ok: false, error: 'Ungültige Serverantwort' }
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP ${response.status}`)
  }
  return payload
}

function prettyErrorMessage(err) {
  const msg = (err && err.message) || String(err)
  if (msg.includes('404') || /no tag|kein tag/i.test(msg)) return 'Kein Tag erkannt.'
  if (/invalid|ungültig/i.test(msg)) return 'Ungültige Daten.'
  return msg
}

function App() {
  const [readResult, setReadResult] = useState(null)
  const [form, setForm] = useState({ name: '', klasse: '', grund: '', tage: 1 })
  const [status, setStatus] = useState({ type: 'idle', message: 'Bereit.' })
  const [busy, setBusy] = useState(false)

  const canWrite = useMemo(() => {
    return !busy && form.name.trim().length > 0 && Number(form.tage) >= 1
  }, [form, busy])

  const updateField = (key, value) => setForm((s) => ({ ...s, [key]: value }))

  const readTag = async () => {
    setBusy(true)
    setStatus({ type: 'info', message: 'Warte auf NFC-Tag...' })
    try {
      const data = await apiRequest('/api/tag/read', { method: 'POST' })
      setReadResult(data)
      setStatus({ type: 'success', message: 'Tag erfolgreich gelesen.' })
    } catch (error) {
      setReadResult(null)
      setStatus({ type: 'error', message: prettyErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const writeTag = async () => {
    if (!canWrite) {
      setStatus({ type: 'error', message: 'Bitte gültige Daten eingeben.' })
      return
    }

    setBusy(true)
    setStatus({ type: 'info', message: 'Bereit zum Schreiben. Halte einen NFC-Tag an das Gerät...' })
    try {
      const body = { ...form }
      const resp = await apiRequest('/api/tag/write', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setStatus({ type: 'success', message: resp?.message || 'Schreiben erfolgreich.' })
    } catch (error) {
      setStatus({ type: 'error', message: prettyErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const clearTag = async () => {
    const ok = window.confirm('Sicher löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')
    if (!ok) return

    setBusy(true)
    setStatus({ type: 'info', message: 'Warte auf NFC-Tag zum Löschen...' })
    try {
      const resp = await apiRequest('/api/tag/clear', { method: 'POST' })
      setStatus({ type: 'success', message: resp?.message || 'Tag wurde gelöscht.' })
      setReadResult(null)
    } catch (error) {
      setStatus({ type: 'error', message: prettyErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const parsedTagData = useMemo(() => {
    if (!readResult) return null
    const text = readResult.text || readResult.payload || ''
    try {
      const parsed = JSON.parse(text)
      return parsed
    } catch {
      return { rawText: text }
    }
  }, [readResult])

  return (
    <main className="app">
      <section className="panel">
        <h1>NFC Webapp</h1>
        <p className="hint">REST API am ESP: <code>/api/tag/*</code></p>

        <div className="actions-row">
          <button className="primary" onClick={readTag} disabled={busy}>
            {busy ? 'Bitte warten...' : 'Tag lesen'}
          </button>
        </div>

        {readResult ? (
          <div className="result">
            <h3>Gelesene Daten</h3>
            <div><strong>Tagtyp:</strong> {readResult.tagType || 'unbekannt'}</div>
            <div><strong>UID:</strong> {readResult.uid || '(nicht verfügbar)'}</div>
            {parsedTagData && parsedTagData.rawText ? (
              <div><strong>Text (raw):</strong> {parsedTagData.rawText}</div>
            ) : (
              parsedTagData && (
                <div className="tag-json">
                  <div><strong>Name:</strong> {parsedTagData.name || '-'}</div>
                  <div><strong>Klasse/Jahrgang:</strong> {parsedTagData.klasse || '-'}</div>
                  <div><strong>Grund:</strong> {parsedTagData.grund || '-'}</div>
                  <div><strong>Freie Tage:</strong> {parsedTagData.tage ?? '-'}</div>
                  <div><strong>Konsumiert:</strong> {parsedTagData.consumed ?? 0}</div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="result empty">Kein Tag gelesen.</div>
        )}
      </section>

      <section className="panel">
        <h2>Tag beschreiben</h2>

        <label>Name</label>
        <input value={form.name} onChange={(e) => updateField('name', e.target.value)} />

        <label>Klasse / Jahrgang</label>
        <input value={form.klasse} onChange={(e) => updateField('klasse', e.target.value)} />

        <label>Grund</label>
        <textarea rows={3} value={form.grund} onChange={(e) => updateField('grund', e.target.value)} />

        <label>Anzahl freier Tage</label>
        <input type="number" min="1" max="400" value={form.tage} onChange={(e) => updateField('tage', Number(e.target.value) || 0)} />

        <div className="actions">
          <button className="primary" onClick={writeTag} disabled={!canWrite}>
            Tag beschreiben
          </button>
        </div>
        <h2>NFC Löschen</h2>
        <label htmlFor="clearTag">NFC-Tag löschen</label>
        <div className="actions">
          <button className="danger" onClick={clearTag} disabled={busy}>
            Tag löschen
          </button>
        </div>
      </section>

      <section className={`status ${status.type}`}>
        {status.message}
      </section>
    </main>
  )
}

export default App
