import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Plus, Trash2, ListChecks } from "lucide-react";

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
    status: {} as Record<string, string>,
  };
}

export default function QualityCheck() {
  const [state, setState] = useState(createInitialState);
  const [newCheck, setNewCheck] = useState("");

  const setCheckStatus = (label: string, value: string) => {
    setState((prev) => ({
      ...prev,
      status: { ...prev.status, [label]: value },
    }));
  };

  const addCheck = () => {
    const label = newCheck.trim();
    if (!label || state.checks.includes(label)) return;
    setState((prev) => ({ ...prev, checks: [...prev.checks, label] }));
    setNewCheck("");
  };

  const removeCheck = (label: string) => {
    setState((prev) => {
      const nextStatus = { ...prev.status };
      delete nextStatus[label];
      return { checks: prev.checks.filter((c) => c !== label), status: nextStatus };
    });
  };

  const resetAll = () => setState(createInitialState());

  const complete = useMemo(() => state.checks.filter((c) => state.status[c] === "pass" || state.status[c] === "fail").length, [state]);
  const pass = useMemo(() => state.checks.filter((c) => state.status[c] === "pass").length, [state]);
  const fail = useMemo(() => state.checks.filter((c) => state.status[c] === "fail").length, [state]);
  
  const progress = state.checks.length ? Math.round((complete / state.checks.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Checks</h1>
          <p className="text-muted-foreground mt-1">Track frontend UI and UX verification progress.</p>
        </div>
        <button onClick={resetAll} className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium text-sm transition-colors shadow-sm">
          <RotateCcw className="mr-2 h-4 w-4" /> Reset All
        </button>
      </div>

      {/* Progress Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Pass: {pass}
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
            <XCircle className="w-4 h-4 mr-1.5" /> Fail: {fail}
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-muted border border-border text-sm font-medium">
            <ListChecks className="w-4 h-4 mr-1.5 opacity-70" /> Done: {complete}/{state.checks.length}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Overall Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Add New Check */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4">
        <div className="flex gap-2">
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add a custom UI/UX check..."
            value={newCheck}
            onChange={(e) => setNewCheck(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCheck(); }}
          />
          <button 
            onClick={addCheck}
            disabled={!newCheck.trim()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <Plus className="w-4 h-4 mr-2" /> Add
          </button>
        </div>
      </div>

      {/* Checks List */}
      <div className="grid gap-3">
        {state.checks.map((label) => {
          const status = state.status[label] || "pending";
          const isPass = status === "pass";
          const isFail = status === "fail";
          
          return (
            <div key={label} className={`rounded-lg border bg-card p-4 transition-colors ${isPass ? 'border-emerald-500/30 bg-emerald-500/5' : isFail ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h3 className="font-medium text-sm sm:text-base">{label}</h3>
                
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isPass ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                  isFail ? "bg-destructive/10 text-destructive border-destructive/20" : 
                  "bg-muted text-muted-foreground border-border"
                }`}>
                  {status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCheckStatus(label, "pass")}
                  className={`inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors h-8 px-3 ${isPass ? 'bg-emerald-500 text-white' : 'border border-input bg-background hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30'}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Pass
                </button>
                <button
                  onClick={() => setCheckStatus(label, "fail")}
                  className={`inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors h-8 px-3 ${isFail ? 'bg-destructive text-white' : 'border border-input bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'}`}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Fail
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button
                  onClick={() => setCheckStatus(label, "pending")}
                  disabled={status === "pending"}
                  className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors h-8 px-3 text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  onClick={() => removeCheck(label)}
                  className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors h-8 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {state.checks.length === 0 && (
          <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20 text-muted-foreground text-sm">
            No checks defined. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
