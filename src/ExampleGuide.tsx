import {useId,useRef,useState} from "react";
import {Info} from "lucide-react";

export default function ExampleGuide({description}:{description:string}) {
  const id=useId();const guide=useRef<HTMLDivElement>(null);const [open,setOpen]=useState(false);
  const expected=description.match(/(?:expected|expect) HTTP (\d+)/i)?.[1];
  return <>
    <button className="workbench-guide-icon" title="Example guide" aria-label="Example guide" aria-haspopup="dialog" aria-expanded={open} popoverTarget={id} onClick={event=>{
      const rect=event.currentTarget.getBoundingClientRect();
      const width=Math.min(380,window.innerWidth-32);
      if(guide.current){guide.current.style.left=`${Math.max(16,Math.min(rect.left,window.innerWidth-width-16))}px`;guide.current.style.top=`${rect.bottom+8}px`;guide.current.style.maxHeight=`${Math.max(100,window.innerHeight-rect.bottom-24)}px`;}
    }}><Info size={17} aria-hidden="true"/></button>
    <div ref={guide} id={id} popover="auto" role="dialog" aria-label="Example guide" className="workbench-guide-popover" onToggle={()=>setOpen(guide.current?.matches(':popover-open')??false)}>
      <div className="workbench-guide-popover-heading"><strong>Example guide</strong>{expected&&<span>Expected {expected}</span>}</div>
      <p>{description}</p>
    </div>
  </>;
}
