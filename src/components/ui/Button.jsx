import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-subtle': 'btn-danger-subtle',
};

/**
 * Shared button. Pass `loading` for async actions: it disables the button,
 * shows a spinner and sets aria-busy so it cannot be double-submitted.
 * Icon-only buttons must supply `aria-label`.
 */
const Button = ({
  variant = 'secondary', size = 'md', icon: Icon, iconOnly = false, loading = false,
  block = false, className = '', children, disabled, type = 'button', ...rest
}) => {
  if (iconOnly && !rest['aria-label'] && import.meta.env?.DEV) {
    console.warn('Button: icon-only buttons need an aria-label.');
  }
  const classes = [
    'btn', VARIANTS[variant] || VARIANTS.secondary,
    size === 'sm' ? 'btn-sm' : '', iconOnly ? 'btn-icon' : '', block ? 'btn-block' : '', className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
    </button>
  );
};

export default Button;
