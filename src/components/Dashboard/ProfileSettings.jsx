import React, { useState, useRef } from 'react';
import { User, Save, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, Field } from '../ui';
import { useToast } from '../../context/ToastContext';
import { sendJson } from '../../lib/api';
import { API_BASE } from '../../config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Profile name and email.
 *
 * The sign-in response does not include an email address and there is no endpoint to
 * read it back, but PUT /api/user/profile always writes name AND email together. So when
 * the email is not known here the field starts empty and the person must type the address
 * to store. An unknown email is never sent as an empty value.
 */
const ProfileSettings = ({ user, onUserUpdate }) => {
  const { addToast } = useToast();
  const emailKnown = typeof user?.email === 'string' && user.email.trim() !== '';
  const base = { name: user?.name || '', email: emailKnown ? user.email : '' };
  const [edits, setEdits] = useState(null);
  const values = edits ?? base;
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const lock = useRef(false);
  const nameRef = useRef(null);
  const emailRef = useRef(null);

  const dirty = Boolean(edits && (edits.name !== base.name || edits.email !== base.email));
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  if (!name) errors.name = 'Enter your name.';
  else if (name.length > 100) errors.name = 'Use 100 characters or fewer.';
  if (!email) errors.email = emailKnown ? 'Enter an email address.' : 'Enter the email address you want stored.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    setSubmitted(true);
    if (errors.name) { nameRef.current?.focus(); return; }
    if (errors.email) { emailRef.current?.focus(); return; }
    lock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const data = await sendJson(`${API_BASE}/api/user/profile`, 'PUT', { id: user.id, name, email });
      onUserUpdate?.({ name: data?.user?.name ?? name, email: data?.user?.email ?? email });
      setEdits(null);
      setSubmitted(false);
      addToast('Profile saved.', 'success');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="card card-body" aria-labelledby="profile-heading">
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <span className="flex size-10 items-center justify-center rounded-control border border-border bg-surface-sunken text-accent">
          <User className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="profile-heading" className="section-title">Profile</h2>
          <p className="text-small text-fg-muted">{user?.username ? <>Signed in as <span className="font-mono">@{user.username}</span></> : 'Your name and contact email.'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {!emailKnown && (
          <div role="note" className="callout callout-info">
            <AlertTriangle aria-hidden="true" />
            <p>
              Your current email address is not available on this screen, so it cannot be shown. myCam saves your name and email together,
              so to update your profile enter the email you want stored. It replaces the email on file.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Full name" error={submitted ? errors.name : undefined}>
            <input ref={nameRef} type="text" autoComplete="name" className="input" value={values.name} onChange={(e) => setEdits({ ...values, name: e.target.value })} />
          </Field>
          <Field label="Email address" error={submitted ? errors.email : undefined}>
            <input ref={emailRef} type="email" autoComplete="email" className="input" value={values.email} placeholder={emailKnown ? undefined : 'you@example.com'} onChange={(e) => setEdits({ ...values, email: e.target.value })} />
          </Field>
        </div>

        {saveError && (
          <div role="alert" className="callout callout-danger">
            <AlertTriangle aria-hidden="true" />
            <p>The profile was not saved: {saveError} Your changes are still in the form.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && <Button variant="ghost" icon={RotateCcw} onClick={() => { setEdits(null); setSubmitted(false); setSaveError(''); }} disabled={saving}>Discard changes</Button>}
          <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={!dirty}>{saving ? 'Saving…' : 'Save profile'}</Button>
        </div>
      </form>
    </section>
  );
};

export default ProfileSettings;
