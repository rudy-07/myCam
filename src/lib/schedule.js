export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const JS_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MAX_NAME_LENGTH = 60;

/** days_json may be a JSON string, an array, null or garbage. Never throws. */
export const parseDays = (raw) => {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return { days: [], valid: false }; }
  }
  if (value === null || value === undefined) return { days: [], valid: false };
  if (!Array.isArray(value)) return { days: [], valid: false };
  const days = DAYS.filter((d) => value.includes(d));
  return { days, valid: true };
};

/** "22:00:00" -> "22:00". Returns '' when the value is not a time. */
export const toHHMM = (value) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''));
  if (!m) return '';
  const h = Number(m[1]); const min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

/** A window whose end is earlier than its start runs overnight (e.g. 22:00 to 06:00). */
export const isOvernight = (start, end) => Boolean(start && end && end < start);

/**
 * Is `now` inside this schedule's window? This mirrors the check the camera viewer
 * uses: the schedule must be enabled, today's weekday must be selected, and the time
 * must be inside the window (an overnight window wraps past midnight).
 * It says nothing about whether anything is being recorded.
 */
export const isWindowOpenNow = (schedule, now = new Date()) => {
  if (!(schedule?.is_active === true || Number(schedule?.is_active) === 1)) return false;
  const { days, valid } = parseDays(schedule.days_json);
  if (!valid || !days.length) return false;
  const start = toHHMM(schedule.start_time);
  const end = toHHMM(schedule.end_time);
  if (!start || !end || start === end) return false;
  const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (start < end) return days.includes(JS_DAY[now.getDay()]) && t >= start && t <= end;
  // For an overnight window, the early-morning portion belongs to the day
  // on which the window started (e.g. Monday 22:00-Tuesday 06:00).
  if (t >= start) return days.includes(JS_DAY[now.getDay()]);
  if (t <= end) return days.includes(JS_DAY[(now.getDay() + 6) % 7]);
  return false;
};

export const summarizeDays = (days) => {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';
  if (days.join() === 'Mon,Tue,Wed,Thu,Fri') return 'Weekdays';
  if (days.join() === 'Sat,Sun') return 'Weekends';
  return days.join(', ');
};

/** Returns { field: message }. Overnight windows (end earlier than start) are valid. */
export const validateSchedule = ({ name, days, start_time, end_time }) => {
  const errors = {};
  const trimmed = (name || '').trim();
  if (!trimmed) errors.name = 'Give the schedule a name.';
  else if (trimmed.length > MAX_NAME_LENGTH) errors.name = `Use ${MAX_NAME_LENGTH} characters or fewer.`;
  if (!days.length) errors.days = 'Select at least one day.';
  if (!toHHMM(start_time)) errors.start_time = 'Enter a start time.';
  if (!toHHMM(end_time)) errors.end_time = 'Enter an end time.';
  if (!errors.start_time && !errors.end_time && toHHMM(start_time) === toHHMM(end_time)) {
    errors.end_time = 'End time must differ from the start time.';
  }
  return errors;
};
