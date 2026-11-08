import { useMemo, useRef } from "react";
import { jsonTokens } from "./json-tokens";

function Highlight({text}:{text:string}) {
  const tokens=useMemo(()=>jsonTokens(text),[text]);
  return <>{tokens.map((token,index)=>token.kind?<span className={`json-token-${token.kind}`} key={index}>{token.text}</span>:token.text)}</>;
}
export default function JsonCode({text}:{text:string}) {
  return <pre className="json-code"><code><Highlight text={text}/></code></pre>;
}
export function JsonEditor({value,onChange,label,id,disabled,placeholder}:{value:string;onChange:(value:string)=>void;label:string;id?:string;disabled?:boolean;placeholder?:string}) {
  const preview=useRef<HTMLPreElement>(null);
  return <div className={`json-editor ${disabled?"is-disabled":""}`}>
    <pre ref={preview} className="json-editor-highlight" aria-hidden="true"><Highlight text={value}/>{"\n"}</pre>
    <textarea id={id} aria-label={label} value={value} disabled={disabled} placeholder={placeholder} spellCheck={false} autoCorrect="off" autoCapitalize="off" wrap="off" onChange={event=>onChange(event.target.value)} onScroll={event=>{if(preview.current){preview.current.scrollTop=event.currentTarget.scrollTop;preview.current.scrollLeft=event.currentTarget.scrollLeft;}}}/>
  </div>;
}
