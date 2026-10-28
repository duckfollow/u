import { updateApi, type Release } from "./update-client";
import Updates from "./Updates";
import { FlowRunner, type Progress, type LoopOutput } from "./runner";
import Dropdown from "./Dropdown";
import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowDown,
  Plus,
  Play,
  Square,
  ChevronRight,
  Workflow,
  Send,
  Clock,
  Settings2,
  Download,
  Upload,
  Trash2,
  ArrowUp,
  Check,
  Braces,
  Timer,
  GitBranch,
  Search,
  Radio,
  Repeat2,
  RefreshCw,
  PanelRight,
  LayoutGrid,
  RotateCcw,
  Globe,
} from "lucide-react";
import {
  seed,
  uid,
  request,
  send,
  variables,
  validateWorkspace,
  type Workspace,
  type RequestSpec,
  type Step,
  type Result,
} from "./model";
function load() {
  try {
    const raw = localStorage.getItem("u-workspace");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (validateWorkspace(parsed)) return parsed;
    }
  } catch {}
  return seed();
}
export default function App() {
  const [updateInfo, setUpdateInfo] = useState<Release | null>(null);
  const [appVersion, setAppVersion] = useState("");
  useEffect(() => {
    let active = true;
    async function startup() {
      try {
        const status = await updateApi("status");
        if (!active) return;
        setAppVersion(status.currentVersion);
        let cached: Release | null = null;
        try {
          cached = JSON.parse(
            localStorage.getItem("u-release-check") || "null",
          );
        } catch {}
        const fresh =
          cached &&
          cached.currentVersion === status.currentVersion &&
          cached.repository === status.repository &&
          cached.checkedAt &&
          Date.now() - Date.parse(cached.checkedAt) < 15 * 60 * 1000;
        const result = fresh ? cached : await updateApi("check");
        if (active) {
          setUpdateInfo(result);
          try {
            localStorage.setItem("u-release-check", JSON.stringify(result));
          } catch {}
        }
      } catch {
        /* Manual update checks show connection errors in Updates. */
      }
    }
    void startup();
    return () => {
      active = false;
    };
  }, []);
  const [w, setW] = useState<Workspace>(load),
    [view, setView] = useState("flows"),
    [flowId, setFlowId] = useState(w.flows[0]?.id),
    [reqId, setReqId] = useState(w.requests[0]?.id),
    [stepId, setStepId] = useState<string | undefined>(
      w.flows[0]?.steps[0]?.id,
    ),
    [tab, setTab] = useState("body"),
    [response, setResponse] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [outputs, setOutputs] = useState<Record<string, unknown>>({}),
    [states, setStates] = useState<Record<string, string>>({}),
    [next, setNext] = useState(0),
    [progress, setProgress] = useState<Record<string, Progress>>({}),
    [iteration, setIteration] = useState("all"),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [storageError, setStorageError] = useState(""),
    [pane, setPane] = useState<"canvas" | "details">("canvas"),
    [inspectorTab, setInspectorTab] = useState<"configure" | "output">(
      "configure",
    );
  const runnerRef = useRef<FlowRunner | null>(null);
  const abort = useRef<AbortController | null>(null),
    file = useRef<HTMLInputElement>(null);
  const flow = w.flows.find((f) => f.id === flowId),
    allSteps = flow?.steps.flatMap((s) => [s, ...(s.children ?? [])]) ?? [],
    step = allSteps.find((s) => s.id === stepId),
    parent = flow?.steps.find((s) => s.children?.some((c) => c.id === stepId)),
    siblings = parent?.children ?? flow?.steps ?? [],
    spec = w.requests.find((r) => r.id === reqId);
  function persist(value: Workspace) {
    setW(value);
    try {
      localStorage.setItem("u-workspace", JSON.stringify(value));
      setStorageError("");
    } catch {
      setStorageError(
        "Storage is full. Export your workspace to keep your changes.",
      );
    }
  }
  function reset() {
    runnerRef.current = null;
    setProgress({});
    setIteration("all");
    setOutputs({});
    setStates({});
    setNext(0);
    setError("");
  }
  function updateFlow(steps: Step[]) {
    if (!flow) return;
    persist({
      ...w,
      flows: w.flows.map((f) => (f.id === flow.id ? { ...f, steps } : f)),
    });
    reset();
  }
  function patchStep(patch: Partial<Step>) {
    if (step)
      updateFlow(
        flow!.steps.map((s) =>
          s.id === step.id
            ? { ...s, ...patch }
            : {
                ...s,
                ...(s.children
                  ? {
                      children: s.children.map((c) =>
                        c.id === step.id ? { ...c, ...patch } : c,
                      ),
                    }
                  : {}),
              },
        ),
      );
  }
  function patchRequest(patch: Partial<RequestSpec>) {
    if (view === "flows" && step)
      patchStep({ request: { ...step.request, ...patch } });
    else if (spec)
      persist({
        ...w,
        requests: w.requests.map((r) =>
          r.id === spec.id ? { ...r, ...patch } : r,
        ),
      });
  }
  async function sendRequest() {
    if (!spec) return;
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const result = await send(spec, variables(w), abort.current.signal);
      setResponse(result);
      persist({
        ...w,
        history: [
          {
            name: spec.name,
            method: spec.method,
            url: spec.url,
            status: result.status,
            time: new Date().toISOString(),
          },
          ...w.history,
        ].slice(0, 100),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function run(mode: "all" | "next" | "selected") {
    if (!flow?.steps.length) return;
    if (mode === "selected" && parent) {
      setError(
        "Use Next step to execute the next child in the current loop iteration.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setIteration("all");
    abort.current = new AbortController();
    let runner: FlowRunner | undefined;
    const sync = () => {
      if (!runner) return;
      const snapshot = runner.snapshot();
      setOutputs(snapshot.outputs);
      setStates(snapshot.states);
      setProgress(snapshot.progress);
      setNext(snapshot.next);
      if (snapshot.selectedId) setStepId(snapshot.selectedId);
    };
    try {
      const start =
        mode === "all"
          ? 0
          : mode === "selected"
            ? flow.steps.findIndex((s) => s.id === stepId)
            : next;
      runner =
        mode === "next" && runnerRef.current
          ? runnerRef.current
          : new FlowRunner(
              flow,
              variables(w),
              start,
              mode === "all" ? {} : outputs,
            );
      if (mode !== "all" && !(mode === "next" && runnerRef.current)) {
        for (const s of flow.steps.slice(0, start)) {
          if (states[s.id]) runner.states[s.id] = states[s.id];
          for (const c of s.children ?? [])
            if (states[c.id]) runner.states[c.id] = states[c.id];
        }
      }
      runnerRef.current = runner;
      runner.onUpdate = sync;
      sync();
      const selectedIndex = runner.next;
      do {
        await runner.tick(abort.current.signal);
        sync();
      } while (
        !runner.done &&
        (mode === "all" ||
          (mode === "selected" && runner.next === selectedIndex))
      );
    } catch (e) {
      sync();
      runnerRef.current = null;
      setError(
        (e as Error).name === "AbortError"
          ? "Run stopped. Next step will restart the interrupted loop."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function addStep(kind: Step["kind"], parentId?: string) {
    if (!flow || (parentId && kind === "loop")) return;
    const id = "step_" + uid().slice(0, 8);
    const child: Step = {
      id,
      name: {
        request: "HTTP request",
        transform: "Transform data",
        condition: "Check condition",
        delay: "Wait",
        loop: "For each item",
      }[kind],
      kind,
      request: request(),
      value:
        kind === "loop"
          ? '[{"name":"Mark VII"},{"name":"House Party"}]'
          : kind === "delay"
            ? "1000"
            : kind === "condition"
              ? "true"
              : parentId
                ? "{{loop.item}}"
                : "{}",
      ...(kind === "loop"
        ? {
            loop: { maxIterations: 50, errorMode: "stop" },
            children: [
              {
                id: "item_" + uid().slice(0, 8),
                name: "Process item",
                kind: "transform",
                request: request(),
                value: "{{loop.item}}",
              },
            ],
          }
        : {}),
    };
    updateFlow(
      parentId
        ? flow.steps.map((s) =>
            s.id === parentId
              ? { ...s, children: [...(s.children ?? []), child] }
              : s,
          )
        : [...flow.steps, child],
    );
    setStepId(id);
    setPane("details");
    setInspectorTab("configure");
  }
  function removeStep() {
    if (!flow || !step) return;
    const remaining = siblings.filter((s) => s.id !== step.id);
    updateFlow(
      parent
        ? flow.steps.map((s) =>
            s.id === parent.id ? { ...s, children: remaining } : s,
          )
        : remaining,
    );
    setStepId(remaining[0]?.id ?? parent?.id);
  }
  function moveStep(delta: number) {
    if (!flow || !step) return;
    const steps = [...siblings],
      i = steps.indexOf(step);
    if (i + delta < 0 || i + delta >= steps.length) return;
    [steps[i], steps[i + delta]] = [steps[i + delta], steps[i]];
    updateFlow(
      parent
        ? flow.steps.map((s) =>
            s.id === parent.id ? { ...s, children: steps } : s,
          )
        : steps,
    );
  }
  function renderStep(s: Step, index: number, child = false) {
    const Icon =
      s.kind === "loop"
        ? Repeat2
        : s.kind === "request"
          ? Send
          : s.kind === "delay"
            ? Timer
            : s.kind === "condition"
              ? GitBranch
              : Braces;
    return (
      <React.Fragment key={s.id}>
        <button
          disabled={busy}
          aria-label={`Configure ${child ? "loop child" : "step"} ${index + 1}: ${s.name}`}
          className={`step-card ${s.kind === "loop" ? "loop-card" : ""} ${stepId === s.id ? "focused" : ""} ${states[s.id] || ""}`}
          onClick={() => {
            setStepId(s.id);
            setIteration("all");
            setPane("details");
            setInspectorTab("configure");
          }}
        >
          <div className={`step-icon ${s.kind}`}>
            <Icon size={20} />
          </div>
          <div className="step-info">
            <small>
              {child ? "LOOP STEP" : "STEP"}{" "}
              {String(index + 1).padStart(2, "0")}
              <span>{states[s.id] || "ready"}</span>
            </small>
            <strong>{s.name}</strong>
            <p>
              {s.kind === "loop"
                ? `${s.children?.length ?? 0} steps · ${s.loop?.mode === "repeat" ? "Repeat process" : "For each item"}`
                : s.kind === "request"
                  ? `${s.request.method} · ${s.request.url}`
                  : s.kind === "transform"
                    ? "Shape your response data"
                    : s.kind === "condition"
                      ? "Continue when true"
                      : "Pause before continuing"}
            </p>
          </div>
          {states[s.id] === "success" ? (
            <Check size={17} className="green" />
          ) : (
            <ChevronRight size={15} />
          )}
        </button>
        {s.kind === "loop" && (
          <div className="loop-group">
            <div className="loop-group-heading">
              <Repeat2 size={13} />
              <span>
                {s.loop?.mode === "repeat" ? "REPEAT PROCESS" : "FOR EACH ITEM"}
              </span>
              <strong role="status">
                {progress[s.id]
                  ? `${progress[s.id].completed} / ${progress[s.id].total}`
                  : "Sequential"}
              </strong>
            </div>
            {progress[s.id] && (
              <progress
                aria-label="Loop progress"
                value={progress[s.id].completed}
                max={Math.max(1, progress[s.id].total)}
              />
            )}
            {s.children?.map((c, i) => (
              <div className="loop-child" key={c.id}>
                {renderStep(c, i, true)}
              </div>
            ))}
            <div className="loop-add">
              {(["request", "transform", "condition", "delay"] as const).map(
                (k) => (
                  <button
                    key={k}
                    disabled={busy}
                    onClick={() => addStep(k, s.id)}
                  >
                    <Plus size={11} />
                    {k}
                  </button>
                ),
              )}
            </div>
            <span className="loop-end">Collect results → next step</span>
          </div>
        )}
        {!child && (
          <div className="connector">
            <ArrowDown size={12} />
          </div>
        )}
      </React.Fragment>
    );
  }
  function createItem() {
    if (view === "requests") {
      const r = request();
      persist({ ...w, requests: [...w.requests, r] });
      setReqId(r.id);
      setResponse(null);
    } else {
      const f = { id: uid(), name: "Untitled flow", steps: [] };
      persist({ ...w, flows: [...w.flows, f] });
      setFlowId(f.id);
      setStepId(undefined);
      setView("flows");
      setPane("canvas");
      reset();
    }
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(w, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "u-workspace.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Workspace exported — includes environment values and tokens.");
  }
  async function importData(f: File) {
    try {
      if (f.size > 5_000_000) throw Error("Import is limited to 5 MB");
      const value = JSON.parse(await f.text());
      if (!validateWorkspace(value)) throw Error("Invalid u workspace");
      persist(value);
      setFlowId(value.flows[0]?.id);
      setStepId(value.flows[0]?.steps[0]?.id);
      setReqId(value.requests[0]?.id);
      reset();
      setNotice("Workspace imported");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const active = view === "flows" ? step?.request : spec;
  function editor() {
    return (
      active && (
        <>
          <div className="request-line">
            <Dropdown
              label="HTTP method"
              variant="method"
              disabled={busy}
              value={active.method}
              onChange={(method) => patchRequest({ method })}
              options={Object.entries({
                GET: "Retrieve a resource",
                POST: "Create a resource",
                PUT: "Replace a resource",
                PATCH: "Update a resource",
                DELETE: "Delete a resource",
                HEAD: "Retrieve headers only",
                OPTIONS: "Inspect allowed methods",
              }).map(([value, description]) => ({
                value,
                label: value,
                description,
              }))}
            />

            <input
              disabled={busy}
              aria-label="Request URL"
              value={active.url}
              onChange={(e) => patchRequest({ url: e.target.value })}
            />
            {view === "requests" && (
              <button className="primary" disabled={busy} onClick={sendRequest}>
                <Send size={14} />
                Send
              </button>
            )}
          </div>
          <div className="tabs">
            {["body", "headers", "auth"].map((t) => (
              <button
                className={tab === t ? "selected" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t === "auth"
                  ? "Authorization"
                  : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <label className="field-label">
            {tab === "auth"
              ? "Bearer token · variables supported"
              : tab === "headers"
                ? "Headers · JSON object"
                : "Request body · raw text / JSON"}
          </label>
          {tab === "auth" ? (
            <input
              className="wide"
              disabled={busy}
              aria-label="Bearer token"
              type="password"
              value={active.auth}
              onChange={(e) => patchRequest({ auth: e.target.value })}
              placeholder="{{token}}"
            />
          ) : (
            <textarea
              disabled={busy}
              aria-label={
                tab === "headers" ? "Request headers" : "Request body"
              }
              spellCheck={false}
              value={tab === "headers" ? active.headers : active.body}
              onChange={(e) => patchRequest({ [tab]: e.target.value })}
              placeholder={tab === "body" ? "Enter a request body…" : "{}"}
            />
          )}
        </>
      )
    );
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            u<span>•</span>
          </div>
          <div>
            <strong>u</strong>
            <small>API STUDIO</small>
          </div>
        </div>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            Stark workspace<small>Local workspace</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <div className="search">
          <Search size={14} />
          <input
            placeholder="Find in workspace"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <nav>
          {[
            { id: "requests", icon: Send, label: "Collections" },
            { id: "flows", icon: Workflow, label: "Flows" },
            { id: "history", icon: Clock, label: "History" },
            { id: "environments", icon: Settings2, label: "Environments" },
          ].map((n) => (
            <button
              title={n.label}
              aria-label={n.label}
              disabled={busy}
              className={view === n.id ? "active" : ""}
              key={n.id}
              onClick={() => {
                setView(n.id);
                setError("");
              }}
            >
              <n.icon size={17} />
              <span className="nav-label">{n.label}</span>
              {n.id === "flows" && (
                <span className="count">{w.flows.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="section-heading">
          {view === "requests" ? "COLLECTIONS" : "YOUR FLOWS"}
          <button title="Create new" disabled={busy} onClick={createItem}>
            <Plus size={15} />
          </button>
        </div>
        <div className="items">
          {view === "requests"
            ? w.requests
                .filter((r) =>
                  r.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((r) => (
                  <button
                    disabled={busy}
                    className={reqId === r.id ? "chosen" : ""}
                    key={r.id}
                    onClick={() => {
                      setReqId(r.id);
                      setResponse(null);
                    }}
                  >
                    <span className="method">{r.method}</span>
                    {r.name}
                  </button>
                ))
            : w.flows
                .filter((f) =>
                  f.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((f) => (
                  <button
                    disabled={busy}
                    className={flowId === f.id ? "chosen" : ""}
                    key={f.id}
                    onClick={() => {
                      setFlowId(f.id);
                      setStepId(f.steps[0]?.id);
                      setView("flows");
                      reset();
                    }}
                  >
                    <Workflow size={15} />
                    {f.name}
                  </button>
                ))}
        </div>
        <div className="sidebar-bottom">
          <div className="bot">
            <span className="eyes">▰ ▰</span>
            <i />
          </div>
          <strong>Your workshop, connected.</strong>
          <p>
            Build, test, and connect APIs
            <br />
            from one quiet workspace.
          </p>
          <div className="transfer">
            <button disabled={busy} onClick={() => file.current?.click()}>
              <Upload size={13} />
              Import
            </button>
            <button onClick={exportData}>
              <Download size={13} />
              Export
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="sidebar-update-footer">
          <button
            className={`sidebar-update-button ${view === "updates" ? "active" : ""}`}
            aria-label="Updates"
            aria-current={view === "updates" ? "page" : undefined}
            title={`Updates${appVersion ? ` · v${appVersion}` : ""}${updateInfo?.state === "available" ? ` · New version ${updateInfo.latestVersion}` : ""}`}
            disabled={busy}
            onClick={() => {
              setView("updates");
              setError("");
            }}
          >
            <RefreshCw size={16} />
            <span className="update-footer-label">Updates</span>
            <span className="update-footer-version">
              {appVersion ? `v${appVersion}` : "…"}
            </span>
            {updateInfo?.state === "available" && (
              <span
                className="update-nav-badge"
                aria-label={`Version ${updateInfo.latestVersion} available`}
              >
                New
              </span>
            )}
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>
              {view === "requests"
                ? "Collections"
                : view[0].toUpperCase() + view.slice(1)}
            </span>
          </div>
          <div className="header-right">
            <span className="local-dot" />
            Saved locally
            <Dropdown
              label="Active environment"
              variant="environment"
              disabled={busy}
              value={w.environment}
              onChange={(environment) => {
                persist({ ...w, environment });
                reset();
              }}
              options={Object.keys(w.environments).map((env) => ({
                value: env,
                label: env,
                description:
                  env === "Local"
                    ? "APIs on your machine"
                    : env === "Development"
                      ? "Development & testing"
                      : env === "Production"
                        ? "Live environment"
                        : "Workspace environment",
              }))}
            />
          </div>
        </header>
        {(view === "flows" || view === "requests") && (
          <div className="compact-switcher">
            <Dropdown
              label={view === "flows" ? "Select flow" : "Select request"}
              disabled={busy}
              value={view === "flows" ? flowId : reqId}
              onChange={(value) => {
                if (view === "flows") {
                  setFlowId(value);
                  setStepId(w.flows.find((f) => f.id === value)?.steps[0]?.id);
                  setPane("canvas");
                  reset();
                } else {
                  setReqId(value);
                  setResponse(null);
                }
              }}
              options={(view === "flows" ? w.flows : w.requests).map(
                (item) => ({ value: item.id, label: item.name }),
              )}
            />

            <button disabled={busy} onClick={createItem}>
              <Plus size={14} />
              New {view === "flows" ? "flow" : "request"}
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {storageError && (
          <div role="alert" className="alert">
            {storageError}
          </div>
        )}
        {notice && (
          <div className="notice" onClick={() => setNotice("")}>
            {notice} ×
          </div>
        )}
        {view === "flows" && flow && (
          <>
            <div className="page-title">
              <div>
                <div className="eyebrow">
                  <Workflow size={13} /> FLOW STUDIO
                </div>
                <input
                  className="title-input"
                  aria-label="Flow name"
                  disabled={busy}
                  value={flow.name}
                  onChange={(e) =>
                    persist({
                      ...w,
                      flows: w.flows.map((f) =>
                        f.id === flow.id ? { ...f, name: e.target.value } : f,
                      ),
                    })
                  }
                />
                <p>Connect your requests. Let the workflow do the rest.</p>
              </div>
              <div className="actions">
                <button disabled={busy} onClick={reset}>
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  disabled={busy || next >= flow.steps.length}
                  onClick={() => void run("next")}
                >
                  <Play size={14} />
                  Next step
                </button>
                {busy ? (
                  <button
                    className="primary"
                    onClick={() => abort.current?.abort()}
                  >
                    <Square size={13} />
                    Stop
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={!flow.steps.length}
                    onClick={() => void run("all")}
                  >
                    <Play size={14} />
                    Run flow
                  </button>
                )}
              </div>
            </div>
            <div className="flow-toolbar">
              <div
                className="workspace-tabs"
                role="tablist"
                aria-label="Flow workspace"
              >
                <button
                  role="tab"
                  aria-selected={pane === "canvas"}
                  onClick={() => setPane("canvas")}
                >
                  <LayoutGrid size={15} />
                  Overview <span>{flow.steps.length}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={pane === "details"}
                  onClick={() => setPane("details")}
                >
                  <PanelRight size={15} />
                  Step details
                </button>
              </div>
              <span className="flow-summary" role="status" aria-live="polite">
                <span className={busy ? "running-dot" : "local-dot"} />
                {busy
                  ? "Running workflow"
                  : Object.values(states).includes("error")
                    ? "Needs attention"
                    : flow.steps.length > 0 && next >= flow.steps.length
                      ? "Run completed"
                      : Object.values(states).includes("paused")
                        ? "Paused in loop"
                        : "Ready to run"}
              </span>
            </div>
            <div className={`flow-layout pane-${pane}`}>
              <section className="canvas">
                <div className="canvas-label">
                  <span className="canvas-caption">WORKFLOW OVERVIEW</span>
                  <span>Execute from top to bottom</span>
                </div>
                <div className="step-list">
                  <div className="trigger">
                    <Radio size={14} />
                    Manual trigger<span>Start</span>
                  </div>
                  <div className="connector" />
                  {flow.steps.map((s, index) => renderStep(s, index))}
                  <div className="add-step">
                    <span>
                      <Plus size={15} /> Add your next step
                    </span>
                    {(
                      [
                        "request",
                        "transform",
                        "condition",
                        "delay",
                        "loop",
                      ] as const
                    ).map((k) => (
                      <button
                        disabled={busy}
                        key={k}
                        onClick={() => addStep(k)}
                      >
                        <Plus size={12} />
                        {
                          {
                            request: "HTTP request",
                            transform: "Transform",
                            condition: "Condition",
                            delay: "Delay",
                            loop: "Loop",
                          }[k]
                        }
                      </button>
                    ))}
                  </div>
                </div>
                <div className="canvas-footer">
                  <span className="local-dot" />{" "}
                  {busy
                    ? "Flow running…"
                    : next >= flow.steps.length && flow.steps.length
                      ? "Flow complete"
                      : Object.values(states).includes("paused")
                        ? "Paused in loop"
                        : "Ready to run"}
                  <span>
                    {
                      flow.steps.filter((s) =>
                        ["success", "warning"].includes(states[s.id]),
                      ).length
                    }{" "}
                    / {flow.steps.length} steps completed
                  </span>
                </div>
              </section>
              <section className="inspector">
                {step ? (
                  <>
                    <div className="inspector-title">
                      <div>
                        <span className="inspector-kicker">STEP DETAILS</span>
                        <strong>{step.name}</strong>
                      </div>
                      <button
                        title="Delete step"
                        disabled={busy}
                        onClick={removeStep}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="inspector-navigation">
                      <label htmlFor="step-select">Selected step</label>
                      <Dropdown
                        id="step-select"
                        label="Selected step"
                        variant="step"
                        disabled={busy}
                        value={step.id}
                        onChange={(value) => {
                          setStepId(value);
                          setIteration("all");
                        }}
                        options={allSteps.map((s, i) => ({
                          value: s.id,
                          label: `${String(i + 1).padStart(2, "0")} · ${s.name}`,
                          description: {
                            request: "HTTP request",
                            transform: "Transform data",
                            condition: "Condition",
                            delay: "Delay",
                            loop: "Loop",
                          }[s.kind],
                        }))}
                      />
                    </div>
                    <div
                      className="inspector-tabs"
                      role="tablist"
                      aria-label="Step panel"
                    >
                      <button
                        role="tab"
                        aria-selected={inspectorTab === "configure"}
                        onClick={() => setInspectorTab("configure")}
                      >
                        <Settings2 size={14} />
                        Configure
                      </button>
                      <button
                        role="tab"
                        aria-selected={inspectorTab === "output"}
                        onClick={() => setInspectorTab("output")}
                      >
                        <Braces size={14} />
                        Output{" "}
                        {Object.hasOwn(outputs, step.id) && (
                          <span className="result-dot" />
                        )}
                      </button>
                    </div>
                    {inspectorTab === "configure" ? (
                      <div className="inspector-body">
                        <label className="field-label">STEP NAME</label>
                        <input
                          disabled={busy}
                          aria-label="Step name"
                          className="wide"
                          value={step.name}
                          onChange={(e) => patchStep({ name: e.target.value })}
                        />
                        <div className="step-meta">
                          <code>{step.id}</code>
                          <div>
                            <button
                              title="Move up"
                              disabled={busy || siblings.indexOf(step) === 0}
                              onClick={() => moveStep(-1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              title="Move down"
                              disabled={
                                busy ||
                                siblings.indexOf(step) === siblings.length - 1
                              }
                              onClick={() => moveStep(1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </div>
                        {parent && (
                          <div className="loop-context">
                            <Repeat2 size={14} />
                            <span>
                              Inside <strong>{parent.name}</strong>. Use{" "}
                              <code>{"{{loop.item}}"}</code> and{" "}
                              <code>{"{{loop.index}}"}</code> (starts at 0).
                              Next step executes one child at a time.
                            </span>
                          </div>
                        )}
                        {step.kind === "loop" ? (
                          <div className="loop-settings">
                            <label className="field-label">LOOP MODE</label>
                            <Dropdown
                              label="Loop mode"
                              disabled={busy}
                              value={step.loop!.mode ?? "each"}
                              onChange={(mode) =>
                                patchStep({
                                  loop: {
                                    ...step.loop!,
                                    mode: mode as "each" | "repeat",
                                  },
                                  value:
                                    mode === "repeat"
                                      ? "3"
                                      : '[{"name":"Mark VII"},{"name":"House Party"}]',
                                  name: [
                                    "For each item",
                                    "Repeat process",
                                  ].includes(step.name)
                                    ? mode === "repeat"
                                      ? "Repeat process"
                                      : "For each item"
                                    : step.name,
                                })
                              }
                              options={[
                                {
                                  value: "each",
                                  label: "For each item",
                                  description:
                                    "Run the process for every item in an Array",
                                },
                                {
                                  value: "repeat",
                                  label: "Repeat N times",
                                  description:
                                    "Repeat HTTP requests and steps a fixed number of rounds",
                                },
                              ]}
                            />

                            <label
                              className="field-label"
                              htmlFor="loop-source"
                            >
                              {step.loop?.mode === "repeat"
                                ? "NUMBER OF ROUNDS"
                                : "ARRAY TO LOOP OVER"}
                            </label>
                            {step.loop?.mode === "repeat" ? (
                              <input
                                id="loop-source"
                                className="wide"
                                aria-label="Number of rounds"
                                disabled={busy}
                                value={step.value}
                                onChange={(e) =>
                                  patchStep({ value: e.target.value })
                                }
                                placeholder="3 or {{rounds}}"
                              />
                            ) : (
                              <textarea
                                id="loop-source"
                                disabled={busy}
                                value={step.value}
                                onChange={(e) =>
                                  patchStep({ value: e.target.value })
                                }
                                placeholder="{{steps.projects.body.projects}}"
                              />
                            )}
                            <p className="loop-help">
                              {step.loop?.mode === "repeat"
                                ? "Run every step in this group once per round. Use {{loop.number}} for the round number (starts at 1). Zero rounds skips the process."
                                : "Use an Array from a previous step or enter a JSON Array. An empty Array skips the loop."}
                            </p>
                            <label className="field-label" htmlFor="loop-limit">
                              {step.loop?.mode === "repeat"
                                ? "MAXIMUM ROUNDS (1–100)"
                                : "MAXIMUM ITEMS (1–100)"}
                            </label>
                            <input
                              id="loop-limit"
                              className="wide"
                              type="number"
                              min="1"
                              max="100"
                              disabled={busy}
                              value={step.loop!.maxIterations}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                if (
                                  Number.isInteger(value) &&
                                  value >= 1 &&
                                  value <= 100
                                )
                                  patchStep({
                                    loop: {
                                      ...step.loop!,
                                      maxIterations: value,
                                    },
                                  });
                              }}
                            />
                            <label className="field-label">
                              IF AN ITEM FAILS
                            </label>
                            <Dropdown
                              label="Loop error behavior"
                              disabled={busy}
                              value={step.loop!.errorMode}
                              onChange={(value) =>
                                patchStep({
                                  loop: {
                                    ...step.loop!,
                                    errorMode: value as "stop" | "continue",
                                  },
                                })
                              }
                              options={[
                                {
                                  value: "stop",
                                  label: "Stop the flow",
                                  description:
                                    "Keep the error and completed results",
                                },
                                {
                                  value: "continue",
                                  label: "Continue with the next item",
                                  description:
                                    "Record the error, then skip this item",
                                },
                              ]}
                            />
                            <div className="loop-children-editor">
                              <label className="field-label">
                                STEPS INSIDE THIS LOOP
                              </label>
                              {step.children?.map((c, i) => (
                                <button
                                  key={c.id}
                                  disabled={busy}
                                  onClick={() => {
                                    setStepId(c.id);
                                    setIteration("all");
                                  }}
                                >
                                  <span>{String(i + 1).padStart(2, "0")}</span>
                                  {c.name}
                                  <ChevronRight size={13} />
                                </button>
                              ))}
                              <div className="loop-add">
                                {(
                                  [
                                    "request",
                                    "transform",
                                    "condition",
                                    "delay",
                                  ] as const
                                ).map((k) => (
                                  <button
                                    disabled={busy}
                                    key={k}
                                    onClick={() => addStep(k, step.id)}
                                  >
                                    <Plus size={11} />
                                    {k}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : step.kind === "request" ? (
                          editor()
                        ) : (
                          <>
                            <label className="field-label">
                              {step.kind === "delay"
                                ? "Delay in milliseconds"
                                : step.kind === "condition"
                                  ? "Boolean value · false stops the flow"
                                  : "Value / JSON / variable reference"}
                            </label>
                            <textarea
                              disabled={busy}
                              aria-label="Step value"
                              value={step.value}
                              onChange={(e) =>
                                patchStep({ value: e.target.value })
                              }
                            />
                          </>
                        )}
                        <div className="hint">
                          <Braces size={15} />
                          <span>
                            Use environment values like{" "}
                            <code>{"{{baseUrl}}"}</code> or a previous step’s
                            output.
                          </span>
                        </div>
                        <button
                          className="run-step"
                          disabled={busy || !!parent}
                          onClick={() => {
                            setInspectorTab("output");
                            void run("selected");
                          }}
                        >
                          <Play size={13} />
                          {step.kind === "loop"
                            ? "Run loop"
                            : parent
                              ? "Use Next step to run this child"
                              : "Run this step"}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="output-panel">
                        <div className="output-title">
                          <span>STEP OUTPUT</span>{" "}
                          <span>{states[step.id] || "Not run yet"}</span>
                        </div>
                        {(step.kind === "loop" || parent) &&
                          (() => {
                            const loopId = parent?.id ?? step.id;
                            const result = outputs[loopId] as
                              LoopOutput | undefined;
                            return result &&
                              (result.iterations.length || result.current) ? (
                              <Dropdown
                                label="Inspect loop iteration"
                                value={iteration}
                                onChange={setIteration}
                                options={[
                                  {
                                    value: "all",
                                    label: "All iterations",
                                    description: `${result.completed} / ${result.total} completed`,
                                  },
                                  ...(result.current
                                    ? [
                                        {
                                          value: "current",
                                          label: `Current item ${result.current.index + 1}`,
                                          description:
                                            "Steps executed in this iteration so far",
                                        },
                                      ]
                                    : []),
                                  ...result.iterations.map((r, i) => ({
                                    value: String(i),
                                    label: `${(parent ?? step).loop?.mode === "repeat" ? "Round" : "Item"} ${r.index + 1} · ${r.status}`,
                                    description:
                                      r.error ?? "View this iteration’s output",
                                  })),
                                ]}
                              />
                            ) : null;
                          })()}
                        <pre className="output">
                          {(() => {
                            const result = outputs[parent?.id ?? step.id] as
                              LoopOutput | undefined;
                            if ((step.kind === "loop" || parent) && result) {
                              if (iteration === "current" && result.current)
                                return JSON.stringify(
                                  parent
                                    ? (result.current.steps[step.id] ??
                                        "Not executed in this iteration")
                                    : result.current,
                                  null,
                                  2,
                                );
                              const selected =
                                result.iterations?.[Number(iteration)];
                              if (iteration !== "all" && selected)
                                return JSON.stringify(
                                  parent
                                    ? (selected.steps[step.id] ?? {
                                        status: selected.status,
                                        error:
                                          selected.error ?? "Step was skipped",
                                      })
                                    : selected,
                                  null,
                                  2,
                                );
                              return JSON.stringify(
                                parent
                                  ? {
                                      current: result.current
                                        ? {
                                            index: result.current.index,
                                            output:
                                              result.current.steps[step.id],
                                          }
                                        : undefined,
                                      iterations: result.iterations.map(
                                        (r) => ({
                                          index: r.index,
                                          status: r.status,
                                          output: r.steps[step.id],
                                          error: r.error,
                                        }),
                                      ),
                                    }
                                  : result,
                                null,
                                2,
                              );
                            }
                            return Object.hasOwn(outputs, step.id)
                              ? JSON.stringify(outputs[step.id], null, 2)
                              : "Run this step to see its output.\n\nResults stay here while you build.";
                          })()}
                        </pre>
                        {!parent && !Object.hasOwn(outputs, step.id) && (
                          <button
                            className="run-step"
                            disabled={busy}
                            onClick={() => void run("selected")}
                          >
                            <Play size={14} />
                            Run this step
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty">
                    <Workflow size={30} />
                    <h3>Build something useful.</h3>
                    <p>Add your first step to get started.</p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        {view === "requests" && (
          <>
            <div className="page-title">
              <div>
                <div className="eyebrow">
                  <Send size={13} /> API CLIENT
                </div>
                <h1>API collections</h1>
                <p>Your endpoints, all in one place.</p>
              </div>
            </div>
            {spec ? (
              <div className="request-page">
                <input
                  className="title-input"
                  aria-label="Request name"
                  disabled={busy}
                  value={spec.name}
                  onChange={(e) => patchRequest({ name: e.target.value })}
                />
                {editor()}
                {busy && (
                  <button onClick={() => abort.current?.abort()}>
                    Stop request
                  </button>
                )}
                <div className="output-title">
                  RESPONSE{" "}
                  {response && (
                    <span className={response.status < 400 ? "green" : ""}>
                      {response.status} {response.statusText} ·{" "}
                      {response.duration} ms · {response.size} bytes
                    </span>
                  )}
                </div>
                {response ? (
                  <>
                    <details>
                      <summary>Response headers</summary>
                      <pre>{JSON.stringify(response.headers, null, 2)}</pre>
                    </details>
                    <pre>
                      {typeof response.body === "string"
                        ? response.body
                        : JSON.stringify(response.body, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div className="empty">
                    <Send size={28} />
                    <p>Send a request to inspect its response.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty">Create a request with the + button.</div>
            )}
          </>
        )}
        {view === "environments" && (
          <>
            <div className="page-title">
              <div>
                <div className="eyebrow">
                  <Globe size={13} /> ENVIRONMENTS
                </div>
                <h1>Environments</h1>
                <p>
                  Variables are stored on this device. Export files include
                  these values.
                </p>
              </div>
            </div>
            <div className="request-page">
              <label className="field-label">
                {w.environment} · JSON VARIABLES
              </label>
              <textarea
                aria-label="Environment variables"
                className="env-editor"
                spellCheck={false}
                value={w.environments[w.environment]}
                onChange={(e) => {
                  persist({
                    ...w,
                    environments: {
                      ...w.environments,
                      [w.environment]: e.target.value,
                    },
                  });
                  reset();
                }}
              />
              <div className="hint">
                Reference a value with {"{{baseUrl}}"}. Environment JSON is
                validated when a request runs.
              </div>
            </div>
          </>
        )}
        {view === "history" && (
          <>
            <div className="page-title">
              <div>
                <div className="eyebrow">
                  <Clock size={13} /> ACTIVITY
                </div>
                <h1>Request history</h1>
                <p>Your latest 100 requests.</p>
              </div>
              <button onClick={() => persist({ ...w, history: [] })}>
                Clear history
              </button>
            </div>
            <div className="history">
              {!w.history.length ? (
                <div className="empty">
                  <Clock size={28} />
                  <p>Your request history will appear here.</p>
                </div>
              ) : (
                w.history.map((h, i) => (
                  <div className="history-row" key={i}>
                    <span className="method">{h.method}</span>
                    <div>
                      <strong>{h.name}</strong>
                      <small>{h.url}</small>
                    </div>
                    <span className={h.status < 400 ? "green" : ""}>
                      {h.status}
                    </span>
                    <time>{new Date(h.time).toLocaleString()}</time>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        {view === "updates" && (
          <Updates
            onBusy={setBusy}
            initialRelease={updateInfo}
            onChecked={setUpdateInfo}
          />
        )}
        <footer>
          <span>
            <span className="local-dot" /> Local connection
          </span>
          <span>
            u API Studio<span className="footer-u">u.</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
