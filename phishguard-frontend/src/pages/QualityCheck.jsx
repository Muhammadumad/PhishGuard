import { useMemo, useState } from "react";

const DEFAULT_CHECKS = [
  "Theme readability",
  "Dashboard scan cards",
  "Bulk scan table clarity",
  "History filters and pagination",
  "Analytics chart readability",
  "Mobile sidebar behavior",
];

function createInitialState() {
  return {
    checks: DEFAULT_CHECKS,
    status: {},
  };
}

export default function QualityCheck() {
  const [state, setState] = useState(createInitialState);
  const [newCheck, setNewCheck] = useState("");

  const setCheckStatus = (label, value) => {
    setState((prev) => ({
      ...prev,
      status: {
        ...prev.status,
        [label]: value,
      },
    }));
  };

  const addCheck = () => {
    const label = newCheck.trim();
    if (!label || state.checks.includes(label)) return;
    setState((prev) => ({
      ...prev,
      checks: [...prev.checks, label],
    }));
    setNewCheck("");
  };

  const removeCheck = (label) => {
    setState((prev) => {
      const nextStatus = { ...prev.status };
      delete nextStatus[label];
      return {
        checks: prev.checks.filter((c) => c !== label),
        status: nextStatus,
      };
    });
  };

  const resetAll = () => {
    setState(createInitialState());
  };

  const complete = useMemo(
    () =>
      state.checks.filter(
        (c) => state.status[c] === "pass" || state.status[c] === "fail",
      ).length,
    [state],
  );

  const pass = useMemo(
    () => state.checks.filter((c) => state.status[c] === "pass").length,
    [state],
  );

  const fail = useMemo(
    () => state.checks.filter((c) => state.status[c] === "fail").length,
    [state],
  );

  const progress = state.checks.length
    ? Math.round((complete / state.checks.length) * 100)
    : 0;

  return (
    <main className="pg-main fade-up">
      <div
        className="pg-row-wrap"
        style={{ justifyContent: "flex-end", marginBottom: "14px" }}
      >
        <button className="pg-btn-ghost" onClick={resetAll}>
          Reset
        </button>
      </div>

      <section className="pg-card" style={{ marginBottom: "14px" }}>
        <div className="pg-row-wrap" style={{ marginBottom: "10px" }}>
          <span className="pg-pill pg-pill-clean">Pass: {pass}</span>
          <span className="pg-pill pg-pill-malicious">Fail: {fail}</span>
          <span className="pg-pill">
            Done: {complete}/{state.checks.length}
          </span>
        </div>
        <div className="pg-progress-track" style={{ height: "8px" }}>
          <div className="pg-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="pg-card" style={{ marginBottom: "14px" }}>
        <div className="pg-row-wrap">
          <input
            className="pg-input"
            placeholder="Add custom check"
            value={newCheck}
            onChange={(e) => setNewCheck(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCheck();
            }}
            style={{ flex: 1, minWidth: "240px" }}
          />
          <button className="pg-btn-ghost" onClick={addCheck}>
            Add
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "10px" }}>
        {state.checks.map((label) => {
          const status = state.status[label] || "pending";
          return (
            <article key={label} className="pg-card">
              <div
                className="pg-row-between"
                style={{
                  gap: "10px",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--display)",
                    color: "var(--text)",
                    fontSize: "14px",
                  }}
                >
                  {label}
                </div>
                <span
                  className={`pg-pill ${status === "pass" ? "pg-pill-clean" : status === "fail" ? "pg-pill-malicious" : ""}`}
                >
                  {status}
                </span>
              </div>

              <div className="pg-row-wrap">
                <button
                  className="pg-btn-ghost"
                  onClick={() => setCheckStatus(label, "pass")}
                >
                  Pass
                </button>
                <button
                  className="pg-btn-ghost"
                  onClick={() => setCheckStatus(label, "fail")}
                >
                  Fail
                </button>
                <button
                  className="pg-btn-ghost"
                  onClick={() => setCheckStatus(label, "pending")}
                >
                  Clear
                </button>
                <button
                  className="pg-btn-ghost"
                  onClick={() => removeCheck(label)}
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
