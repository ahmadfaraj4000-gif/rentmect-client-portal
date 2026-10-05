export function rentalPricingDetails(periods, money) {
  if (!periods?.length) return 'Rental pricing: See the saved rental totals below.';
  const dates = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  return 'Agreed pricing periods (Eastern):\n' + periods.map((period) =>
    `${dates.format(new Date(period.starts_at))} through ${dates.format(new Date(period.ends_at))}: ${money(period.daily_rate)}/day; ${money(Number(period.rental_amount) + Number(period.tax_amount))} rental and tax after adjustments.`
  ).join('\n');
}

export function extensionAgreementDetails(extension, vehicle, formatDate, money) {
  if (extension?.status !== 'approved_pending_payment') return '';
  const linked = extension.request_kind === 'switch_car_continuation';
  return `
APPROVED ${linked ? 'LINKED RENTAL' : 'EXTENSION'} — ACTIVATES AFTER PAYMENT
${linked ? `Replacement vehicle: ${vehicle?.name || 'As approved'}\n` : ''}Added period: ${formatDate(extension.original_return_date, extension.original_return_time)} through ${formatDate(extension.requested_return_date, extension.requested_return_time)}
Agreed daily rate: ${extension.agreed_daily_rate == null ? 'See approved rental amount below' : money(extension.agreed_daily_rate)}
Billable days: ${extension.extension_days}
Added rental: ${money(extension.extension_rental_amount)}
Added tax: ${money(extension.extension_tax_amount)}
${linked ? `Required deposit: ${money(extension.replacement_deposit_required)}\nExisting deposit carried: ${money(extension.deposit_carried_amount)}\nAdditional deposit: ${money(extension.deposit_increase_amount)}\n` : ''}Payment for this request: ${money(extension.extension_total_amount)}
Any unpaid balance from the original rental remains separate. The original return remains binding until payment activates this request.
`;
}
