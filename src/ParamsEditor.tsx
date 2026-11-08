import { useEffect,useRef,useState } from "react";
import {Plus,Trash2} from "lucide-react";
import type {RequestSpec} from "./model";
import {parseQueryParams,writeQueryParams} from "./query-params";
export default function ParamsEditor({spec,busy,onPatch}:{spec:RequestSpec;busy:boolean;onPatch:(patch:Partial<RequestSpec>)=>void}) {
  function read(){return [...parseQueryParams(spec.url).map(p=>({...p,enabled:true})),...(spec.disabledParams??[]).map(p=>({...p,enabled:false}))];}
  const [rows,setRows]=useState(read);const lastUrl=useRef(spec.url);
  useEffect(()=>{if(lastUrl.current!==spec.url){lastUrl.current=spec.url;setRows(read());}},[spec.url]);
  function update(next:typeof rows){
    const url=writeQueryParams(spec.url,next.filter(p=>p.enabled));lastUrl.current=url;setRows(next);
    onPatch({url,disabledParams:next.filter(p=>!p.enabled&&p.key!=='').map(({key,value})=>({key,value}))});
  }
  return <div className="params-editor"><p className="workbench-hint">Query parameters sync with the URL. Variables and repeated keys are supported.</p><div className="headers-table"><div className="headers-table-label"><span/><span>Key</span><span>Value</span><span/></div>{rows.map((row,index)=><div className="headers-table-row" key={index}>
    <input type="checkbox" aria-label={`Enable parameter ${index+1}`} checked={row.enabled} disabled={busy} onChange={e=>update(rows.map((p,i)=>i===index?{...p,enabled:e.target.checked}:p))}/>
    <input aria-label={`Parameter ${index+1} key`} placeholder="Parameter name" value={row.key} disabled={busy} onChange={e=>update(rows.map((p,i)=>i===index?{...p,key:e.target.value}:p))}/>
    <input aria-label={`Parameter ${index+1} value`} placeholder="Value or {{variable}}" value={row.value} disabled={busy} onChange={e=>update(rows.map((p,i)=>i===index?{...p,value:e.target.value}:p))}/>
    <button aria-label={`Remove parameter ${index+1}`} disabled={busy} onClick={()=>update(rows.filter((_,i)=>i!==index))}><Trash2 size={13}/></button>
  </div>)}</div><button className="add-header" disabled={busy} onClick={()=>setRows([...rows,{key:'',value:'',enabled:true}])}><Plus size={13}/> Add parameter</button></div>;
}
