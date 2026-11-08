import { useEffect, useRef, useState } from "react";
import { X, ShieldCheck, FolderOpen, ChevronRight, ArrowLeft, RotateCcw, Braces } from "lucide-react";
import { examplePacks, packCounts, type ExamplePackId } from "./example-packs";
import { resetExampleDemoData } from "./example-demo";
import { authExamples } from "./auth-examples";

export default function AuthExamples({ onClose, onAdd }: { onClose: () => void; onAdd: (id: ExamplePackId) => void }) {
  const [selected, setSelected] = useState<ExamplePackId | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetNotice, setResetNotice] = useState("");
  const pack = examplePacks.find(p => p.id === selected);
  const counts = pack ? packCounts(pack) : undefined;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="auth-examples-dialog" onCancel={onClose} onClick={e => {
    if (e.target !== dialog.current) return;
    const rect = dialog.current.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose();
  }} aria-labelledby="auth-examples-title">
    <div className="auth-examples-heading">
      <div><h2 id="auth-examples-title"><FolderOpen size={20} /> Examples</h2><p>Browse example collections and add them to your workspace.</p></div>
      <button onClick={onClose} aria-label="Close examples"><X size={18} /></button>
    </div>
    {!pack ? <div className="example-categories">
      {examplePacks.map(item => {
        const count = packCounts(item);
        return <button key={item.id} className="example-category" onClick={() => setSelected(item.id)}>
          {item.id === "authorization" ? <ShieldCheck size={22} /> : <Braces size={22} />}
          <span><strong>{item.title}</strong><small>{item.summary}</small><small>{count.requests} requests · {count.flows} workflows</small></span>
          <ChevronRight size={18} />
        </button>;
      })}
    </div> : <>
    <button className="examples-back" onClick={() => setSelected(null)}><ArrowLeft size={14} /> All examples</button>
    <h3 className="example-category-title">{pack.title}</h3>
    <p className="example-category-description">{pack.instructions}</p>
    <div className="auth-examples-list">
      {pack.id === "authorization" ? authExamples.map(e => <article key={e.key}><strong>{e.title}</strong><span className={e.expected >= 400 ? "auth-example-error" : "auth-example-success"}>HTTP {e.expected}</span><p>{e.description}</p></article>) : pack.requests.map(request => <article key={request.id}><strong>{request.name}</strong><span>{request.method}</span><p>{request.description}</p></article>)}
      {pack.flows.map(flow => <article key={flow.id}><strong>Workflow · {flow.name}</strong><p>{flow.steps.map(s => s.name).join(" → ")}</p></article>)}
      {pack.id === "authorization" && <>
      <article><strong>Included workflow</strong><p>OAuth token → protected API: get a token, then pass it into the next request automatically.</p></article>
      <article><strong>For real providers</strong><p>JWT validation, OAuth authorization code with PKCE, OpenID Connect / SSO, device authorization, Digest, OAuth 1.0, HMAC / AWS SigV4, mTLS and NTLM / Kerberos need provider setup, signing or a challenge exchange. This pack does not simulate or implement those mechanisms.</p></article>
      </>}
    </div>
    <div className="auth-examples-actions"><span>Adds {counts!.requests} requests and {counts!.flows} workflows in Examples / {pack.title}. Existing edits are preserved.</span><button className="primary" onClick={() => onAdd(pack.id)}>Add {pack.title.toLowerCase()} examples</button></div>
    </>}
    <div className="examples-reset">
      {confirmReset ? <><p>Restore the initial demo project? This resets only the local project data used by CRUD examples. Saved requests, workflows and environments are preserved.</p><div><button onClick={() => setConfirmReset(false)}>Cancel</button><button onClick={() => { resetExampleDemoData(); setConfirmReset(false); setResetNotice("Demo data reset. Project 1 is ready again."); }}>Reset demo data</button></div></> : <button onClick={() => { setConfirmReset(true); setResetNotice(""); }}><RotateCcw size={14} /> Reset demo data</button>}
      <p role="status">{resetNotice}</p>
    </div>
  </dialog>;
}
