// Central Config for API and Socket routing via Vite HTTPS Proxy
export const API_BASE = '';
export const SOCKET_URL = typeof window !== 'undefined' ? window.location.origin : '';
