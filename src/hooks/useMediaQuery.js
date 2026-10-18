import { useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query. Returns a boolean that updates on change. */
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
