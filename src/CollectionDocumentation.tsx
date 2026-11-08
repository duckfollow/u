import JsonCode from "./JsonCode";
import { exportDocumentationMarkdown } from "./documentation-markdown";
import { responseExamples } from "./response-examples";
import { useEffect, useRef, useState } from "react";
import { FileText, X, ArrowUpRight, Download, Check } from "lucide-react";
import type { RequestSpec, Workspace } from "./model";
import { documentationGroups, requestVariables, type DocumentationScope } from "./collection-docs";

function RequestDetails({ request, onOpen }: {request: RequestSpec; onOpen: (id: string) => void}) {
  const query = request.url.includes("?") ? [...new URLSearchParams(request.url.split("?").slice(1).join("?").split("#")[0])] : [];
  let headers: [string,string][] | undefined;
  try {
    const parsed: unknown = JSON.parse(request.headers || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.values(parsed).every(v => typeof v === "string")) headers = Object.entries(parsed);
  } catch { /* Preserve unfinished header edits in the documentation. */ }
  const variables = requestVariables(request);
  const examples = responseExamples(request);
  return <details className="api-doc-request">
    <summary><span className={`method method-${request.method.toLowerCase()}`}>{request.method}</span><strong>{request.name || "Untitled request"}</strong></summary>
    <div className="api-doc-request-content">
      <code className="api-doc-url">{request.url}</code>
      {request.description && <p className="api-doc-description">{request.description}</p>}
      <div className="api-doc-request-actions"><button onClick={() => onOpen(request.id)}><ArrowUpRight size={14} /> Open request</button></div>
      {query.length > 0 && <section><h4>Query parameters</h4><table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>{query.map(([key,value],i) => <tr key={i}><td>{key}</td><td><code>{value}</code></td></tr>)}</tbody></table></section>}
      <section><h4>Authorization</h4><p>{request.auth ? <>Bearer <code>{request.auth}</code></> : headers?.some(([key]) => /authorization|cookie|api[-_]?key/i.test(key)) ? "Configured through request headers (see below)." : "No Bearer token configured. Other credentials may be supplied through the URL, headers or body."}</p></section>
      <section><h4>Headers</h4>{headers ? headers.length ? <table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>{headers.map(([key,value]) => <tr key={key}><td>{key}</td><td><code>{value}</code></td></tr>)}</tbody></table> : <p>No custom headers.</p> : <><p>Headers are not a JSON object with string values yet.</p><JsonCode text={request.headers}/></>}</section>
      <section><h4>Body</h4>{request.body ? <JsonCode text={request.body}/> : <p>No request body.</p>}</section>
      <section className="api-doc-responses"><h4>Response examples</h4>
        {examples.length ? examples.map(example => <article key={example.id} className="api-doc-response">
          <h5>{example.name} <span className={example.status < 400 ? "green" : ""}>{example.status} {example.statusText}</span></h5>
          <details><summary>Response headers</summary><JsonCode text={JSON.stringify(example.headers,null,2)}/></details>
          {example.body === "" ? <p>No response body.</p> : <JsonCode text={typeof example.body === "string" ? example.body : JSON.stringify(example.body,null,2)}/>}
        </article>) : <p>No response examples yet. Open the request, click Send, then Save response example.</p>}
      </section>
      {variables.length > 0 && <section><h4>Variables</h4><ul>{variables.map(variable => <li key={variable}><code>{`{{${variable}}}`}</code></li>)}</ul><p>Variables are shown as written, without resolving environment values or running requests.</p></section>}
    </div>
  </details>;
}
export default function CollectionDocumentation({workspace, scope, onClose, onOpen}: {
  workspace: Workspace; scope: DocumentationScope; onClose: () => void; onOpen: (id:string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [exportToast, setExportToast] = useState<{filename: string} | null>(null);
  useEffect(() => {
    if (!exportToast) return;
    const timeout = setTimeout(() => setExportToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [exportToast]);
  const groups = documentationGroups(workspace,scope);
  const title = scope.kind === "folder" ? scope.name : groups[0]?.name ?? "Collection";
  const count = groups.reduce((total, group) => total + group.requests.length,0);
  function exportMarkdown() {
    const {filename, content} = exportDocumentationMarkdown(workspace, scope);
    const url = URL.createObjectURL(new Blob([content], {type: "text/markdown;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setExportToast({filename});
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="api-documentation" aria-labelledby="api-doc-title" onCancel={onClose} onClick={event => {
    if (event.target !== dialog.current) return;
    const rect = dialog.current.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <div className="api-doc-scroll">
    <div className="api-doc-heading"><div><span className="api-doc-eyebrow"><FileText size={14} /> API DOCUMENTATION</span><h2 id="api-doc-title">{title}</h2><p>{scope.kind === "folder" ? `${groups.length} collections · ` : ""}{count} requests · Generated from saved requests</p></div><div className="api-doc-actions"><button onClick={exportMarkdown}><Download size={14} /> Export Markdown</button><button aria-label="Close API documentation" onClick={onClose}><X size={18} /></button></div></div>
    <p className="api-doc-intro">Expand an endpoint to inspect its configuration. Response schemas and required fields are not inferred from request examples.</p>
    {groups.map(group => <section className="api-doc-group" key={group.id}><h3>{group.name}<small>{group.requests.length} requests</small></h3>{group.requests.length ? group.requests.map(request => <RequestDetails key={request.id} request={request} onOpen={onOpen} />) : <p>No requests in this collection yet.</p>}</section>)}
    {!groups.length && <p>No collections in this folder.</p>}
    </div>
    {exportToast && <div className="api-doc-export-toast" role="status" aria-live="polite">
      <Check size={17} aria-hidden="true" />
      <span><strong>Markdown exported</strong><small>{exportToast.filename}</small></span>
      <button aria-label="Dismiss export notification" onClick={() => setExportToast(null)}><X size={15} /></button>
    </div>}
  </dialog>;
}
