import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
export default function ConfirmRequestDelete({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="delete-confirm"
      aria-labelledby="delete-confirm-title"
      aria-describedby="delete-confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const rect = dialog.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onCancel();
        }
      }}
    >
      <div className="delete-confirm-icon">
        <Trash2 size={21} />
      </div>
      <h2 id="delete-confirm-title">Delete request?</h2>
      <p id="delete-confirm-description">
        Delete <strong>{name || "Untitled request"}</strong> from Collections?
        This cannot be undone.
      </p>
      <div className="delete-confirm-actions">
        <button autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button className="confirm-delete-button" onClick={onConfirm}>
          <Trash2 size={14} />
          Delete request
        </button>
      </div>
    </dialog>
  );
}
