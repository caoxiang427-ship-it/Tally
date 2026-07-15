import { useState } from "react";
import "./App.css";
import { LayoutGrid, BarChart3, MessageSquareQuote, Upload } from "lucide-react";

const API = "http://127.0.0.1:8000";
const COLORS = { negative: "#E24B4A", positive: "#639922", neutral: "#B4B2A9" };
const EXCLUDED = "__excluded__";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // const [progress, setProgress] = useState(null);
  const [view, setView] = useState("primary"); // "primary" or "mentions"
  const [corrections, setCorrections] = useState({});

  // Get the effective theme
  // If user has corrected then theme, use it; otherwise, use original one
  const themeOf = (r, i) => corrections[i] ?? r.theme;

  async function handleUpload(e) {
    const file = e.target.files[0];

    if (!file) return;

    setLoading(true); 
    setError(""); 
    setData(null); 
    setCorrections({});
    // setProgress(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API}/analyze`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /*
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

      // If the backend returned a plain JSON error (not a stream), handle it
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const j = await res.json();
        if (j.error) {
          setError(j.error);
          setLoading(false);
          return;
        }
      }
    
      // otherwise, proceed with the streaming reader
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
  */

  const d = data ? derive(data, corrections) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">T</div>
          <span className="brand-name">Tally</span>
          {data && <span className="chip">{data.total} rows</span>}
        </div>
        {data && <button className="btn" onClick={() => exportCSV(data.results, corrections)}>Export CSV</button>}
      </header>

      {!data && (
        <div className="landing">
          <h1 className="landing-title">Turn feedback into themes</h1>
          <p className="landing-sub">Upload open-ended comments — survey responses, reviews, complaints — and get a structured breakdown of what people are saying.</p>

          <label className="dropzone">
            <div className="dz-icon"><Upload size={22} color="#fff" /></div>
            <div className="dz-title">
              {loading ? "Analyzing your comments…" : "Drop a CSV or click to upload"}
            </div>
            <div className="dz-hint">CSV or Excel — we'll find the comment column</div>
            <input type="file" accept=".csv,.xlsx" onChange={handleUpload} hidden />
          </label>

          {loading && (
            <div className="loading-box">
              <div className="spinner" />
              <p>Classifying each comment — this takes a few seconds per hundred.</p>
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
            <Metric label="Comments" value={d.included} />
            <Metric label="Themes" value={data.themes.length} />
            <Metric label="Positive" value={d.pos + "%"} />
            <Metric label="Negative" value={d.neg + "%"} />
            <Metric label="For review" value={data.review_count ?? 0} />
          </div>

          {d.excludedCount > 0 && (
            <p className="detected">{d.excludedCount} comment(s) excluded from counts as not feedback.</p>
          )}

          <div className="grid">
            <section className="card">
              <div className="card-head">
                <span>Themes {view === "primary" ? "by sentiment" : "by mentions"}</span>
                <div className="toggle">
                  <button className={view === "primary" ? "on" : ""} onClick={() => setView("primary")}>Primary</button>
                  <button className={view === "mentions" ? "on" : ""} onClick={() => setView("mentions")}>Mentions</button>
                </div>
              </div>

              {view === "primary" ? (
                // existing sentiment-stacked bars, driven by d.primaryRows
                d.primaryRows.map((t) => {
                  const s = sentimentSplit(data.results, t.theme, corrections);
                  return (
                    <div className="bar-row" key={t.theme}>
                      <div className="bar-label"><span>{t.theme}</span><span>{t.count}</span></div>
                      <div className="bar">
                        <span style={{ width: pct(s.negative, t.count), background: COLORS.negative }} />
                        <span style={{ width: pct(s.positive, t.count), background: COLORS.positive }} />
                        <span style={{ width: pct(s.neutral, t.count), background: COLORS.neutral }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                // mentions: plain single-color bars
                d.mentionRows.map((t) => {
                  const max = d.mentionRows[0]?.count || 1;
                  return (
                    <div className="bar-row" key={t.theme}>
                      <div className="bar-label"><span>{t.theme}</span><span>{t.count}</span></div>
                      <div className="bar"><span style={{ width: `${(t.count / max) * 100}%`, background: "#4f46e5" }} /></div>
                    </div>
                  );
                })
              )}

              {view === "primary" && (
                <div className="legend">
                  <Leg c={COLORS.negative} l="Negative" /><Leg c={COLORS.positive} l="Positive" /><Leg c={COLORS.neutral} l="Neutral" />
                </div>
              )}
              {view === "mentions" && (
                <p className="illustrative">Counts each theme a comment mentions, so the total exceeds the number of comments.</p>
              )}
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

          {data.results.some(r => r.needs_review) && (
            <section className="card review-card">
              <div className="card-head">
                <span>Needs review</span>
                <span className="muted">
                  {data.results.filter(r => r.needs_review).length} low-confidence or unmatched
                </span>
              </div>
              <p className="review-note">
                These comments were classified with low confidence, or matched no theme. Correct the
                theme if needed — changes update the charts and the exported CSV.
              </p>
              {data.results.map((r, i) =>
                r.needs_review ? (

                  <div className={`review-row ${corrections[i] === EXCLUDED ? "is-excluded" : ""}`} key={i}>
                    <div className="review-comment">{r.comment}</div>
                    <div className="review-controls">
                      <span className="conf-badge">
                        {r.theme === "Other" ? "no theme matched" : `low conf ${r.confidence?.toFixed(2)}`}
                      </span>
                      <select
                        value={corrections[i] ?? r.theme}
                        onChange={(e) => setCorrections({ ...corrections, [i]: e.target.value })}
                      >
                        {[...data.themes, "Other"].map(t => <option key={t} value={t}>{t}</option>)}
                        <option value={EXCLUDED}>— Exclude (not feedback)</option>
                      </select>
                      {corrections[i] === EXCLUDED && <span className="excluded-tag">excluded</span>}
                      {corrections[i] && corrections[i] !== EXCLUDED && corrections[i] !== r.theme && (
                        <span className="corrected-tag">corrected</span>
                      )}
                    </div>
                  </div>

                ) : null
              )}
            </section>
          )}
         
          <section className="card">
            <div className="card-head"><span>Comments</span></div>
            <table className="tbl">
              <thead><tr><th>Comment</th><th>Theme</th><th>Sentiment</th><th className="c-conf-h">Conf.</th></tr></thead>
              <tbody>
                {data.results.slice(0, 12).map((r, i) => (
                  <tr key={i} className={r.needs_review ? "row-review" : ""}>
                    <td className="c-comment">{r.comment}</td>
                    <td className="c-theme">{themeOf(r, i)}</td>
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

function derive(data, corrections) {
  const isEx = (i) => corrections[i] === EXCLUDED;

  const sent = { 
    negative: 0, 
    positive: 0, 
    neutral: 0
  };
  data.results.forEach((r, i) => {
    if (isEx(i)) return;
    sent[r.sentiment] = (sent[r.sentiment] || 0) + 1;
  });
  const totalSent = (sent.negative + sent.positive + sent.neutral) || 1;
  
  // Recount primary themes using corrections
  const primary = {};
  data.themes.forEach(t => (primary[t] = 0));
  data.results.forEach((r, i) => {
    if (isEx(i)) return;
    const t = corrections[i] ?? r.theme;
    primary[t] = (primary[t] || 0) + 1;
  });

  // Recount mentions using corrections
  const mention = {};
  data.themes.forEach(t => (mention[t] = 0));
  data.results.forEach((r, i) => {
    if (isEx(i)) return;
    const t = corrections[i] ?? r.theme;
    [t, ...(r.secondary_themes || [])]
      .forEach(x => (
        mention[x] = (mention[x] || 0) + 1));
      });

  const toRows = (obj) => Object.entries(obj)
    .map(([theme, count]) => ({ theme, count }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const excludedCount = data.results.filter((_, i) => isEx(i)).length;

  return {
    sent,
    included: data.results.length - excludedCount,
    excludedCount,
    pos: Math.round(sent.positive / totalSent * 100),
    neg: Math.round(sent.negative / totalSent * 100),
    neu: Math.round(sent.neutral / totalSent * 100),
    primaryRows: toRows(primary),
    mentionRows: toRows(mention),
  };
}

// For user to export the results as a CSV file
function exportCSV(results, corrections) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = "comment,primary_theme,secondary_themes,sentiment,confidence,status";
  const rows = results.map((r, i) => {
    const c = corrections[i];
    const excluded = c === EXCLUDED;
    const corrected = c && !excluded && c !== r.theme;
    return [
      esc(r.comment),
      esc(excluded ? "" : (c ?? r.theme)),
      esc(excluded ? "" : (r.secondary_themes || []).join("; ")),
      esc(r.sentiment),
      esc(r.confidence?.toFixed(2) ?? ""),
      esc(excluded ? "excluded" : corrected ? "human_corrected" : "model"),
    ].join(",");
  });
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tally_results.csv";
  a.click();
}

function sentimentSplit(results, theme, corrections) {
  const s = { negative: 0, positive: 0, neutral: 0 };
  results.forEach((r, i) => {
    if (corrections[i] === EXCLUDED) return;
    const t = corrections[i] ?? r.theme;
    if (t === theme) s[r.sentiment] = (s[r.sentiment] || 0) + 1;
  });
  return s;
}
