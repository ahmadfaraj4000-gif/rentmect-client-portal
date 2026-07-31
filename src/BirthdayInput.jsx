import React, { useEffect, useRef, useState } from 'react';

function splitDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match
    ? { month: match[2], day: match[3], year: match[1] }
    : { month: '', day: '', year: '' };
}

function ageForDate(value, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() + 1 !== month ||
    birthDate.getDate() !== day ||
    birthDate > today
  ) return null;
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) age -= 1;
  return age;
}

function readableBirthday(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return '';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BirthdayInput({
  value,
  onChange,
  confirmed,
  onConfirmedChange,
  minimumAge = 21,
  idPrefix = 'birthday',
  autoFocus = false,
}) {
  const [parts, setParts] = useState(() => splitDate(value));
  const internalValueRef = useRef(String(value || ''));
  const monthRef = useRef(null);
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  useEffect(() => {
    const externalValue = String(value || '');
    if (externalValue === internalValueRef.current) return;
    internalValueRef.current = externalValue;
    setParts(splitDate(externalValue));
  }, [value]);

  const complete = parts.month.length === 2 && parts.day.length === 2 && parts.year.length === 4;
  const candidate = complete ? `${parts.year}-${parts.month}-${parts.day}` : '';
  const age = ageForDate(candidate);
  const isRealDate = age !== null;
  const plausibleAge = isRealDate && age <= 120;
  const eligible = plausibleAge && age >= minimumAge;
  const hasAnyInput = Boolean(parts.month || parts.day || parts.year);

  function updatePart(key, rawValue) {
    const maxLength = key === 'year' ? 4 : 2;
    const nextValue = String(rawValue || '').replace(/\D/g, '').slice(0, maxLength);
    const next = { ...parts, [key]: nextValue };
    setParts(next);

    const nextComplete = next.month.length === 2 && next.day.length === 2 && next.year.length === 4;
    const nextDate = nextComplete ? `${next.year}-${next.month}-${next.day}` : '';
    internalValueRef.current = nextDate;
    onChange(nextDate);
    onConfirmedChange(false);

    if (key === 'month' && nextValue.length === 2) dayRef.current?.focus();
    if (key === 'day' && nextValue.length === 2) yearRef.current?.focus();
  }

  function handleKeyDown(event, key) {
    if (event.key !== 'Backspace' || event.currentTarget.value) return;
    if (key === 'day') monthRef.current?.focus();
    if (key === 'year') dayRef.current?.focus();
  }

  const statusId = `${idPrefix}-status`;
  return (
    <fieldset className="birthday-input" aria-describedby={statusId}>
      <legend>Date of birth</legend>
      <div className="birthday-segments" role="group" aria-label="Date of birth, month day and year">
        <label>
          <span>MM</span>
          <input
            ref={monthRef}
            id={`${idPrefix}-month`}
            name="bday-month"
            type="text"
            inputMode="numeric"
            autoComplete="bday-month"
            pattern="[0-9]*"
            placeholder="MM"
            value={parts.month}
            onChange={(event) => updatePart('month', event.target.value)}
            aria-label="Birth month, two digits"
            autoFocus={autoFocus}
          />
        </label>
        <span className="birthday-divider" aria-hidden="true">/</span>
        <label>
          <span>DD</span>
          <input
            ref={dayRef}
            id={`${idPrefix}-day`}
            name="bday-day"
            type="text"
            inputMode="numeric"
            autoComplete="bday-day"
            pattern="[0-9]*"
            placeholder="DD"
            value={parts.day}
            onChange={(event) => updatePart('day', event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, 'day')}
            aria-label="Birth day, two digits"
          />
        </label>
        <span className="birthday-divider" aria-hidden="true">/</span>
        <label className="birthday-year">
          <span>YYYY</span>
          <input
            ref={yearRef}
            id={`${idPrefix}-year`}
            name="bday-year"
            type="text"
            inputMode="numeric"
            autoComplete="bday-year"
            pattern="[0-9]*"
            placeholder="YYYY"
            value={parts.year}
            onChange={(event) => updatePart('year', event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, 'year')}
            aria-label="Birth year, four digits"
          />
        </label>
      </div>

      <div id={statusId} className={`birthday-status ${complete && !eligible ? 'error' : eligible ? 'valid' : ''}`} aria-live="polite">
        {!complete && hasAnyInput && 'Enter the complete month, day, and four-digit year.'}
        {complete && !isRealDate && 'That birthday is not a real calendar date. Check the month, day, and year.'}
        {complete && isRealDate && !plausibleAge && 'Check the four-digit birth year and try again.'}
        {complete && isRealDate && age < minimumAge && `Renters must be at least ${minimumAge}. This birthday is not eligible.`}
        {eligible && <strong>{readableBirthday(candidate)} — Age {age}</strong>}
      </div>

      <label className={`birthday-confirmation ${!eligible ? 'disabled' : ''}`}>
        <input
          type="checkbox"
          checked={Boolean(confirmed && eligible)}
          disabled={!eligible}
          onChange={(event) => onConfirmedChange(event.target.checked)}
        />
        <span>This birthday exactly matches my government ID.</span>
      </label>
    </fieldset>
  );
}
