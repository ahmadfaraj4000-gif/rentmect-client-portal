import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExtensionRequestWindow,
  getExtensionWorkflowStage,
  getReturnCountdown,
  parseRentMeCtDateTime,
  validateExtensionReturn,
} from './extensionWorkflow.js';

test('parses rental wall-clock values in America/New_York', () => {
  assert.equal(parseRentMeCtDateTime('2026-08-06', '9:00 AM').toISOString(), '2026-08-06T13:00:00.000Z');
  assert.equal(parseRentMeCtDateTime('2026-12-06', '9:00 AM').toISOString(), '2026-12-06T14:00:00.000Z');
});

test('return confirmation unlocks only during the final hour', () => {
  const due = parseRentMeCtDateTime('2026-08-06', '9:00 AM').getTime();
  assert.equal(getReturnCountdown('2026-08-06', '9:00 AM', due - 2 * 3600000).canConfirm, false);
  assert.equal(getReturnCountdown('2026-08-06', '9:00 AM', due - 30 * 60000).canConfirm, true);
  assert.equal(getReturnCountdown('2026-08-06', '9:00 AM', due + 1).canConfirm, true);
});

test('extension window reports the exact opening time', () => {
  const rental = { id: 'rental', status: 'active', return_date: '2026-08-06', return_time: '9:00 AM' };
  const due = parseRentMeCtDateTime(rental.return_date, rental.return_time).getTime();
  const closed = getExtensionRequestWindow(rental, due - 25 * 3600000);
  assert.equal(closed.open, false);
  assert.match(closed.message, /Aug 5, 2026.*9:00 AM EDT/);
  assert.equal(getExtensionRequestWindow(rental, due - 23 * 3600000).open, true);
});

test('new extension return must be later than the current return', () => {
  const rental = { return_date: '2026-08-06', return_time: '9:00 AM' };
  assert.equal(validateExtensionReturn(rental, { returnDate: '2026-08-06', returnTime: '8:30 AM' }, Date.UTC(2026, 7, 5)).valid, false);
  assert.equal(validateExtensionReturn(rental, { returnDate: '2026-08-06', returnTime: '9:00 AM' }, Date.UTC(2026, 7, 5)).valid, false);
  assert.equal(validateExtensionReturn(rental, { returnDate: '2026-08-06', returnTime: '9:30 AM' }, Date.UTC(2026, 7, 5)).valid, true);
});

test('workflow exposes one current stage', () => {
  assert.equal(getExtensionWorkflowStage({ choice: '' }), 'goal');
  assert.equal(getExtensionWorkflowStage({ choice: 'extend' }), 'details');
  assert.equal(getExtensionWorkflowStage({ choice: 'extend', preview: {} }), 'quote');
  assert.equal(getExtensionWorkflowStage({ pendingExtension: {}, insuranceDocument: null }), 'insurance');
  assert.equal(getExtensionWorkflowStage({ pendingExtension: {}, insuranceDocument: { status: 'pending_review' } }), 'insurance_review');
  assert.equal(getExtensionWorkflowStage({ pendingExtension: {}, insuranceDocument: { status: 'approved' } }), 'admin_review');
  assert.equal(getExtensionWorkflowStage({ approvedExtension: {} }), 'payment');
  assert.equal(getExtensionWorkflowStage({ latestExtension: { status: 'activated' } }), 'active');
  assert.equal(getExtensionWorkflowStage({ latestExtension: { status: 'rejected' } }), 'recovery');
});
