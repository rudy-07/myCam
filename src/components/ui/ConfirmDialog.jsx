import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

/**
 * Confirmation built on the shared accessible Modal (focus trap, Escape, focus restore).
 * The caller owns the request: pass `busy` while it runs and `error` if it fails.
 * The dialog does not close itself, so a failed action stays visible and retryable.
 */
const ConfirmDialog = ({ title, children, confirmLabel = 'Delete', busyLabel = 'Deleting…', cancelLabel = 'Cancel', busy = false, error = '', onConfirm, onCancel }) => (
  <Modal
    size="md"
    title={title}
    closeLabel="Cancel"
    onClose={() => { if (!busy) onCancel(); }}
    footer={(
      <>
        <span />
        <div className="flex gap-2">
          <Button onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>{busy ? busyLabel : confirmLabel}</Button>
        </div>
      </>
    )}
  >
    <div className="space-y-4 p-5 text-small text-fg-muted">
      <div className="space-y-2">{children}</div>
      {error && (
        <div role="alert" className="callout callout-danger">
          <AlertTriangle aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </div>
  </Modal>
);

export default ConfirmDialog;
