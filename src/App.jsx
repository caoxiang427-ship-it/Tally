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
  const [filterTheme, setFilterTheme] = useState(null);
  const [filterSentiment, setFilterSentiment] = useState(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20); // show 20 rows
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("analyze"); // "analyze" | "trend"
  const [trend, setTrend] = useState(null);

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
    setFilterTheme(null);
    setFilterSentiment(null);
    setReviewOnly(false);
    setVisibleCount(20);
    setSearch("");
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

  async function handleTrendUpload(e) {
    const files = Array.from(e.target.files || []);

    if (files.length < 2) {
      setError("Select at least two files");
      return;
    }

    setLoading(true);
    setError("");
    setTrend(null);

    const form = new FormData();
    files.forEach(f => form.append("files", f));

    try {
      const res = await fetch(`${API}/analyze_trend`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setTrend(json);
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

  const filtered = data
    ? data.results
        .map((r, i) => ({ r, i }))
        .filter(({ r, i }) => {
          if (corrections [i] === EXCLUDED) {
            return false;
          }
          const theme = corrections[i] ?? r.theme;
          if (filterTheme && theme !== filterTheme) {
            return false;
          }
          if (filterSentiment && r.sentiment !== filterSentiment) {
            return false;
          }
          if (reviewOnly && !r.needs_review) {
            return false;
          }
          if (search && !r.comment.toLowerCase().includes(search.toLowerCase())) {
            return false;
          }
          return true;
        })
    : [];
  
  const anyFilter = filterTheme || filterSentiment || reviewOnly || search;

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

      {!data && !trend && (
        <div className="landing">
          <h1 className="landing-title">Turn feedback into clear insights</h1>
          <p className="landing-sub">
            Upload open-ended comments (survey responses, reviews, complaints) 
            and get a structured breakdown of what your customers are saying.
          </p>

          <div className="mode-toggle">
            <button className={mode === "analyze" ? "on" : ""} onClick={() => setMode("analyze")}>Feedback Analysis</button>
            <button className={mode === "trend" ? "on" : ""} onClick={() => setMode("trend")}>Trend Analysis</button>
          </div>

          <label className="dropzone">
            <div className="dz-icon"><Upload size={22} color="#fff" /></div>
            <div className="dz-title">
              {loading ? "Analyzing…" : mode === "analyze"
                ? "Drop one CSV or click to upload"
                : "Select 2+ files, one per period"}
            </div>
            <div className="dz-hint">
              {mode === "analyze"
                ? "CSV or Excel — we'll find the comment column"
                : "Please name them in time order: 01_jan.csv, 02_feb.csv…"}
            </div>
            <input type="file" accept=".csv,.xlsx" hidden
              multiple={mode === "trend"}
              onChange={mode === "trend" ? handleTrendUpload : handleUpload} />
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
                d.primaryRows.map((t) => {
                  const s = sentimentSplit(data.results, t.theme, corrections);
                  return (
                    <div
                      className={`bar-row clickable ${filterTheme === t.theme ? "active" : ""}`}
                      key={t.theme}
                      onClick={() => { setFilterTheme(filterTheme === t.theme ? null : t.theme); setVisibleCount(20); }}
                    >
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
                d.mentionRows.map((t) => {
                  const max = d.mentionRows[0]?.count || 1;
                  return (
                    <div
                      className={`bar-row clickable ${filterTheme === t.theme ? "active" : ""}`}
                      key={t.theme}
                      onClick={() => { setFilterTheme(filterTheme === t.theme ? null : t.theme); setVisibleCount(20); }}
                    >
                      <div className="bar-label"><span>{t.theme}</span><span>{t.count}</span></div>
                      <div className="bar">
                        <span style={{ width: `${(t.count / max) * 100}%`, background: "#4f46e5" }} />
                      </div>
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
                  {data.results.filter((r, i) => r.needs_review && corrections[i] !== EXCLUDED).length} low-confidence or unmatched
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
            <div className="card-head">
              <span>Comments</span>
              <span className="muted">
                showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
                {anyFilter && ` (filtered from ${data.results.length})`}
              </span>
            </div>

            <div className="filters">
              <input
                className="search-box"
                type="text"
                placeholder="Search comments..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setVisibleCount(20); }}
              />
              {data.themes.map(t => (
                <button
                  key={t}
                  className={`chip-btn ${filterTheme === t ? "on" : ""}`}
                  onClick={() => { setFilterTheme(filterTheme === t ? null : t); setVisibleCount(20); }}
                >{t}</button>
              ))}
              <span className="filter-sep" />
              {["negative", "positive", "neutral"].map(s => (
                <button
                  key={s}
                  className={`chip-btn ${s} ${filterSentiment === s ? "on" : ""}`}
                  onClick={() => { setFilterSentiment(filterSentiment === s ? null : s); setVisibleCount(20); }}
                >{s}</button>
              ))}
              <button
                className={`chip-btn ${reviewOnly ? "on" : ""}`}
                onClick={() => { setReviewOnly(!reviewOnly); setVisibleCount(20); }}
              >needs review</button>
              {anyFilter && (
                <button className="chip-btn clear" onClick={() => {
                  setFilterTheme(null); setFilterSentiment(null); setReviewOnly(false); 
                  setSearch(""); setVisibleCount(20);
                }}>clear</button>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="empty-msg">No comments match these filters.</p>
            ) : (
              <>
                <table className="tbl">
                  <thead><tr><th>Comment</th><th>Theme</th><th>Sentiment</th><th className="c-conf-h">Conf.</th></tr></thead>
                  <tbody>
                    {filtered.slice(0, visibleCount).map(({ r, i }) => {
                      const ex = corrections[i] === EXCLUDED;
                      const theme = ex ? "—" : (corrections[i] ?? r.theme);
                      return (
                        <tr key={i} className={`${r.needs_review ? "row-review" : ""} ${ex ? "row-excluded" : ""}`}>
                          <td className="c-comment">{r.comment}</td>
                          <td className="c-theme">
                            {theme}
                            {!ex && r.secondary_themes?.length > 0 && (
                              <span className="sec-themes"> +{r.secondary_themes.join(", ")}</span>
                            )}
                          </td>
                          <td><span className={`pill ${r.sentiment}`}>{r.sentiment}</span></td>
                          <td className="c-conf" style={{ color: r.confidence < 0.6 ? "#854F0B" : "#27500A" }}>
                            {r.confidence?.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filtered.length > visibleCount && (
                  <button className="show-more" onClick={() => setVisibleCount(visibleCount + 20)}>
                    Show 20 more ({filtered.length - visibleCount} remaining)
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}

      {trend && <TrendView trend={trend} onBack={() => setTrend(null)} />}
    </div>
  );
}

function TrendView({ trend, onBack }) {
  const { themes, periods } = trend;
  const [active, setActive] = useState(null);
  const isTrend = periods.length >= 3;
  const allThemes = [...themes];
  
  if (periods.some(p => p.other_count > 0)) allThemes.push("Other");
  const small = periods.filter(p => p.total < 30); // small sample size

  const delta = (theme) => {
    const first = periods[0].theme_shares[theme] ?? 0;
    const last = periods[periods.length - 1].theme_shares[theme] ?? 0;
    return +(last - first).toFixed(1);
  };

  const sorted = [...allThemes].sort((a, b) =>
    (periods[periods.length - 1].theme_shares[b] ?? 0) - 
    (periods[periods.length - 1].theme_shares[a] ?? 0)
  );

  return (
    <>
      <div className="trend-head">
        <span>{isTrend ? "Trend across" : "Comparison of"} {periods.length} periods</span>
        <button className="btn" onClick={onBack}>New upload</button>
      </div>

      <div className="metrics">
        {periods.map(p => (
          <div className="metric" key={p.name}>
            <div className="metric-label">{p.name}</div>
            <div className="metric-value">{p.total}</div>
            <div className="metric-sub">comments</div>
          </div>
        ))}
      </div>

      {small.length > 0 && (
        <p className="warn">
          {small.map(p => p.name).join(", ")} {small.length === 1 ? "has" : "have"} under 30
          comments — percentage shifts there reflect very few responses and should be read with caution.
        </p>
      )}

      <section className="card">
        <div className="card-head">
          <span>Theme share by period</span>
          <span className="muted">% of comments</span>
        </div>
        <LineChart periods={periods} themes={sorted} active={active} delta={delta}/>
        <div className="line-legend">
          {sorted.map((t, i) => (
            <button
              key={t}
              className={`legend-item ${active && active !== t ? "dim" : ""}`}
              onClick={() => setActive(active === t ? null : t)}
            >
              <span className="dot" style={{ background: lineColor(t, i) }} />
              {t}
              <span className={`delta ${delta(t) > 0 ? "up" : delta(t) < 0 ? "down" : ""}`}>
                {delta(t) > 0 ? "+" : ""}{delta(t)}pp
              </span>
            </button>
          ))}
        </div>
        <p className="illustrative">
          Change is shown in percentage points (pp) between the first and last period.
          Shares are used rather than raw counts, since periods differ in size.
          Click a theme to isolate its line.
        </p>
      </section>
    </>
  );
}

const LINE_COLORS = ["#4f46e5", "#E24B4A", "#639922", "#D97706", "#0891B2", "#9333EA", "#B4B2A9"];
const lineColor = (theme, i) => (theme === "Other" ? "#B4B2A9" : LINE_COLORS[i % LINE_COLORS.length]);

function LineChart({ periods, themes, active, delta }) {
  const [hover, setHover] = useState(null);
  const W = 700, H = 280;
  const padL = 42, padR = 16, padT = 12, padB = 34;

  const maxRaw = Math.max(
    ...themes.flatMap(t => periods.map(p => p.theme_shares[t] ?? 0)), 10
  );
  const maxY = Math.ceil(maxRaw / 10) * 10;

  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, periods.length - 1);
  const y = (v) => padT + (1 - v / maxY) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxY * f));

  const shown = active || hover;   // click wins, hover is transient

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-chart">
      {ticks.map(v => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#f0f0f4" strokeWidth="1" />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" className="axis-label">{v}%</text>
        </g>
      ))}

      {periods.map((p, i) => (
        <text key={p.name} x={x(i)} y={H - 12} textAnchor="middle" className="axis-label">
          {p.name}
        </text>
      ))}

      {themes.map((t, ti) => {
        const pts = periods.map((p, i) => `${x(i)},${y(p.theme_shares[t] ?? 0)}`).join(" ");
        const dim = shown && shown !== t;
        return (
          <g key={t} opacity={dim ? 0.12 : 1}>
            {/* invisible wide hit area — makes the thin line easy to hover */}
            <polyline
              points={pts}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onMouseEnter={() => setHover(t)}
              onMouseLeave={() => setHover(null)}
            />
            <polyline
              points={pts}
              fill="none"
              stroke={lineColor(t, ti)}
              strokeWidth={shown === t ? 3 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
            {periods.map((p, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.theme_shares[t] ?? 0)}
                r={shown === t ? 4 : 3}
                fill="#fff"
                stroke={lineColor(t, ti)}
                strokeWidth="2"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(t)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${t} — ${p.name}: ${p.theme_shares[t] ?? 0}% (${p.theme_counts[t] ?? 0})`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {/* floating pill label on the hovered line */}
      {hover && (() => {
        const last = periods.length - 1;
        const v = periods[last].theme_shares[hover] ?? 0;
        const d = delta(hover);
        const ti = themes.indexOf(hover);
        const first = periods[0].theme_shares[hover] ?? 0;
        const label = `${hover} ${first}% → ${v}%`;

        const w = label.length * 6.4 + 18;      // estimated text width + padding
        const h = 20;
        const cx = x(last);
        const cy = Math.max(y(v) - 14, padT + h / 2);
        const rx = Math.min(cx, W - padR) - w;  // grow leftward, keep inside chart

        return (
          <g style={{ pointerEvents: "none" }}>
            <rect
              x={rx}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={h / 2}
              fill={lineColor(hover, ti)}
            />
            <text
              x={rx + w / 2}
              y={cy + 4}
              textAnchor="middle"
              className="hover-pill-text"
            >
              {label}
            </text>
          </g>
        );
      })()}
    </svg>
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
