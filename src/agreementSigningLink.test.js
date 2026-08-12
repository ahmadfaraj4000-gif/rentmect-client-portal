import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('agreement email links open the requested rental agreement directly', () => {
  assert.match(source, /params\.get\('agreement'\) !== '1'/);
  assert.match(source, /params\.get\('rental'\)/);
  assert.match(source, /setPreviewCheckoutSection\('agreement'\)/);
  assert.match(source, /setAgreementModalOpen\(true\)/);
});
