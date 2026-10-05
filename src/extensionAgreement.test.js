import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionAgreementDetails } from './extensionAgreement.js';

const request = { status: 'approved_pending_payment', request_kind: 'same_vehicle_extension',
  original_return_date: '2026-10-03', original_return_time: '8:00 PM',
  requested_return_date: '2026-10-10', requested_return_time: '8:00 PM',
  agreed_daily_rate: 69, extension_days: 7, extension_rental_amount: 483,
  extension_tax_amount: 30.67, extension_total_amount: 513.67 };
const date = (day, time) => `${day} ${time}`;
const money = (value) => `$${Number(value).toFixed(2)}`;
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
