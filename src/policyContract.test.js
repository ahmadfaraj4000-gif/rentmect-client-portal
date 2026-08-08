import test from 'node:test';
import assert from 'node:assert/strict';
import { AGREEMENT_TEXT, AGREEMENT_VERSION } from './rentalAgreement.js';

test('current agreement publishes the 30-minute and two-hour late-return thresholds', () => {
  assert.equal(AGREEMENT_VERSION, 'rentmect-master-v2026-08-08-late-mileage-r1');
  assert.match(AGREEMENT_TEXT, /At thirty \(30\) minutes after the scheduled return time/);
  assert.match(AGREEMENT_TEXT, /more than two \(2\) hours after the scheduled return time/);
  assert.match(AGREEMENT_TEXT, /in addition to the twenty-five dollar \(\$25\) late return fee/);
});

test('current agreement includes 250 miles per rental day', () => {
  assert.match(AGREEMENT_TEXT, /Two hundred fifty \(250\) miles per day are included/);
  assert.match(AGREEMENT_TEXT, /Mileage Included: 250 miles\/day/);
  assert.doesNotMatch(AGREEMENT_TEXT, /Two hundred \(200\) miles per day|Mileage Included: 200 miles\/day/);
});
