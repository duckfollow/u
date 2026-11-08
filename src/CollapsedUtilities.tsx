import {useEffect,useId,useRef,useState} from "react";
import {MoreHorizontal,Upload,Download,RefreshCw,Sun,Moon,Monitor} from "lucide-react";
import {getThemePreference,setThemePreference,type ThemePreference} from "./theme";

export default function CollapsedUtilities({busy,version,updateAvailable,onImport,onExport,onUpdates}:{busy:boolean;version:string;updateAvailable:boolean;onImport:()=>void;onExport:()=>void;onUpdates:()=>void}) {
  const id=useId();const popover=useRef<HTMLDivElement>(null);const [open,setOpen]=useState(false);const [theme,setTheme]=useState(getThemePreference);
  useEffect(()=>{const sync=()=>setTheme(getThemePreference());window.addEventListener('u-theme-changed',sync);return()=>window.removeEventListener('u-theme-changed',sync);},[]);
  function choose(action:()=>void){popover.current?.hidePopover();action();}
  return <div className="collapsed-utilities">
    <button className="collapsed-utilities-trigger" aria-label="Workspace tools" aria-haspopup="dialog" aria-expanded={open} title="Workspace tools" popoverTarget={id} onClick={event=>{
      const rect=event.currentTarget.getBoundingClientRect();if(popover.current){popover.current.style.left=`${Math.max(8,Math.min(rect.right+10,window.innerWidth-248))}px`;popover.current.style.top=`${Math.max(12,Math.min(rect.bottom-260,window.innerHeight-272))}px`;}
    }}><MoreHorizontal size={20}/>{updateAvailable&&<span className="utility-update-dot"/>}</button>
    <div ref={popover} id={id} popover="auto" role="dialog" aria-label="Workspace tools" className="collapsed-utilities-popover" onToggle={()=>setOpen(popover.current?.matches(':popover-open')??false)}>
      <strong className="collapsed-utilities-title">Workspace tools</strong>
      <button disabled={busy} onClick={()=>choose(onImport)}><Upload size={15}/> Import workspace</button>
      <button onClick={()=>choose(onExport)}><Download size={15}/> Export workspace</button>
      <div className="collapsed-utilities-theme" role="group" aria-label="Theme"><span>Theme</span><div>{([{value:'light',label:'Light',icon:Sun},{value:'dark',label:'Dark',icon:Moon},{value:'system',label:'System',icon:Monitor}] as const).map(option=><button key={option.value} aria-pressed={theme===option.value} onClick={()=>setThemePreference(option.value as ThemePreference)}><option.icon size={14}/>{option.label}</button>)}</div></div>
      <button disabled={busy} onClick={()=>choose(onUpdates)}><RefreshCw size={15}/><span>Updates</span>{updateAvailable?<small className="collapsed-update-new">New</small>:version&&<small>v{version}</small>}</button>
    </div>
  </div>;
}
