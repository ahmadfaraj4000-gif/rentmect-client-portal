import { additionalChargeBalance } from './additionalChargeBalance.js';

export function isTripInProgress(rental) {
  return ['active', 'rented', 'overdue', 'return_initiated'].includes(rental?.status);
}

export function accountStatementIds(rentals, charges) {
  const chargeBalances = new Set(charges.filter(charge =>
    ['pending', 'failed', 'checkout_open'].includes(charge.status) && additionalChargeBalance(charge) > 0
  ).map(charge => charge.rental_id));
  return rentals.filter(rental => rental.status === 'completed' || isTripInProgress(rental) ||
    (rental.status === 'cancelled' && chargeBalances.has(rental.id))
  ).map(rental => rental.id);
}
