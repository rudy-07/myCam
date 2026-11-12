import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../src/components/ui/Modal';
import { ToastProvider, useToast } from '../../src/context/ToastContext';

describe('Modal', () => {
  const Host = ({ onClose = () => {} }) => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button onClick={() => setOpen(true)}>Open it</button>
        {open && <Modal title="Details" subtitle="More info" onClose={() => { onClose(); setOpen(false); }} footer={<button>Footer action</button>}><button>Inside one</button><button>Inside two</button></Modal>}
      </div>
    );
  };
  it('is an accessible, labelled modal dialog', async () => {
    const user = userEvent.setup(); render(<Host />);
    await user.click(screen.getByText('Open it'));
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('More info');
  });
  it('locks body scroll while open and restores it, and returns focus to the opener', async () => {
    const user = userEvent.setup(); render(<Host />);
    const opener = screen.getByText('Open it');
    await user.click(opener);
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('');
    expect(opener).toHaveFocus();
  });
  it('closes from the close button and Escape, calling onClose each time', async () => {
    const onClose = vi.fn(); const user = userEvent.setup(); render(<Host onClose={onClose} />);
    await user.click(screen.getByText('Open it'));
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText('Open it'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('traps Tab focus inside the dialog', async () => {
    const user = userEvent.setup(); render(<Host />);
    await user.click(screen.getByText('Open it'));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 8; i += 1) { await user.tab(); expect(dialog.contains(document.activeElement)).toBe(true); }
    for (let i = 0; i < 8; i += 1) { await user.tab({ shift: true }); expect(dialog.contains(document.activeElement)).toBe(true); }
  });
  it('renders the footer', async () => {
    const user = userEvent.setup(); render(<Host />);
    await user.click(screen.getByText('Open it'));
    expect(screen.getByText('Footer action')).toBeInTheDocument();
  });
});

describe('Toast notifications', () => {
  const Trigger = ({ message = 'Hello', type, duration }) => { const { addToast } = useToast(); return <button onClick={() => addToast(message, type, duration)}>fire {message}</button>; };
  it.each([['success', 'status'], ['error', 'alert'], ['warning', 'status'], ['info', 'status']])('%s toast uses role %s', async (type, role) => {
    const user = userEvent.setup(); render(<ToastProvider><Trigger type={type} /></ToastProvider>);
    await user.click(screen.getByText('fire Hello'));
    expect(screen.getByRole(role)).toHaveTextContent('Hello');
  });
  it('can be dismissed manually', async () => {
    const user = userEvent.setup(); render(<ToastProvider><Trigger type="info" /></ToastProvider>);
    await user.click(screen.getByText('fire Hello'));
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Hello', { selector: 'p, span, div' })).not.toBeInTheDocument();
  });
  it('disappears by itself after its duration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime }); render(<ToastProvider><Trigger type="info" duration={1000} /></ToastProvider>);
      await user.click(screen.getByText('fire Hello'));
      expect(screen.getByRole('status')).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
  it('shows at most a few toasts at once', async () => {
    const Many = () => { const { addToast } = useToast(); return <button onClick={() => { for (let i = 0; i < 12; i += 1) addToast(`msg ${i}`, 'info', 60000); }}>many</button>; };
    const user = userEvent.setup(); render(<ToastProvider><Many /></ToastProvider>);
    await user.click(screen.getByText('many'));
    const shown = screen.getAllByRole('status').length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(12);
    expect(screen.getByText('msg 11')).toBeInTheDocument(); // newest is always kept
  });
});
