import { Timer, HardDrive } from "lucide-react";
import type { Result } from "./model";

export default function ResponseMeta({result}:{result:Result}) {
  const tone=result.status>=500?'server-error':result.status>=400?'client-error':result.status>=300?'redirect':result.status>=200?'success':'info';
  const size=result.size<1024?`${result.size} B`:result.size<1024*1024?`${(result.size/1024).toFixed(1)} KB`:`${(result.size/(1024*1024)).toFixed(1)} MB`;
  return <div className="response-meta" role="status" aria-live="polite">
    <span className={`response-status-badge is-${tone}`} title={`HTTP ${result.status} ${result.statusText}`}><span className="response-status-dot"/>{result.status} {result.statusText}</span>
    <span className="response-metric" title={`Response time: ${result.duration} milliseconds`}><Timer size={12} aria-hidden="true"/><span>{result.duration} <small>ms</small></span></span>
    <span className="response-metric" title={`Response size: ${result.size} bytes`}><HardDrive size={12} aria-hidden="true"/><span>{size}</span></span>
  </div>;
}
