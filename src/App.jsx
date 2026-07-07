import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import "./App.css";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files[0];
    
    if (!file) return;

    setLoading(true);
    setError("");
    setData(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API}/analyze?column=text`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const themeData = data
    ? Object.entries(data.theme_counts)
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="app">
      <h1>Tally</h1>
      <p className="tagline">GROUP BY for text. Upload feedback, get themes.</p>

      <label className="upload">
        {loading ? "Analyzing…" : "Upload CSV (needs a 'text' column)"}
        <input type="file" accept=".csv" onChange={handleUpload} hidden />
      </label>

      {error && <p className="error">{error}</p>}

      {data && (
        <div className="results">
          <p className="summary">
            Analyzed <b>{data.total}</b> comments into{" "}
            <b>{Object.keys(data.theme_counts).length}</b> themes.
          </p>

          <h2>Themes</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={themeData} layout="vertical"
                      margin={{ left: 40, right: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="theme" width={140} />
              <Tooltip />
              <Bar dataKey="count">
                {themeData.map((_, i) => (
                  <Cell key={i} fill="#4f46e5" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <h2>Sentiment</h2>
          <div className="sentiment">
            {Object.entries(data.sentiment_counts).map(([s, n]) => (
              <span key={s} className={`chip ${s}`}>{s}: {n}</span>
            ))}
          </div>

          <h2>Examples by theme</h2>
          {Object.entries(data.examples).map(([theme, quotes]) => (
            <div key={theme} className="example">
              <b>{theme}</b>
              <ul>{quotes.map((q, i) => <li key={i}>"{q}"</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
