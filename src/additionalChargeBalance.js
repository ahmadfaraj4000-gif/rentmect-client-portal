// Match the server's remaining balance without rewriting the original charge.
export function additionalChargeBalance(charge) {
  if (charge.included_in_initial_payment || ['paid', 'waived', 'cancelled'].includes(charge.status)) return 0;
  const original = Math.round(Number(charge.total_amount || 0) * 100);
  return Math.max(0, original - Number(charge.allocated_payment_cents || 0)
    - Number(charge.allocated_deposit_cents || 0) - Number(charge.allocated_waiver_cents || 0)) / 100;
}
