import test from 'node:test';
import assert from 'node:assert/strict';
import { AGREEMENT_TEXT, AGREEMENT_VERSION } from './rentalAgreement.js';

test('current agreement requires explicit approval instead of automatic late charges', () => {
  assert.equal(AGREEMENT_VERSION, 'rentmect-master-v2026-11-13-admin-return-r1');
  assert.match(AGREEMENT_TEXT, /There is no automatic late-return fee or automatic additional rental-day charge/);
  assert.match(AGREEMENT_TEXT, /until Company confirms its physical return/);
  assert.match(AGREEMENT_TEXT, /must be explicitly approved by Company/);
});

test('current agreement includes 250 miles per rental day', () => {
  assert.match(AGREEMENT_TEXT, /Two hundred fifty \(250\) miles per day are included/);
  assert.match(AGREEMENT_TEXT, /Mileage Included: 250 miles\/day/);
  assert.doesNotMatch(AGREEMENT_TEXT, /Two hundred \(200\) miles per day|Mileage Included: 200 miles\/day/);
});
