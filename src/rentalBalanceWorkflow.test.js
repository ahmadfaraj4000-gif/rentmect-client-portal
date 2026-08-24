import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./main.jsx', import.meta.url), 'utf8');

test('partially paid rentals reopen payment for only the remainder', () => {
  assert.match(source, /paymentPartiallyPaid/);
  assert.match(source, /remainingRentalBalance/);
  assert.match(source, /paidRentalBalancePayments/);
  assert.match(source, /currentRentalPaidToDate/);
  assert.match(source, /Payments Credited/);
  assert.match(source, /currentRentalBalanceDue/);
  assert.match(source, /previous payment and deposit remain credited/i);
});

test('system rental balances stay separate from additional charges', () => {
  assert.match(source, /!\['rental_amendment', 'rental_installment'\]\.includes\(charge\.charge_type\)/);
  assert.match(source, /charge\.charge_type === 'rental_amendment'/);
});

test('charge reconciliation reloads the parent rental payment status', () => {
  assert.match(source, /targetType === 'charge'[\s\S]*from\('rentals'\)/);
});
