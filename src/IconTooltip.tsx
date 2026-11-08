import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function IconTooltip({ text, children }: {text: string; children: ReactNode}) {
  const id = useId();
  const [position, setPosition] = useState<{left: number; top: number; below: boolean} | null>(null);
  return <div className="utility-icon" onMouseEnter={event => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({left: Math.max(8, Math.min(window.innerWidth - 168, rect.left + rect.width / 2 - 80)), top: rect.top < 80 ? rect.bottom + 8 : rect.top - 8, below: rect.top < 80});
  }} onFocus={event => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({left: Math.max(8, Math.min(window.innerWidth - 168, rect.left + rect.width / 2 - 80)), top: rect.top < 80 ? rect.bottom + 8 : rect.top - 8, below: rect.top < 80});
  }} onMouseLeave={() => setPosition(null)} onBlur={() => setPosition(null)} onClick={() => setPosition(null)} onKeyDown={event => { if (event.key === "Escape") setPosition(null); }}>
    {children}
    {position && createPortal(<div id={id} role="tooltip" className={`sidebar-nav-tooltip utility-tooltip ${position.below ? "utility-tooltip-below" : ""}`} style={{left: position.left, top: position.top}}>{text}</div>, document.body)}
  </div>;
}
