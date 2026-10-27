import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal panel over the page: Escape and the scrim close it, focus stays inside while it is open. */
export function Sheet({ id, label, className, onClose, children }: Props): React.JSX.Element {
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = sheet.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => { dialog?.close(); };
  }, []);

  return (
    <dialog ref={sheet} className={`menu-sheet ${className}`} id={id} aria-modal="true" aria-label={label}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, summary')]
          .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onClick={(event) => {
        // Backdrop clicks target the dialog, with coordinates outside its box.
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
