import ResponseMeta from "./ResponseMeta";
import { formatJson, jsonFormatError } from "./format-json";
import RequestTitle from "./RequestTitle";
import ExampleGuide from "./ExampleGuide";
import ParamsEditor from "./ParamsEditor";
import { parseQueryParams } from "./query-params";
import JsonCode, { JsonEditor } from "./JsonCode";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Send, Plus, Trash2, Square, Save, Braces, Check } from "lucide-react";
import Dropdown from "./Dropdown";
import { collectionPath } from "./collection-tree";
import { responseExamples } from "./response-examples";
import type { RequestSpec, Result, Workspace } from "./model";

function HeaderEditor({spec,busy,onPatch}:{spec:RequestSpec;busy:boolean;onPatch:(patch:Partial<RequestSpec>)=>void}) {
  function parse(){try{const v=JSON.parse(spec.headers||"{}");return v&&typeof v==="object"&&!Array.isArray(v)&&Object.values(v).every(x=>typeof x==="string") ? Object.entries(v).map(([key,value])=>({key,value:value as string,enabled:true})) : null;}catch{return null;}}
  const [raw,setRaw]=useState(false);
  const [rows,setRows]=useState(()=>[...(parse()??[]),...Object.entries(spec.disabledHeaders??{}).map(([key,value])=>({key,value,enabled:false}))]);
  const [error,setError]=useState("");
  function update(next:typeof rows){setRows(next);const keys=next.filter(r=>r.key.trim()).map(r=>r.key.toLowerCase());if(new Set(keys).size!==keys.length){setError("Header names must be unique. Resolve duplicates to save changes.");return;}setError("");onPatch({headers:JSON.stringify(Object.fromEntries(next.filter(r=>r.enabled&&r.key.trim()).map(r=>[r.key,r.value])),null,2),disabledHeaders:Object.fromEntries(next.filter(r=>!r.enabled&&r.key.trim()).map(r=>[r.key,r.value]))});}
  return <div className="headers-editor"><div className="editor-mode"><button className={!raw?"selected":""} onClick={()=>{const parsed=parse();if(parsed){setRows([...parsed,...Object.entries(spec.disabledHeaders??{}).map(([key,value])=>({key,value,enabled:false}))]);setRaw(false);setError("");}else setError("Fix the JSON object before switching to the table.");}}>Table</button><button className={raw?"selected":""} onClick={()=>setRaw(true)}>Raw JSON</button></div>
    {error&&<p role="alert">{error}</p>}
    {raw||parse()===null?<JsonEditor label="Request headers" disabled={busy} value={spec.headers} onChange={headers=>onPatch({headers})}/>:<><div className="headers-table"><div className="headers-table-label"><span/><span>Key</span><span>Value</span><span/></div>{rows.map((row,index)=><div className="headers-table-row" key={index}><input type="checkbox" aria-label={`Enable header ${index+1}`} disabled={busy} checked={row.enabled} onChange={e=>update(rows.map((r,i)=>i===index?{...r,enabled:e.target.checked}:r))}/><input aria-label={`Header ${index+1} key`} placeholder="Header name" disabled={busy} value={row.key} onChange={e=>update(rows.map((r,i)=>i===index?{...r,key:e.target.value}:r))}/><input aria-label={`Header ${index+1} value`} placeholder="Value or {{variable}}" disabled={busy} value={row.value} onChange={e=>update(rows.map((r,i)=>i===index?{...r,value:e.target.value}:r))}/><button aria-label={`Remove header ${index+1}`} disabled={busy} onClick={()=>update(rows.filter((_,i)=>i!==index))}><Trash2 size={13}/></button></div>)}</div><button className="add-header" disabled={busy} onClick={()=>setRows([...rows,{key:"",value:"",enabled:true}])}><Plus size={13}/> Add header</button></>}
  </div>;
}
export default function RequestWorkbench({spec,workspace,busy,response,saved,onPatch,onSend,onStop,onSave}: {
  spec:RequestSpec;workspace:Workspace;busy:boolean;response:Result|null;saved:boolean;
  onPatch:(patch:Partial<RequestSpec>)=>void;onSend:()=>void;onStop:()=>void;onSave:()=>void;
}) {
  const [formatNotice,setFormatNotice]=useState<{error:boolean;message:string}|null>(null);
  useEffect(()=>{
    if(!formatNotice || formatNotice.error) return;
    const timeout=setTimeout(()=>setFormatNotice(null),2200);
    return ()=>clearTimeout(timeout);
  },[formatNotice]);
  const [tab,setTab]=useState("headers");const [responseTab,setResponseTab]=useState("body");const [ratio,setRatio]=useState(50);
  const panels=useRef<HTMLDivElement>(null);const examples=responseExamples(spec);
  function format(body:unknown){return typeof body==="string"?body:JSON.stringify(body,null,2);}
  return <div className="request-workbench">
    <div className="workbench-heading"><Dropdown label="Collection" disabled={busy} value={spec.collectionId??""} onChange={collectionId=>onPatch({collectionId:collectionId||undefined})} options={[{value:"",label:"Unfiled"},...(workspace.collections??[]).map(c=>({value:c.id,label:collectionPath(workspace.collections??[],c.id)}))]}/><div className="workbench-title-row"><RequestTitle name={spec.name} disabled={busy} onRename={name=>onPatch({name})}/>{spec.description&&<ExampleGuide description={spec.description}/>}</div></div>
    <div className="workbench-url"><div className="request-line workbench-url-field"><Dropdown label="HTTP method" variant="method" disabled={busy} value={spec.method} onChange={method=>onPatch({method})} options={["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].map(value=>({value,label:value}))}/><input aria-label="Request URL" spellCheck={false} value={spec.url} disabled={busy} onChange={e=>onPatch({url:e.target.value})}/></div>{busy?<button className="workbench-send" onClick={onStop}><Square size={14}/> Stop</button>:<button className="primary workbench-send" onClick={onSend}><Send size={14}/> Send</button>}</div>
    <div className="workbench-panels" ref={panels} style={{"--request-ratio":`${ratio}%`} as CSSProperties}>
      <section className="workbench-request" aria-label="Request configuration"><div className="workbench-panel-label">REQUEST</div><div className="workbench-tabs" role="tablist" aria-label="Request editor">{["params","body","headers","auth"].map(value=><button role="tab" aria-selected={tab===value} key={value} onClick={()=>setTab(value)}>{value==="auth"?"Authorization":value[0].toUpperCase()+value.slice(1)}{value==="params"&&parseQueryParams(spec.url).length>0?<span className="workbench-tab-count">{parseQueryParams(spec.url).length}</span>:null}</button>)}</div><div className="workbench-panel-content">

        {tab==="params"?<ParamsEditor key={spec.id} spec={spec} busy={busy} onPatch={onPatch}/>:tab==="headers"?<HeaderEditor key={spec.id} spec={spec} busy={busy} onPatch={onPatch}/>:tab==="auth"?<><label htmlFor="workbench-token">Bearer token</label><input id="workbench-token" type="password" disabled={busy} value={spec.auth} placeholder="{{token}}" onChange={e=>onPatch({auth:e.target.value})}/><p className="workbench-hint">Other authorization methods use Headers, URL or Body.</p></>:<><div className="workbench-body-toolbar"><label htmlFor="workbench-body">Request body · raw text / JSON</label><button className={formatNotice&&!formatNotice.error?"is-formatted":""} disabled={busy||!spec.body.trim()} onClick={()=>{
          try { const body=formatJson(spec.body);onPatch({body});setFormatNotice({error:false,message:"JSON formatted."}); }
          catch(error) { setFormatNotice({error:true,message:jsonFormatError(spec.body,error)}); }
        }}>{formatNotice&&!formatNotice.error?<><Check size={13}/> Formatted</>:<><Braces size={13}/> Format JSON</>}</button><span className="format-json-live" role="status" aria-live="polite">{formatNotice&&!formatNotice.error?"JSON formatted.":""}</span></div>
        {formatNotice?.error&&<p className="json-format-notice is-error" role="alert">{formatNotice.message}</p>}
        <JsonEditor id="workbench-body" label="Request body" disabled={busy} value={spec.body} placeholder="Enter a request body…" onChange={body=>{setFormatNotice(null);onPatch({body});}}/></>}
      </div></section>
      <div className="workbench-resizer" role="separator" tabIndex={0} aria-label="Resize request and response panels" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={ratio} onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const rect=panels.current!.getBoundingClientRect();setRatio(Math.max(30,Math.min(70,(e.clientX-rect.left)/rect.width*100)));}} onKeyDown={e=>{if(["ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();setRatio(v=>Math.max(30,Math.min(70,v+(e.key==="ArrowLeft"?-5:5))));}}}/>
      <section className="workbench-response" aria-label="Response"><div className="workbench-panel-label"><span>RESPONSE</span>{response&&<ResponseMeta result={response}/>}</div><div className="workbench-response-toolbar"><div className="workbench-tabs" role="tablist" aria-label="Response view">{["body","headers","examples"].map(value=><button role="tab" aria-selected={responseTab===value} key={value} onClick={()=>setResponseTab(value)}>{value[0].toUpperCase()+value.slice(1)}{value==="examples"&&examples.length>0?<span className="workbench-tab-count">{examples.length}</span>:null}</button>)}</div>{response&&<button className="workbench-save" disabled={busy||saved} onClick={onSave} title="Save response example"><Save size={13}/>{saved?"Saved":"Save example"}</button>}</div><div className="workbench-panel-content" aria-live="polite">
        {responseTab==="examples"?examples.length?examples.map(example=><article className="workbench-response-example" key={example.id}><h4>{example.name} · {example.status} {example.statusText}</h4><details><summary>Headers</summary><JsonCode text={JSON.stringify(example.headers,null,2)}/></details><JsonCode text={example.body===""?"No response body.":format(example.body)}/></article>):<p className="workbench-empty">Send a request and save its response to add an example.</p>:response?<JsonCode text={responseTab==="headers"?JSON.stringify(response.headers,null,2):response.body===""?"No response body.":format(response.body)}/>:<div className="workbench-empty"><Send size={26}/><p>{busy?"Sending request…":"Send a request to inspect its response."}</p></div>}
      </div></section>
    </div>
  </div>;
}
