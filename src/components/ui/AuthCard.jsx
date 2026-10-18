import React from 'react';
import { ArrowLeft } from 'lucide-react';
import logoIcon from '../../assets/mycam_no_text.png';

/** Shared shell for sign-in / account screens (matches the legacy .login-* screens). */
const AuthCard = ({ title, subtitle, onBack, notice, error, children, footer }) => (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
    <div className="shell-bg" />
    <div className="shell-bg-grid" />
    <div className="relative z-10 w-full max-w-md animate-fade-up rounded-modal border border-border bg-surface p-6 shadow-overlay sm:p-8">
      {onBack && (
        <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -ml-2 mb-4">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </button>
      )}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-card border border-border bg-surface-sunken p-2.5">
          <img src={logoIcon} alt="" className="size-full object-contain" />
        </div>
        <h1 className="text-title font-bold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-small text-fg-muted">{subtitle}</p>}
      </div>

      {notice && !error && <div role="status" className="callout callout-success mb-5">{notice}</div>}
      {error && <div role="alert" className="callout callout-danger mb-5">{error}</div>}

      {children}
      {footer && <div className="mt-6 border-t border-border pt-4 text-center text-small text-fg-muted">{footer}</div>}
    </div>
  </main>
);

export default AuthCard;
