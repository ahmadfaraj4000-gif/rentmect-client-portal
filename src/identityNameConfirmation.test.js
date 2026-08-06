import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./final-overrides.css', import.meta.url), 'utf8');

test('Stripe Identity requires an explicit legal-name confirmation first', () => {
  assert.match(source, /setIdentityNameConfirmationOpen\(true\)/);
  assert.match(source, /function IdentityNameConfirmationModal/);
  assert.match(source, /Middle name or initial matters/);
  assert.match(source, /I checked my government ID/);
  assert.match(source, /disabled=\{!confirmed \|\| continuing\}/);
  assert.match(source, /callStripeIdentity\('create_identity_verification', true\)/);
});

test('the confirmation lets customers correct their legal name before Stripe', () => {
  assert.match(source, /function correctLegalNameBeforeIdentity/);
  assert.match(source, /setIdentityCorrectionTarget\('full_name'\)/);
  assert.match(source, /Correct legal name/);
  assert.match(styles, /\.identity-name-confirmation-modal/);
  assert.match(styles, /\.identity-name-confirm-checkbox/);
});
