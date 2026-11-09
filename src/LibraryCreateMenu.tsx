import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FolderPlus, MoreHorizontal, Send, Upload } from "lucide-react";

type Props = {
  disabled: boolean;
  onCollection: () => void;
  onRequest: () => void;
  onImport: () => void;
  onExport: () => void;
};

export default function LibraryCreateMenu({ disabled, onCollection, onRequest, onImport, onExport }: Props) {
  const label = "Collections actions";
  const [open,setOpen]=useState(false);
  const [position,setPosition]=useState({left:0,top:0});
  const trigger=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!open)return;
    const rect = trigger.current!.getBoundingClientRect();
    const height = menu.current!.getBoundingClientRect().height;
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - 208, rect.right - 200)),
      top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - height - 8)),
    });
    menu.current?.querySelector('button')?.focus();
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false);};
    const close=()=>setOpen(false);
    document.addEventListener('pointerdown',outside);
    window.addEventListener('resize',close);
    window.addEventListener('scroll',close,true);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};
  },[open]);
  function choose(action:()=>void){setOpen(false);trigger.current?.focus();action();}
  return <>
    <button ref={trigger} className="library-create-trigger" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);}}}><MoreHorizontal size={16} aria-hidden="true" /></button>
    {open&&createPortal(<div ref={menu} role="menu" aria-label={label} className="library-create-menu" style={position} onKeyDown={event=>{
      const buttons=Array.from(menu.current?.querySelectorAll('button')??[]);
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
      else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();
      }else if(event.key==='Tab')setOpen(false);
    }}>
      <button role="menuitem" onClick={()=>choose(onCollection)}><FolderPlus size={16}/><span>New collection<small>Group related requests</small></span></button>
      <button role="menuitem" onClick={()=>choose(onRequest)}><Send size={16}/><span>New request<small>Create an API request</small></span></button>
      <div className="library-menu-divider" role="separator" />
      <button role="menuitem" onClick={()=>choose(onImport)}><Upload size={16}/><span>Import workspace</span></button>
      <button role="menuitem" onClick={()=>choose(onExport)}><Download size={16}/><span>Export workspace</span></button>
    </div>,document.body)}
  </>;
}
