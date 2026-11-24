import assert from 'node:assert/strict';
import test from 'node:test';
import { accountStatementIds } from './accountBilling.js';

test('older returned and in-progress rental statements remain available alongside a new booking', () => {
  const rentals = ['pending', 'returned', 'driving', 'legacy'].map((id, i) => ({
    id, status: ['pending', 'completed', 'active', 'rented'][i],
  }));
  assert.deepEqual(accountStatementIds(rentals, []), ['returned', 'driving', 'legacy']);
});

test('a cancelled reservation with a separate collectible charge can open its statement', () => {
  const rentals = ['fully-applied', 'owed', 'waived'].map(id => ({ id, status: 'cancelled' }));
  const charges = rentals.map(({id}) => ({
    rental_id: id, status: id === 'waived' ? 'waived' : 'pending',
    total_amount: 10, allocated_deposit_cents: id === 'fully-applied' ? 1000 : 0,
  }));
  assert.deepEqual(accountStatementIds(rentals, charges), ['owed']);
});
