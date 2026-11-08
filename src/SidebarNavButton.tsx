import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export default function SidebarNavButton({ label, active, disabled, collapsed, onClick, children, expanded, controls, buttonRef }: {
  label: string; active: boolean; disabled: boolean; collapsed: boolean;
  onClick: () => void; children: ReactNode;
  expanded?: boolean; controls?: string; buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [tooltip, setTooltip] = useState<{left: number; top: number} | null>(null);
  useEffect(() => { setTooltip(null); }, [collapsed, disabled]);
  function show() {
    const rect = (buttonRef ?? ref).current?.getBoundingClientRect();
    if (!rect || disabled) return;
    const width = 120;
    setTooltip({
      left: collapsed ? rect.right + 8 : Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)),
      top: collapsed ? rect.top + rect.height / 2 - 15 : rect.bottom + 6,
    });
  }
  return <>
    <button ref={buttonRef ?? ref} aria-label={label} aria-current={active && expanded === undefined ? "page" : undefined}
      aria-expanded={expanded} aria-controls={controls}
      aria-describedby={tooltip ? id : undefined} disabled={disabled} className={active ? "active" : ""}
      onMouseEnter={show} onMouseLeave={() => setTooltip(null)}
      onFocus={show} onBlur={() => setTooltip(null)}
      onKeyDown={event => { if (event.key === "Escape") setTooltip(null); }}
      onClick={() => { setTooltip(null); onClick(); }}>
      {children}
    </button>
    {tooltip && createPortal(<div id={id} role="tooltip" className="sidebar-nav-tooltip" style={{left: tooltip.left, top: tooltip.top}}>{label}</div>, document.body)}
  </>;
}
