export function formatMerchantPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join('-');
}
export const easternToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateKey = date => date.toISOString().slice(0,10);
export const readableDate = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}) : 'Choose date';
export const inputDate = value => value ? `${value.slice(5,7)}/${value.slice(8,10)}/${value.slice(0,4)}` : '';
export function parseInputDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return '';
  const iso = `${match[3]}-${match[1]}-${match[2]}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === iso ? iso : '';
}
export function formatDateInput(value) {
  const digits=String(value).replace(/\D/g,'').slice(0,8);
  return [digits.slice(0,2),digits.slice(2,4),digits.slice(4)].filter(Boolean).join('/');
}
export function moveMonth(value,delta){const d=new Date(`${value.slice(0,7)}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+delta);return dateKey(d);}
