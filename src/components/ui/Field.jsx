import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Label + control + helper/error text with correct programmatic association.
 * Usage: <Field label="Email" error={err} help="..."><input className="input" .../></Field>
 * The single child receives id, aria-describedby and aria-invalid.
 */
const Field = ({ label, help, error, children, className = '' }) => {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ') || undefined;
  const control = React.cloneElement(React.Children.only(children), {
    id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined,
  });
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      {control}
      {help && <p id={helpId} className="field-help">{help}</p>}
      {error && (
        <p id={errorId} className="field-error" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};

export default Field;
