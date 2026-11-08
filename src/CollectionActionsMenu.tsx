import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, FolderPlus, Send, Trash2, Pencil } from "lucide-react";

export type CollectionMenuTarget = {id:string;name:string;x:number;y:number;trigger:HTMLElement};
export default function CollectionActionsMenu({target,busy,onClose,onDocument,onFolder,onRequest,onDelete,onRename}: {
  target:CollectionMenuTarget;busy:boolean;onClose:()=>void;onDocument:()=>void;onFolder:()=>void;onRequest:()=>void;onDelete:()=>void;onRename:()=>void;
}) {
  const menu=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();},[target]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node)&&!target.trigger.contains(event.target as Node))onClose();};
    const close=()=>onClose();
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};
  },[onClose,target]);
  function choose(action:()=>void){onClose();target.trigger.focus();action();}
  return createPortal(<div ref={menu} role="menu" aria-label={`Manage ${target.name}`} className="collection-actions-menu" style={{left:Math.max(8,Math.min(window.innerWidth-228,target.x)),top:Math.max(8,Math.min(window.innerHeight-(target.id?244:106),target.y))}} onContextMenu={event=>event.preventDefault()} onKeyDown={event=>{
    const buttons=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();target.trigger.focus();}
    else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();
    }else if(event.key==='Tab'){onClose();target.trigger.focus();}
  }}>
    <div className="collection-actions-title">{target.name}</div>
    <button role="menuitem" onClick={()=>choose(onDocument)}><FileText size={15}/> View documentation</button>
    {target.id&&<button role="menuitem" disabled={busy} onClick={()=>choose(onFolder)}><FolderPlus size={15}/> New folder</button>}
    <button role="menuitem" disabled={busy} onClick={()=>choose(onRequest)}><Send size={15}/> New request</button>
    {target.id&&<button role="menuitem" disabled={busy} onClick={()=>choose(onRename)}><Pencil size={15}/> Rename</button>}
    {target.id&&<><div role="separator"/><button role="menuitem" className="collection-action-delete" disabled={busy} onClick={()=>choose(onDelete)}><Trash2 size={15}/> Delete…</button></>}
  </div>,document.body);
}
