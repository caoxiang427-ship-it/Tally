import { useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";
const COLORS = { negative: "#E24B4A", positive: "#639922", neutral: "#B4B2A9" };

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
      }); // sends POST /analyze with csv to FastAPI backend
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const d = data ? derive(data) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">T</div>
          <span className="brand-name">Tally</span>
          {data && <span className="chip">{data.total} rows</span>}
        </div>
        {data && <button className="btn" onClick={() => exportCSV(data.results)}>Export CSV</button>}
      </header>

      {!data && (
        <div className="empty">
          <p className="tagline">GROUP BY for text.</p>
          <label className="upload">
            {loading ? "Analyzing…" : "Upload CSV (needs a 'text' column)"}
            <input type="file" accept=".csv" onChange={handleUpload} hidden />
          </label>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {data && d && (
        <>
          <div className="metrics">
            <Metric label="Comments" value={data.total} />
            <Metric label="Themes" value={data.themes.length} />
            <Metric label="Positive" value={d.pos + "%"} />
            <Metric label="Negative" value={d.neg + "%"} />
          </div>

          <div className="grid">
            <section className="card">
              <div className="card-head"><span>Themes by sentiment</span><span className="muted">count</span></div>
              {d.rows.map((t) => (
                <div className="bar-row" key={t.theme}>
                  <div className="bar-label"><span>{t.theme}</span><span>{t.total}</span></div>
                  <div className="bar">
                    <span style={{ width: pct(t.negative, t.total), background: COLORS.negative }} />
                    <span style={{ width: pct(t.positive, t.total), background: COLORS.positive }} />
                    <span style={{ width: pct(t.neutral, t.total), background: COLORS.neutral }} />
                  </div>
                </div>
              ))}
              <div className="legend">
                <Leg c={COLORS.negative} l="Negative" /><Leg c={COLORS.positive} l="Positive" /><Leg c={COLORS.neutral} l="Neutral" />
              </div>
            </section>

            <section className="card">
              <div className="card-head"><span>Overall sentiment</span></div>
              <div className="bar solo">
                <span style={{ width: d.neg + "%", background: COLORS.negative }} />
                <span style={{ width: d.pos + "%", background: COLORS.positive }} />
                <span style={{ width: d.neu + "%", background: COLORS.neutral }} />
              </div>
              <div className="sent-list">
                <div><span>Negative</span><b>{d.sent.negative || 0}</b></div>
                <div><span>Positive</span><b>{d.sent.positive || 0}</b></div>
                <div><span>Neutral</span><b>{d.sent.neutral || 0}</b></div>
              </div>
              <p className="illustrative">Sentiment is illustrative, not evaluated.</p>
            </section>
          </div>

          <section className="card">
            <div className="card-head"><span>Comments</span></div>
            <table className="tbl">
              <thead><tr><th>Comment</th><th>Theme</th><th>Sentiment</th></tr></thead>
              <tbody>
                {data.results.slice(0, 12).map((r, i) => (
                  <tr key={i}>
                    <td className="c-comment">{r.comment}</td>
                    <td className="c-theme">{r.theme}</td>
                    <td><span className={`pill ${r.sentiment}`}>{r.sentiment}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

const Metric = ({ label, value }) => (
  <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>
);
const Leg = ({ c, l }) => (<span className="leg"><span className="dot" style={{ background: c }} />{l}</span>);
const pct = (part, total) => (total ? (part / total) * 100 + "%" : "0%");

function derive(data) {
  const sent = { 
    negative: 0, 
    positive: 0, 
    neutral: 0, 
    ...data.sentiment_counts
  };
  const totalSent = (sent.negative + sent.positive + sent.neutral) || 1;
  
  const map = {};
  // counter for every theme
  data.themes.forEach((t) => (
    map[t] = { theme: t, negative: 0, positive: 0, neutral: 0, total: 0 }));

  data.results.forEach((r) => {
    if (!map[r.theme]) {
      map[r.theme] = { theme: r.theme, negative: 0, positive: 0, neutral: 0, total: 0 };
    };
    map[r.theme][r.sentiment] = (map[r.theme][r.sentiment] || 0) + 1;
    map[r.theme].total += 1;
  });
  return {
    sent,
    pos: Math.round((sent.positive / totalSent) * 100),
    neg: Math.round((sent.negative / totalSent) * 100),
    neu: Math.round((sent.neutral / totalSent) * 100),
    rows: Object.values(map).sort((a, b) => b.total - a.total),
  };
}

// For user to export the results as a CSV file
function exportCSV(results) {
  const rows = results.map((r) => 
    `"${(r.comment || "").replace(/"/g, '""')}","${r.theme}","${r.sentiment}"`
  );

  const blob = new Blob(
    ["comment,theme,sentiment\n" + rows.join("\n")], 
    { type: "text/csv" }
  );

  const a = document.createElement("a"); // create a download link
  a.href = URL.createObjectURL(blob); // connect the link to the file (blob)
  a.download = "tally_results.csv"; // set the filename
  a.click();
}

