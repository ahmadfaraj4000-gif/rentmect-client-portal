import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionAgreementDetails, rentalPricingDetails } from './extensionAgreement.js';

const request = { status: 'approved_pending_payment', request_kind: 'same_vehicle_extension',
  original_return_date: '2026-10-03', original_return_time: '8:00 PM',
  requested_return_date: '2026-10-10', requested_return_time: '8:00 PM',
  agreed_daily_rate: 69, extension_days: 7, extension_rental_amount: 483,
  extension_tax_amount: 30.67, extension_total_amount: 513.67 };
const date = (day, time) => `${day} ${time}`;
const money = (value) => `$${Number(value).toFixed(2)}`;
test('agreement uses saved periods and adjusted amounts after a mechanical replacement', () => {
  const text = rentalPricingDetails([
    { starts_at: '2026-09-17T22:00:00Z', ends_at: '2026-10-04T22:00:00Z', daily_rate: 49, rental_amount: 648.66, tax_amount: 41.19 },
    { starts_at: '2026-10-04T22:00:00Z', ends_at: '2026-10-09T22:00:00Z', daily_rate: 49, rental_amount: 245, tax_amount: 15.56 },
  ], money);
  assert.equal(text.match(/\$49.00\/day/g).length, 2);
  assert.match(text, /\$689.85 rental and tax after adjustments/);
  assert.match(text, /\$260.56 rental and tax after adjustments/);
  assert.match(text, /6:00 PM/);
});
test('agreement avoids claiming a fleet rate when dated pricing has not loaded', () => {
  assert.equal(rentalPricingDetails(undefined, money), 'Rental pricing: See the saved rental totals below.');
});
test('agreement includes approved dates and fixed quote before extension payment', () => {
  const text = extensionAgreementDetails(request, null, date, money);
  assert.match(text, /2026-10-03 8:00 PM through 2026-10-10 8:00 PM/);
  assert.match(text, /Agreed daily rate: \$69.00/);
  assert.match(text, /Payment for this request: \$513.67/);
  assert.match(text, /original return remains binding until payment/);
});
test('linked-rental agreement separates carried collateral from new payment', () => {
  const text = extensionAgreementDetails({ ...request, request_kind: 'switch_car_continuation',
    replacement_deposit_required: 500, deposit_carried_amount: 300, deposit_increase_amount: 200,
    extension_total_amount: 713.67 }, { name: 'Replacement Audi' }, date, money);
  assert.match(text, /Replacement vehicle: Replacement Audi/);
  assert.match(text, /Existing deposit carried: \$300.00/);
  assert.match(text, /Additional deposit: \$200.00/);
  assert.match(text, /Payment for this request: \$713.67/);
});
test('unapproved or already activated requests do not change a new agreement', () => {
  for (const status of ['pending', 'activated', 'rejected', 'expired']) {
    assert.equal(extensionAgreementDetails({ ...request, status }, null, date, money), '');
  }
  assert.equal(extensionAgreementDetails(null, null, date, money), '');
});
