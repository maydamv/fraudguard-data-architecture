import { useState, useEffect, useRef, useCallback } from "react";

// ── Helpers ──
const merchants = [
  "Amazon",
  "Netflix",
  "Uber",
  "Airbnb",
  "Steam",
  "Spotify",
  "Apple",
  "Booking.com",
];
const cities = [
  "Madrid",
  "London",
  "New York",
  "Tokyo",
  "Paris",
  "Berlin",
  "Dubai",
  "Sydney",
];
const devices = [
  "iPhone 15",
  "Samsung S24",
  "Chrome/Mac",
  "Firefox/Win",
  "iPad Pro",
];

function randomTx(id) {
  const amount = +(Math.random() * 980 + 20).toFixed(2);
  const merchant = merchants[Math.floor(Math.random() * merchants.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const device = devices[Math.floor(Math.random() * devices.length)];
  const hour = Math.floor(Math.random() * 24);
  // Fraud signals: high amount, unusual hour, risky merchant combo
  const highAmount = amount > 700;
  const unusualHour = hour >= 1 && hour <= 5;
  const velocityHit = Math.random() < 0.25;
  const score = Math.min(
    0.99,
    (highAmount ? 0.35 : 0.05) +
      (unusualHour ? 0.25 : 0.02) +
      (velocityHit ? 0.35 : 0.05) +
      Math.random() * 0.15,
  );
  return {
    id,
    user_id: `USR_${String(Math.floor(Math.random() * 9000 + 1000))}`,
    merchant,
    amount,
    city,
    device,
    hour,
    timestamp: new Date().toISOString(),
    features: {
      velocity_1h: Math.floor(Math.random() * 12),
      avg_spend: +(Math.random() * 300 + 50).toFixed(2),
      geo_distance: Math.floor(Math.random() * 5000),
      hour,
    },
    score: +score.toFixed(3),
    decision: score > 0.72 ? "BLOCKED" : score > 0.45 ? "REVIEW" : "APPROVED",
    latency: Math.floor(Math.random() * 120 + 40),
  };
}

// ── Stage colours / labels ──
const STAGES = [
  { id: "source", label: "Event Source", color: "#f97316", bg: "#1a0a00" },
  { id: "kafka", label: "Kafka Topic", color: "#eab308", bg: "#0f0e00" },
  { id: "flink", label: "Flink Job", color: "#22d3ee", bg: "#001418" },
  { id: "redis", label: "Redis Lookup", color: "#a78bfa", bg: "#0e0014" },
  { id: "ml", label: "ML Scorer (XGBoost)", color: "#34d399", bg: "#001209" },
  { id: "decision", label: "Decision Engine", color: "#f43f5e", bg: "#18000a" },
];

function DecisionBadge({ decision }) {
  const cfg = {
    APPROVED: {
      bg: "#052e16",
      border: "#16a34a",
      text: "#4ade80",
      dot: "#22c55e",
    },
    REVIEW: {
      bg: "#1c1a00",
      border: "#ca8a04",
      text: "#facc15",
      dot: "#eab308",
    },
    BLOCKED: {
      bg: "#1c0000",
      border: "#dc2626",
      text: "#f87171",
      dot: "#ef4444",
    },
  }[decision];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "monospace",
        letterSpacing: 1,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          display: "inline-block",
        }}
      />
      {decision}
    </span>
  );
}

function ScoreBar({ score }) {
  const pct = Math.round(score * 100);
  const color = score > 0.72 ? "#ef4444" : score > 0.45 ? "#eab308" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "#1e293b",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 99,
            transition: "width 0.5s ease",
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
      <span
        style={{ fontFamily: "monospace", fontSize: 12, color, minWidth: 36 }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Main Component ──
export default function FraudGuardSimulator() {
  const [transactions, setTransactions] = useState([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeStage, setStage] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    blocked: 0,
    review: 0,
    approved: 0,
    avgLatency: 0,
  });
  const [log, setLog] = useState([]);
  const counterRef = useRef(0);
  const timerRef = useRef(null);
  const logRef = useRef(null);

  const addLog = useCallback((msg, color = "#94a3b8") => {
    setLog((prev) => {
      const next = [
        {
          msg,
          color,
          t: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        },
        ...prev,
      ].slice(0, 60);
      return next;
    });
  }, []);

  const processTx = useCallback(async () => {
    const tx = randomTx(++counterRef.current);

    // Animate through stages
    const stageSequence = [
      "source",
      "kafka",
      "flink",
      "redis",
      "ml",
      "decision",
    ];
    for (const stage of stageSequence) {
      setStage(stage);
      await new Promise((r) => setTimeout(r, 90));
    }
    setStage(null);

    setTransactions((prev) => [tx, ...prev].slice(0, 200));
    setSelected(tx);

    setStats((prev) => {
      const total = prev.total + 1;
      const blocked = prev.blocked + (tx.decision === "BLOCKED" ? 1 : 0);
      const review = prev.review + (tx.decision === "REVIEW" ? 1 : 0);
      const approved = prev.approved + (tx.decision === "APPROVED" ? 1 : 0);
      const avgLatency = Math.round(
        (prev.avgLatency * (total - 1) + tx.latency) / total,
      );
      return { total, blocked, review, approved, avgLatency };
    });

    const decColor =
      tx.decision === "BLOCKED"
        ? "#f87171"
        : tx.decision === "REVIEW"
          ? "#facc15"
          : "#4ade80";
    addLog(
      `[${tx.id.toString().padStart(4, "0")}] ${tx.user_id} | ${tx.merchant.padEnd(12)} | $${tx.amount.toFixed(2).padStart(8)} | score=${(tx.score * 100).toFixed(0).padStart(3)}% | ${tx.decision} | ${tx.latency}ms`,
      decColor,
    );
  }, [addLog]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(processTx, 700);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running, processTx]);

  // Scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [log]);

  const fraudRate = stats.total
    ? ((stats.blocked / stats.total) * 100).toFixed(1)
    : "0.0";

  // ── Styles ──────────────────────────────────────────────────────────────────
  const root = {
    minHeight: "100vh",
    background: "#020817",
    color: "#e2e8f0",
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    padding: 0,
    margin: 0,
  };
  const header = {
    background: "linear-gradient(135deg,#0f172a 0%,#0c1a2e 100%)",
    borderBottom: "1px solid #1e3a5f",
    padding: "18px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  };
  const pill = (active, color = "#22d3ee") => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: active ? `${color}22` : "#0f172a",
    border: `1px solid ${active ? color : "#1e293b"}`,
    color: active ? color : "#475569",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: active ? `0 0 12px ${color}44` : "none",
  });
  const card = (extra = {}) => ({
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "16px 18px",
    ...extra,
  });
  const statCard = (color) => ({
    background: `${color}11`,
    border: `1px solid ${color}33`,
    borderRadius: 10,
    padding: "12px 16px",
    textAlign: "center",
  });

  return (
    <div style={root}>
      {/* ── Header ── */}
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg,#00c9a7,#0891b2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 0 16px #00c9a744",
            }}
          >
            🛡
          </div>
          <div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "#f8fafc",
                letterSpacing: 1,
              }}
            >
              FRAUDGUARD
            </div>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 2 }}>
              REAL-TIME PIPELINE SIMULATOR
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setRunning((r) => !r)}
            style={{
              ...pill(running, running ? "#ef4444" : "#22c55e"),
              cursor: "pointer",
              fontFamily: "inherit",
              border: "none",
              background: running ? "#2d0a0a" : "#0a2d18",
              color: running ? "#ef4444" : "#22c55e",
              border: `1px solid ${running ? "#ef4444" : "#22c55e"}`,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: running ? "0 0 14px #ef444444" : "0 0 14px #22c55e44",
            }}
          >
            {running ? "⏹ STOP" : "▶ START"} STREAM
          </button>
          <button
            onClick={processTx}
            style={{
              ...pill(false),
              cursor: "pointer",
              fontFamily: "inherit",
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#94a3b8",
              padding: "8px 14px",
              fontSize: 12,
            }}
          >
            ⚡ Single Tx
          </button>
          <button
            onClick={() => {
              setTransactions([]);
              setStats({
                total: 0,
                blocked: 0,
                review: 0,
                approved: 0,
                avgLatency: 0,
              });
              setLog([]);
              setSelected(null);
              counterRef.current = 0;
            }}
            style={{
              ...pill(false),
              cursor: "pointer",
              fontFamily: "inherit",
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#64748b",
              padding: "8px 14px",
              fontSize: 12,
            }}
          >
            🗑 Reset
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* ── Stats row ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5,1fr)",
            gap: 12,
          }}
        >
          {[
            { label: "Total Processed", value: stats.total, color: "#22d3ee" },
            { label: "✅ Approved", value: stats.approved, color: "#22c55e" },
            { label: "⚠️ Review", value: stats.review, color: "#eab308" },
            { label: "🚫 Blocked", value: stats.blocked, color: "#ef4444" },
            { label: "Fraud Rate", value: `${fraudRate}%`, color: "#f43f5e" },
          ].map((s) => (
            <div key={s.label} style={statCard(s.color)}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: s.color,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  marginTop: 3,
                  letterSpacing: 1,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Pipeline diagram ── */}
        <div style={card()}>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              letterSpacing: 2,
              marginBottom: 14,
            }}
          >
            PIPELINE STAGES
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              overflowX: "auto",
            }}
          >
            {STAGES.map((st, i) => {
              const active = activeStage === st.id;
              return (
                <div
                  key={st.id}
                  style={{ display: "flex", alignItems: "center", flex: 1 }}
                >
                  <div
                    style={{
                      flex: 1,
                      padding: "10px 8px",
                      borderRadius: 8,
                      textAlign: "center",
                      background: active ? st.bg : "#0a0f1a",
                      border: `1px solid ${active ? st.color : "#1e293b"}`,
                      boxShadow: active
                        ? `0 0 18px ${st.color}66, inset 0 0 12px ${st.color}22`
                        : "none",
                      transition: "all 0.15s",
                      minWidth: 90,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: active ? st.color : "#475569",
                        letterSpacing: 0.5,
                        lineHeight: 1.3,
                      }}
                    >
                      {st.label}
                    </div>
                    {active && (
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 20,
                            height: 3,
                            borderRadius: 99,
                            background: `linear-gradient(90deg,transparent,${st.color},transparent)`,
                            animation: "pulse 0.5s ease infinite",
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div
                      style={{
                        fontSize: 16,
                        color:
                          activeStage === STAGES[i + 1].id
                            ? STAGES[i + 1].color
                            : "#1e3a5f",
                        padding: "0 4px",
                        flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                    >
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* ── Transaction detail ── */}
          <div style={card()}>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                letterSpacing: 2,
                marginBottom: 14,
              }}
            >
              LAST TRANSACTION DETAIL
            </div>
            {selected ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ color: "#22d3ee", fontWeight: 700, fontSize: 14 }}
                  >
                    TX#{String(selected.id).padStart(4, "0")}
                  </span>
                  <DecisionBadge decision={selected.decision} />
                </div>

                {[
                  ["User", selected.user_id],
                  ["Merchant", selected.merchant],
                  ["Amount", `$${selected.amount.toFixed(2)}`],
                  ["Location", selected.city],
                  ["Device", selected.device],
                  [
                    "Time",
                    `${String(selected.hour).padStart(2, "0")}:xx local`,
                  ],
                  ["Latency", `${selected.latency}ms`],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #0f1f33",
                      paddingBottom: 6,
                    }}
                  >
                    <span style={{ color: "#475569", fontSize: 12 }}>{k}</span>
                    <span
                      style={{
                        color: "#e2e8f0",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}

                <div style={{ marginTop: 4 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 8,
                      letterSpacing: 1,
                    }}
                  >
                    FRAUD SCORE (XGBoost)
                  </div>
                  <ScoreBar score={selected.score} />
                </div>

                <div
                  style={{
                    background: "#0a0f1a",
                    borderRadius: 8,
                    padding: "10px 12px",
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      marginBottom: 6,
                      letterSpacing: 1,
                    }}
                  >
                    FEATURES USED
                  </div>
                  {Object.entries(selected.features).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: "#64748b", fontSize: 11 }}>
                        {k}
                      </span>
                      <span
                        style={{
                          color: "#a78bfa",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "#1e3a5f",
                  padding: "40px 0",
                  fontSize: 13,
                }}
              >
                Press START or ⚡ Single Tx to process a transaction
              </div>
            )}
          </div>

          {/* ── Live log ── */}
          <div style={card()}>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                letterSpacing: 2,
                marginBottom: 14,
              }}
            >
              KAFKA CONSUMER LOG
              <span
                style={{
                  marginLeft: 8,
                  color: running ? "#22c55e" : "#475569",
                  fontSize: 9,
                  letterSpacing: 1,
                }}
              >
                {running ? "● LIVE" : "○ PAUSED"}
              </span>
            </div>
            <div
              ref={logRef}
              style={{
                height: 320,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {log.length === 0 ? (
                <div
                  style={{
                    color: "#1e3a5f",
                    fontSize: 12,
                    textAlign: "center",
                    marginTop: 60,
                  }}
                >
                  No events yet...
                </div>
              ) : (
                log.map((l, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      color: l.color,
                      fontFamily: "monospace",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: i === 0 ? `${l.color}11` : "transparent",
                      borderLeft:
                        i === 0
                          ? `2px solid ${l.color}`
                          : "2px solid transparent",
                      transition: "all 0.2s",
                      opacity: Math.max(0.3, 1 - i * 0.018),
                    }}
                  >
                    <span style={{ color: "#334155", marginRight: 6 }}>
                      {l.t}
                    </span>
                    {l.msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Transaction table ── */}
        <div style={card()}>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              letterSpacing: 2,
              marginBottom: 14,
            }}
          >
            TRANSACTION STREAM — last {transactions.length} events
          </div>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  {[
                    "TX#",
                    "User",
                    "Merchant",
                    "Amount",
                    "City",
                    "Score",
                    "Decision",
                    "Latency",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "#475569",
                        fontWeight: 600,
                        padding: "6px 10px",
                        textAlign: "left",
                        letterSpacing: 1,
                        fontSize: 10,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 15).map((tx, i) => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelected(tx)}
                    style={{
                      borderBottom: "1px solid #0f1f33",
                      background:
                        selected?.id === tx.id
                          ? "#0d2137"
                          : i === 0
                            ? "#0a1628"
                            : "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    <td
                      style={{
                        padding: "7px 10px",
                        color: "#22d3ee",
                        fontWeight: 700,
                      }}
                    >
                      #{String(tx.id).padStart(4, "0")}
                    </td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>
                      {tx.user_id}
                    </td>
                    <td style={{ padding: "7px 10px", color: "#e2e8f0" }}>
                      {tx.merchant}
                    </td>
                    <td
                      style={{
                        padding: "7px 10px",
                        color: "#f8fafc",
                        fontWeight: 600,
                      }}
                    >
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: "7px 10px", color: "#64748b" }}>
                      {tx.city}
                    </td>
                    <td style={{ padding: "7px 10px", minWidth: 100 }}>
                      <ScoreBar score={tx.score} />
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <DecisionBadge decision={tx.decision} />
                    </td>
                    <td style={{ padding: "7px 10px", color: "#475569" }}>
                      {tx.latency}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#1e3a5f",
                  padding: "30px 0",
                  fontSize: 12,
                }}
              >
                Start the stream to see transactions flow through the
                pipeline...
              </div>
            )}
          </div>
        </div>

        {/* ── Architecture note ── */}
        <div
          style={{
            background: "#0a1628",
            border: "1px solid #1e3a5f",
            borderRadius: 10,
            padding: "14px 18px",
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 20, flexShrink: 0 }}>📐</div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#22d3ee",
                marginBottom: 4,
                letterSpacing: 1,
              }}
            >
              ABOUT THIS DEMO
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.7 }}>
              This simulator shows the{" "}
              <span style={{ color: "#22d3ee" }}>real-time path</span> of the
              FraudGuard architecture. Each transaction flows through:{" "}
              <span style={{ color: "#f97316" }}>Event Source</span> →{" "}
              <span style={{ color: "#eab308" }}>
                Kafka topic (payments.raw)
              </span>{" "}
              →{" "}
              <span style={{ color: "#22d3ee" }}>Flink feature extraction</span>{" "}
              → <span style={{ color: "#a78bfa" }}>Redis feature lookup</span> →{" "}
              <span style={{ color: "#34d399" }}>XGBoost ML scoring</span> →{" "}
              <span style={{ color: "#f43f5e" }}>
                Decision Engine (Block/Review/Approve)
              </span>
              . Score &gt;72% → BLOCKED. Score 45-72% → REVIEW. Score &lt;45% →
              APPROVED. Target latency: &lt;200ms.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:#0a0f1a; }
        ::-webkit-scrollbar-thumb { background:#1e3a5f; border-radius:99px; }
      `}</style>
    </div>
  );
}
