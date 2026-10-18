import React from 'react';

/** Empty / error / unavailable container. tone: neutral | error | info */
const EmptyState = ({ icon: Icon, title, description, action, tone = 'neutral', className = '' }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`rounded-card border border-dashed px-6 py-12 text-center ${tone === 'error' ? 'border-danger/40 bg-danger-soft' : 'border-border-strong bg-surface/50'} ${className}`}
  >
    {Icon && <Icon className={`mx-auto mb-3 size-9 ${tone === 'error' ? 'text-danger' : 'text-fg-subtle'}`} aria-hidden="true" />}
    <p className="section-title">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-md text-small text-fg-muted">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export default EmptyState;
