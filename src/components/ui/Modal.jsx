import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog shell: role="dialog", labelled title, Escape to close,
 * Tab focus trap, focus restored to the opener on close, body scroll lock.
 * It only provides structure and behaviour; the caller keeps its own logic.
 *
 * Props: title, subtitle, onClose, headerExtra (right of title), footer, size ('md'|'lg'|'xl'),
 *        closeLabel, bodyClassName.
 */
const Modal = ({ title, subtitle, onClose, headerExtra, footer, size = 'xl', closeLabel = 'Close dialog', bodyClassName = '', children }) => {
  const panelRef = useRef(null);
  const titleId = useId();
  const subtitleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const opener = document.activeElement;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog (the panel itself, so media/controls are not auto-activated)
    panel?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) =>
        !el.hasAttribute('hidden') && !el.closest('[inert]') && el.getClientRects().length > 0
      );
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // Rendered on document.body so no ancestor stacking context can place it under the sidebar/top bar.
  return createPortal(
    <div className="modal-backdrop">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`modal-panel outline-none ${size === 'md' ? 'max-w-lg' : size === 'lg' ? 'max-w-3xl' : 'max-w-5xl'}`}
      >
        <div className="modal-header">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id={titleId} className="section-title truncate">{title}</h2>
              {headerExtra}
            </div>
            {subtitle && <p id={subtitleId} className="mt-0.5 truncate text-small text-fg-muted">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm shrink-0" onClick={onClose} aria-label={closeLabel}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className={`modal-body ${bodyClassName}`}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
