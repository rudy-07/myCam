import React from 'react';
import { Loader2, AlertTriangle, WifiOff, Circle, CheckCircle2, MinusCircle } from 'lucide-react';

/**
 * One badge for every status. The label is always text (never colour alone).
 * The badge only DISPLAYS the status it is given; it never decides one.
 */
const STATUS = {
  live:        { cls: 'badge-success', label: 'Live', dot: true },
  connecting:  { cls: 'badge-warning', label: 'Connecting', icon: Loader2, spin: true },
  offline:     { cls: 'badge-neutral', label: 'Offline', icon: WifiOff },
  error:       { cls: 'badge-danger',  label: 'Error', icon: AlertTriangle },
  recording:   { cls: 'badge-danger',  label: 'Recording', dot: true },
  success:     { cls: 'badge-success', label: 'Success', icon: CheckCircle2 },
  warning:     { cls: 'badge-warning', label: 'Warning', icon: AlertTriangle },
  unavailable: { cls: 'badge-neutral', label: 'Unavailable', icon: MinusCircle },
  info:        { cls: 'badge-accent',  label: 'Info', icon: Circle },
};

const StatusBadge = ({ status, label, pulse = false, className = '' }) => {
  const meta = STATUS[status] || STATUS.unavailable;
  const Icon = meta.icon;
  return (
    <span className={`badge ${meta.cls} ${className}`}>
      {meta.dot && <span className={`badge-dot ${pulse ? 'animate-pulse-dot' : ''}`} aria-hidden="true" />}
      {Icon && <Icon className={`size-3.5 ${meta.spin ? 'animate-spin' : ''}`} aria-hidden="true" />}
      {label || meta.label}
    </span>
  );
};

export default StatusBadge;
