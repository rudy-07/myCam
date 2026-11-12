import React from 'react';

const PageHeader = ({ eyebrow, title, description, actions, as: Heading = 'h1' }) => (
  <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="mb-1 text-small font-medium text-accent">{eyebrow}</p>}
      {React.createElement(Heading, { className: 'page-title' }, title)}
      {description && <p className="mt-1 max-w-2xl text-small text-fg-muted">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
