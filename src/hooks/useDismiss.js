import { useEffect } from 'react';

/**
 * Close a popover when Escape is pressed or the user clicks/taps outside it.
 * `ref` should wrap both the trigger and the popover.
 * `restoreFocusRef` (optional): element to focus after an Escape dismissal.
 */
export default function useDismiss(ref, open, onClose, restoreFocusRef) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      onClose();
      restoreFocusRef?.current?.focus();
    };
    const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [ref, open, onClose, restoreFocusRef]);
}
