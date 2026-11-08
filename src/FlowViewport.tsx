import {useRef,useState} from "react";
import type {ReactNode} from "react";
import {RotateCcw,Move} from "lucide-react";
export default function FlowViewport({children}:{children:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null);
  const start=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const [panning,setPanning]=useState(false);
  return <><div className="flow-pan-toolbar"><span><Move size={12}/> Drag background to pan · Drag grips to reorder</span><button aria-label="Reset canvas view" title="Reset canvas view" onClick={()=>{const el=viewport.current;if(el){el.scrollTop=0;el.scrollLeft=Math.max(0,(el.scrollWidth-el.clientWidth)/2);}}}><RotateCcw size={13}/></button></div>
    <div ref={viewport} className={`flow-pan-viewport ${panning?'is-panning':''}`} tabIndex={0} aria-label="Flow canvas" onPointerDown={event=>{
      if(event.button!==0||event.pointerType!=='mouse'||(event.target as HTMLElement).closest('button,input,textarea,select,a,[draggable="true"],.flow-step-grip'))return;
      const el=event.currentTarget;start.current={x:event.clientX,y:event.clientY,left:el.scrollLeft,top:el.scrollTop};el.setPointerCapture(event.pointerId);setPanning(true);event.preventDefault();
    }} onPointerMove={event=>{if(!start.current||!event.currentTarget.hasPointerCapture(event.pointerId))return;event.currentTarget.scrollLeft=start.current.left-(event.clientX-start.current.x);event.currentTarget.scrollTop=start.current.top-(event.clientY-start.current.y);}}
    onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);start.current=null;setPanning(false);}} onLostPointerCapture={()=>{start.current=null;setPanning(false);}}>
      <div className="flow-pan-content">{children}</div>
    </div></>;
}
