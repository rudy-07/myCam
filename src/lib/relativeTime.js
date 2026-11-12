/** Short relative label for an alert time ("just now", "5m ago", "3h ago", else a short date). `now` is injectable for tests. */
export function formatRelativeTime(iso, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMins = Math.floor((now - d.getTime()) / 60000);
  if (diffMins < 1) return 'just now'; // includes timestamps slightly in the future (clock skew)
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
