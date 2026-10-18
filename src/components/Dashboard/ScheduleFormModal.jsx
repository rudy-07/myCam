import React, { useState, useRef } from 'react';
import { AlertTriangle, Moon } from 'lucide-react';
import { Button, Field, Modal } from '../ui';
import { API_BASE } from '../../config';
import { sendJson } from '../../lib/api';
import { BROADCASTER_ID, BROADCASTER_LABEL, cameraLabel } from '../../lib/cameras';
import { DAYS, MAX_NAME_LENGTH, parseDays, toHHMM, isOvernight, validateSchedule } from '../../lib/schedule';

const PRESETS = [
  { label: 'Every day', days: DAYS },
  { label: 'Weekdays', days: DAYS.slice(0, 5) },
  { label: 'Weekends', days: DAYS.slice(5) },
];

/**
 * Create or edit a schedule. One form for both:
 *  - create: POST /api/schedules {user_id, camera_id, name, days, start_time, end_time}
 *  - edit:   PUT  /api/schedules/:id {name, days, start_time, end_time}
 *            (the route cannot change the camera and the edit sends no is_active,
 *             so editing never alters the enabled state)
 * The modal stays open, with the entered values, until the server confirms the save.
 */
const ScheduleFormModal = ({ user, schedule, onClose, onSaved }) => {
  const editing = Boolean(schedule);
  const [form, setForm] = useState(() => ({
    name: schedule?.name ?? '',
    camera_id: schedule?.camera_id ?? BROADCASTER_ID,
    days: schedule ? parseDays(schedule.days_json).days : [...DAYS],
    start_time: schedule ? toHHMM(schedule.start_time) : '22:00',
    end_time: schedule ? toHHMM(schedule.end_time) : '06:00',
  }));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const lock = useRef(false);
  const refs = { name: useRef(null), start_time: useRef(null), end_time: useRef(null), days: useRef(null) };

  const errors = validateSchedule(form);
  const shown = submitted ? errors : {};
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleDay = (d) => set({ days: DAYS.filter((x) => (x === d ? !form.days.includes(d) : form.days.includes(x))) });
  const overnight = !errors.start_time && !errors.end_time && isOvernight(form.start_time, form.end_time);

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    setSubmitted(true);
    const first = ['name', 'days', 'start_time', 'end_time'].find((k) => errors[k]);
    if (first) { refs[first].current?.focus(); return; }

    lock.current = true;
    setSaving(true);
    setServerError('');
    const payload = { name: form.name.trim(), days: form.days, start_time: form.start_time, end_time: form.end_time };
    try {
      if (editing) await sendJson(`${API_BASE}/api/schedules/${schedule.id}`, 'PUT', payload);
      else await sendJson(`${API_BASE}/api/schedules`, 'POST', { user_id: user.id, camera_id: form.camera_id, ...payload });
      onSaved(editing ? 'Schedule updated.' : 'Schedule saved.');
    } catch (err) {
      setServerError(err.message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      size="md"
      title={editing ? 'Edit schedule' : 'New schedule'}
      subtitle={editing ? schedule.name : 'Automatic recording requires an open, live camera viewer during the scheduled window.'}
      closeLabel="Close dialog"
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <span />
          <div className="flex gap-2">
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" form="schedule-form" variant="primary" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save schedule'}
            </Button>
          </div>
        </>
      )}
    >
      <form id="schedule-form" onSubmit={submit} noValidate className="space-y-5 p-5">
        <Field label="Schedule name" error={shown.name}>
          <input ref={refs.name} type="text" className="input" value={form.name} maxLength={MAX_NAME_LENGTH + 20} autoComplete="off"
            onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Night watch or weekend guard" />
        </Field>

        <Field label="Target camera" help={editing ? 'The camera cannot be changed after a schedule is created.' : 'Only the connected mobile broadcaster is available.'}>
          <select className="select" value={form.camera_id} disabled={editing} onChange={(e) => set({ camera_id: e.target.value })}>
            <option value={form.camera_id}>{editing ? cameraLabel(form.camera_id) : BROADCASTER_LABEL}</option>
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Field label="Start time" error={shown.start_time}>
            <input ref={refs.start_time} type="time" className="input font-mono" value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} />
          </Field>
          <Field label="End time" error={shown.end_time}>
            <input ref={refs.end_time} type="time" className="input font-mono" value={form.end_time} onChange={(e) => set({ end_time: e.target.value })} />
          </Field>
        </div>
        {overnight && (
          <p className="meta-text -mt-2 flex items-center gap-1.5" role="status">
            <Moon className="size-3.5 text-accent" aria-hidden="true" />
            Overnight window: from {form.start_time} until {form.end_time} the next day.
          </p>
        )}

        <fieldset>
          <legend className="label">Active days</legend>
          <div ref={refs.days} tabIndex={-1} className="grid grid-cols-4 gap-1.5 outline-none min-[420px]:grid-cols-7">
            {DAYS.map((day) => {
              const on = form.days.includes(day);
              return (
                <button type="button" key={day} onClick={() => toggleDay(day)} aria-pressed={on}
                  className={`btn btn-sm px-0 ${on ? 'btn-primary' : 'btn-secondary'}`}>
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.label} variant="ghost" size="sm" onClick={() => set({ days: [...p.days] })}>{p.label}</Button>
            ))}
          </div>
          {shown.days && <p role="alert" className="field-error">{shown.days}</p>}
        </fieldset>

        {serverError && (
          <div role="alert" className="callout callout-danger">
            <AlertTriangle aria-hidden="true" />
            <p>The schedule was not saved: {serverError} Your changes are still in the form.</p>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ScheduleFormModal;
