import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Globe, Layers, Workflow } from "lucide-react";

type Option = { value: string; label: string; description?: string };
type Props = {
  label: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: "environment" | "method" | "step" | "standard";
  id?: string;
};
export default function Dropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
  variant = "standard",
  id,
}: Props) {
  const generated = useId(),
    listId = generated + "-list";
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [position, setPosition] = useState({
      left: 0,
      top: 0,
      width: 240,
      maxHeight: 320,
    });
  const search = useRef({ text: "", time: 0 });
  const selected = options.find((o) => o.value === value);
  function reveal(last = false) {
    if (disabled || !options.length) return;
    setActive(
      last
        ? options.length - 1
        : Math.max(
            0,
            options.findIndex((o) => o.value === value),
          ),
    );
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    onChange(option.value);
    trigger.current?.focus();
  }
  useLayoutEffect(() => {
    if (!open || disabled) {
      if (disabled) setOpen(false);
      return;
    }
    function place() {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(
        Math.max(rect.width, variant === "method" ? 248 : 270),
        window.innerWidth - 24,
      );
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const desired = Math.min(380, options.length * 61 + 78);
      const upward = below < Math.min(desired, 240) && above > below;
      const height = Math.min(desired, upward ? above : below);
      setPosition({
        left: Math.max(
          12,
          Math.min(
            variant === "environment" ? rect.right - width : rect.left,
            window.innerWidth - width - 12,
          ),
        ),
        top: upward ? rect.top - height - 7 : rect.bottom + 7,
        width,
        maxHeight: Math.max(80, height),
      });
    }
    function outside(e: PointerEvent) {
      if (
        !trigger.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    function focusOutside(e: FocusEvent) {
      if (
        !trigger.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
    };
  }, [open, disabled, options.length, variant]);
  useLayoutEffect(() => {
    if (open)
      menu.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  function keyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!open) {
        reveal(e.key === "End");
        return;
      }
      setActive((i) =>
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? options.length - 1
            : (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length,
      );
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(active);
      else reveal();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const now = Date.now();
      search.current = {
        text:
          (now - search.current.time > 650 ? "" : search.current.text) +
          e.key.toLowerCase(),
        time: now,
      };
      const index = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(search.current.text),
      );
      if (index >= 0) {
        setActive(index);
        setOpen(true);
      }
    }
  }
  const Icon =
    variant === "environment" ? Globe : variant === "step" ? Workflow : Layers;
  return (
    <div className={`dropdown dropdown-${variant}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled || !options.length}
        className={`dropdown-trigger ${open ? "is-open" : ""}`}
        onClick={() => (open ? setOpen(false) : reveal())}
        onKeyDown={keyDown}
      >
        {variant !== "method" && (
          <Icon size={14} className="dropdown-leading" />
        )}
        <span
          className={
            variant === "method"
              ? `http-verb verb-${value?.toLowerCase()}`
              : "dropdown-value"
          }
        >
          {selected?.label || "Select an option"}
        </span>
        <ChevronDown size={13} className="dropdown-chevron" />
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menu}
            className={`dropdown-menu dropdown-menu-${variant}`}
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
          >
            <div className="dropdown-heading">
              {label}
              <span>{options.length} options</span>
            </div>
            <div
              className="dropdown-options"
              role="listbox"
              id={listId}
              aria-label={label}
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-index={index}
                  className={`dropdown-option ${active === index ? "is-active" : ""} ${option.value === value ? "is-selected" : ""}`}
                  onPointerMove={() => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span
                    className={`option-symbol ${variant === "method" ? `http-verb verb-${option.value.toLowerCase()}` : ""}`}
                  >
                    {variant === "method" ? (
                      option.label
                    ) : variant === "step" ? (
                      String(index + 1).padStart(2, "0")
                    ) : (
                      <Icon size={15} />
                    )}
                  </span>
                  <span className="option-copy">
                    <strong>
                      {variant === "method"
                        ? option.description || option.label
                        : option.label}
                    </strong>
                    <small>
                      {variant === "method"
                        ? option.label
                        : option.description || "Available in this workspace"}
                    </small>
                  </span>
                  {option.value === value && (
                    <Check size={15} className="option-check" />
                  )}
                </div>
              ))}
            </div>
            <div className="dropdown-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> Navigate
              </span>
              <span>
                <kbd>↵</kbd> Select
              </span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
