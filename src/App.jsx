import { useState } from "react";
import "./App.css";
import { LayoutGrid, BarChart3, MessageSquareQuote, Upload } from "lucide-react";

const API = "http://127.0.0.1:8000";
const COLORS = { negative: "#E24B4A", positive: "#639922", neutral: "#B4B2A9" };

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);

  async function handleUpload(e) {
    const file = e.target.files[0];
    
    if (!file) return;

    setLoading(true);
    setError("");
    setData(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API}/analyze_stream`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by a blank line
        const parts = buffer.split("\n\n");
        buffer = parts.pop();  // keep the incomplete tail

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          const msg = JSON.parse(line);

          if (msg.error) throw new Error(msg.error);

          if (msg.type === "themes") {
            setProgress({ done: 0, total: msg.total });
          } else if (msg.type === "progress") {
            setProgress({ done: msg.done, total: msg.total });
          } else if (msg.type === "done") {
            setData(msg);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(null);
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
        <div className="landing">
          <h1 className="landing-title">Turn feedback into themes</h1>
          <p className="landing-sub">Upload open-ended comments — survey responses, reviews, complaints — and get a structured breakdown of what people are saying.</p>

          <label className="dropzone">
            <div className="dz-icon"><Upload size={22} color="#fff" /></div>
            <div className="dz-title">
              {loading
                ? (progress ? `Analyzing ${progress.done} / ${progress.total}…` : "Reading file…")
                : "Drop a CSV or click to upload"}
            </div>
            <div className="dz-hint">CSV or Excel — we'll find the comment column</div>
            <input type="file" accept=".csv,.xlsx" onChange={handleUpload} hidden />
          </label>

          {loading && progress && progress.total > 0 && (
            <div className="progress">
              <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          )}
          
          {error && <p className="error">{error}</p>}

          <div className="features">
            <Feature icon={<LayoutGrid size={20} color="#4f46e5" />}
              title="Discovers themes" text="Finds the topics automatically — no setup or labels." />
            <Feature icon={<BarChart3 size={20} color="#4f46e5" />}
              title="Counts and charts" text="See how often each theme comes up, with sentiment." />
            <Feature icon={<MessageSquareQuote size={20} color="#4f46e5" />}
              title="Real examples" text="Every theme backed by actual quotes from the data." />
          </div>
        </div>
      )}

      {data && d && (
        <>
          {data.text_column && (
            <>
              <p className="detected">Analyzing column: <b>{data.text_column}</b></p>
              {data.clean_parse === false && (
                <p className="warn">Some rows were malformed, so the file was read line-by-line. Every comment was kept, but non-text columns may have been ignored.</p>
              )}
            </>
          )}
          <div className="metrics">
            <Metric label="Comments" value={data.total} />
            <Metric label="Themes" value={data.themes.length} />
            <Metric label="Positive" value={d.pos + "%"} />
            <Metric label="Negative" value={d.neg + "%"} />
            <Metric label="For review" value={data.review_count ?? 0} />
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
              <thead><tr><th>Comment</th><th>Theme</th><th>Sentiment</th><th className="c-conf-h">Conf.</th></tr></thead>
              <tbody>
                {data.results.slice(0, 12).map((r, i) => (
                  <tr key={i} className={r.needs_review ? "row-review" : ""}>
                    <td className="c-comment">{r.comment}</td>
                    <td className="c-theme">{r.theme}</td>
                    <td><span className={`pill ${r.sentiment}`}>{r.sentiment}</span></td>
                    <td className="c-conf" style={{ color: r.confidence < 0.6 ? "#854F0B" : "#27500A" }}>
                      {r.confidence?.toFixed(2)}
                    </td>
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

const Feature = ({ icon, title, text }) => (
  <div className="feature">
    <div className="feature-icon">{icon}</div>
    <div className="feature-title">{title}</div>
    <div className="feature-text">{text}</div>
  </div>
);

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

