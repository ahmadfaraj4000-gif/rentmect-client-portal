import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./main.jsx', import.meta.url), 'utf8');

test('customer invoice and checkout surfaces show reservation-only discounts', () => {
  const matches = source.match(/Manual reservation discount/g) || [];
  assert.ok(matches.length >= 4);
  assert.match(source, /currentRental\.manual_discount_amount/);
  assert.match(source, /currentRental\.pre_manual_discount_rental_total/);
});

test('agreement snapshot records the manual reservation discount', () => {
  assert.match(source, /Manual Reservation Discount:/);
});
