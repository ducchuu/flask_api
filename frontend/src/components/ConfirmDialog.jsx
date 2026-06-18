import { useEffect } from 'react';

export default function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <p className="confirm-dialog__msg">{message}</p>
        <div className="confirm-dialog__actions">
          <button className="confirm-dialog__cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-dialog__confirm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
