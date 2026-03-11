import { useMemo, useState } from "react";
import "./App.css";

const API_BASE = "";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { ok: false, error: "Ungültige Serverantwort" };
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload;
}

function App() {
  const [form, setForm] = useState({
    name: "",
    klasse: "",
    grund: "",
    tage: 1,
  });

  const [status, setStatus] = useState({ type: "idle", message: "Bereit." });
  const [busy, setBusy] = useState(false);

  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const jsonData = useMemo(() => {
    return JSON.stringify(form, null, 2);
  }, [form]);

  const canWrite = useMemo(() => {
    return (
      form.name.trim() &&
      form.klasse.trim() &&
      form.grund.trim() &&
      !busy
    );
  }, [form, busy]);

  const writeTag = async () => {
    setBusy(true);
    setStatus({ type: "info", message: "Bitte NFC-Tag an den Reader halten..." });

    try {
      await apiRequest("/api/tag/write", {
        method: "POST",
        body: JSON.stringify({ data: form }),
      });

      setStatus({ type: "success", message: "NFC-Tag erfolgreich beschrieben!" });

      setForm({
        name: "",
        klasse: "",
        grund: "",
        tage: 1,
      });

    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">

      <section className="panel">
        <h1>NFC-Tag beschreiben</h1>

        <label>Name</label>
        <input
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
        />

        <label>Klasse / Jahrgang</label>
        <input
          value={form.klasse}
          onChange={(e) => updateField("klasse", e.target.value)}
        />

        <label>Grund</label>
        <textarea
          rows={3}
          value={form.grund}
          onChange={(e) => updateField("grund", e.target.value)}
        />

        <label>Anzahl freier Tage</label>
        <input
          type="number"
          min="1"
          max="30"
          value={form.tage}
          onChange={(e) => updateField("tage", Number(e.target.value))}
        />

        <div className="actions">
          <button onClick={writeTag} disabled={!canWrite}>
            {busy ? "Bitte warten..." : "Auf NFC schreiben"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>JSON Vorschau</h2>
        <pre>{jsonData}</pre>
      </section>

      <section className={`status ${status.type}`}>
        {status.message}
      </section>

    </main>
  );
}

export default App;