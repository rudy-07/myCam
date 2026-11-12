/** Shared, defensive JSON handling for authentication requests. API contracts remain unchanged. */
export async function postAuthJson(path, payload) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Could not reach myCam. Check that the backend is running and try again.');
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { data = await response.json(); } catch { /* invalid JSON: treated as "no usable body" below */ }
  } else if (contentType.includes('text/plain')) {
    // Only plain text is safe to show. HTML (proxy/gateway error pages, SPA fallbacks) is never surfaced.
    try {
      const text = (await response.text()).trim();
      if (text) data = { message: text.slice(0, 240) };
    } catch { /* empty response */ }
  }

  if (!response.ok) {
    const message = typeof data?.message === 'string' && data.message.trim()
      ? data.message
      : `Request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }
  return data || {};
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'lower', label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { id: 'number', label: 'One number', test: (value) => /[0-9]/.test(value) },
  { id: 'special', label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function passwordChecks(password) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) }));
}

export function generateStrongPassword(length = 16) {
  const groups = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789', '!@#$%^&*()_+'];
  const all = groups.join('');
  const randomIndex = (max) => {
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % max;
    }
    return Math.floor(Math.random() * max);
  };
  const chars = groups.map((group) => group[randomIndex(group.length)]);
  while (chars.length < Math.max(8, length)) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const PASSWORD_MAX_LENGTH = 128;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,40}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns '' when the password satisfies the backend policy (server/auth.cjs), otherwise the first problem. */
export function validatePasswordPolicy(password) {
  const value = typeof password === 'string' ? password : '';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > PASSWORD_MAX_LENGTH) return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a special character.';
  return '';
}

/** Mirrors the backend registration rules so obvious mistakes are caught before a request is sent. */
export function validateRegistration({ name, username, email, password }) {
  if (typeof name !== 'string' || !name.trim()) return 'Enter your full name.';
  if (name.length > 100) return 'Name must be 100 characters or fewer.';
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-40 characters: letters, numbers, dots, dashes or underscores.';
  }
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  return validatePasswordPolicy(password);
}
