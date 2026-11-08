import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

export default function ConfirmCollectionDelete({ name, count, defaultDeleteRequests = false, onCancel, onConfirm }: {
  name: string; count: number; defaultDeleteRequests?: boolean; onCancel: () => void; onConfirm: (deleteRequests: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [deleteRequests, setDeleteRequests] = useState(defaultDeleteRequests);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="delete-confirm" aria-labelledby="delete-collection-title" aria-describedby="delete-collection-description"
    onCancel={event => { event.preventDefault(); onCancel(); }}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
    }}>
    <div className="delete-confirm-icon"><Trash2 size={21} /></div>
    <h2 id="delete-collection-title">Delete collection?</h2>
    <p id="delete-collection-description">Delete <strong>{name}</strong>? {count ? `${count} request${count === 1 ? "" : "s"} ${deleteRequests ? "will be deleted with this collection." : "will move to Unfiled."}` : "This group has no requests."} Nested folders are included. Workflows are preserved.</p>
    {count > 0 && <label className="collection-delete-option"><input type="checkbox" checked={deleteRequests} onChange={event => setDeleteRequests(event.target.checked)} /> Also delete all {count} requests in this collection</label>}
    <p>{deleteRequests ? "The collection and its requests will be permanently deleted." : "The collection and its nested folders will be deleted."} This cannot be undone.</p>
    <div className="delete-confirm-actions">
      <button autoFocus onClick={onCancel}>Cancel</button>
      <button className="confirm-delete-button" onClick={() => onConfirm(deleteRequests)}><Trash2 size={14} />{deleteRequests ? "Delete collection & requests" : "Delete collection"}</button>
    </div>
  </dialog>;
}
