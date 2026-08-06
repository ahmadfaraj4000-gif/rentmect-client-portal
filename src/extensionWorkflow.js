export const RENTMECT_TIME_ZONE = 'America/New_York';
export const RETURN_CONFIRMATION_WINDOW_MINUTES = 60;

function readTimeParts(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();
  if (hour > 23 || minute > 59 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

function timeZoneOffsetMilliseconds(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  const renderedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return renderedAsUtc - date.getTime();
}

export function parseRentMeCtDateTime(dateValue, timeValue) {
  const dateMatch = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = readTimeParts(timeValue || '11:59 PM');
  if (!dateMatch || !time) return null;

  const wallClockUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    time.hour,
    time.minute,
  );
  let resolved = new Date(wallClockUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    resolved = new Date(wallClockUtc - timeZoneOffsetMilliseconds(resolved, RENTMECT_TIME_ZONE));
  }
  return Number.isNaN(resolved.getTime()) ? null : resolved;
}

export function formatRentMeCtDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: RENTMECT_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function getReturnCountdown(date, time, now = Date.now()) {
  const due = parseRentMeCtDateTime(date, time);
  if (!due) return { label: 'No Active Return Due', value: 'Pending', canConfirm: false, unlockAt: null };

  const millisecondsRemaining = due.getTime() - now;
  const absolute = Math.abs(millisecondsRemaining);
  const days = Math.floor(absolute / 86400000);
  const hours = Math.floor((absolute % 86400000) / 3600000);
  const minutes = Math.floor((absolute % 3600000) / 60000);
  const value = days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
  const unlockAt = new Date(due.getTime() - RETURN_CONFIRMATION_WINDOW_MINUTES * 60000);

  if (millisecondsRemaining <= 0) {
    return {
      label: 'Return Is Due',
      value: millisecondsRemaining < 0 ? `${value} overdue` : 'Due now',
      canConfirm: true,
      unlockAt,
      due,
    };
  }

  if (now >= unlockAt.getTime()) {
    return { label: 'Return Window Open', value, canConfirm: true, unlockAt, due };
  }

  return { label: 'Return Countdown', value, canConfirm: false, unlockAt, due };
}

export function getExtensionRequestWindow(rental, now = Date.now()) {
  if (!rental?.id) return { open: false, message: 'Extensions open after a rental is active.' };

  const status = String(rental.status || '').toLowerCase();
  if (!['active', 'overdue'].includes(status)) {
    return { open: false, message: 'Extensions open after the rental is active and within 24 hours of return.' };
  }

  const due = parseRentMeCtDateTime(rental.return_date, rental.return_time);
  if (!due) return { open: false, message: 'Return time is missing for this rental.' };
  const opensAt = new Date(due.getTime() - 86400000);

  if (now < opensAt.getTime()) {
    return {
      open: false,
      opensAt,
      message: `Extension requests open ${formatRentMeCtDateTime(opensAt)}, 24 hours before your booked return.`,
    };
  }

  return { open: true, opensAt, due, message: `Request window opened ${formatRentMeCtDateTime(opensAt)}.` };
}

export function validateExtensionReturn(rental, form, now = Date.now()) {
  const currentReturn = parseRentMeCtDateTime(rental?.return_date, rental?.return_time);
  const requestedReturn = parseRentMeCtDateTime(form?.returnDate, form?.returnTime);
  if (!requestedReturn) return { valid: false, message: 'Choose a valid new return date and time.' };
  if (!currentReturn) return { valid: false, message: 'The current rental return time is unavailable. Contact Rent Me CT.' };
  if (requestedReturn.getTime() <= currentReturn.getTime()) {
    return { valid: false, message: 'The new return must be later than your current booked return.' };
  }
  if (requestedReturn.getTime() <= now) {
    return { valid: false, message: 'The new return must be in the future.' };
  }
  return { valid: true, message: '', currentReturn, requestedReturn };
}

export function getExtensionWorkflowStage({
  choice,
  pendingExtension,
  approvedExtension,
  latestExtension,
  insuranceDocument,
  preview,
}) {
  if (approvedExtension) return 'payment';
  if (pendingExtension) {
    if (!insuranceDocument || insuranceDocument.status === 'rejected') return 'insurance';
    if (insuranceDocument.status !== 'approved') return 'insurance_review';
    return 'admin_review';
  }
  if (!['extend', 'exchange'].includes(choice)) {
    if (latestExtension?.status === 'activated') return 'active';
    if (latestExtension && ['rejected', 'cancelled', 'expired'].includes(latestExtension.status)) return 'recovery';
    return 'goal';
  }
  if (preview) return 'quote';
  return 'details';
}
