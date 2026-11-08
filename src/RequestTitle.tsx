import {useRef,useState} from "react";

export default function RequestTitle({name,disabled,onRename}:{name:string;disabled:boolean;onRename:(name:string)=>void}) {
  const [editing,setEditing]=useState(false);const [draft,setDraft]=useState(name);const finished=useRef(false);
  function finish(save:boolean){if(finished.current)return;finished.current=true;if(save&&draft.trim()&&draft.trim()!==name)onRename(draft.trim());setEditing(false);}
  return <h1 className="workbench-request-title">{editing?<input autoFocus aria-label="Request name" value={draft} maxLength={200} disabled={disabled} onFocus={event=>event.currentTarget.select()} onChange={event=>setDraft(event.target.value)} onBlur={()=>finish(true)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();finish(true);}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}}}/>:<button className="workbench-name-button" title={`${name || 'Untitled request'} · Click to rename`} aria-label={`Rename request ${name || 'Untitled request'}`} disabled={disabled} onClick={()=>{finished.current=false;setDraft(name);setEditing(true);}}><span>{name||'Untitled request'}</span></button>}</h1>;
}
