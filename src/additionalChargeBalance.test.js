import test from 'node:test';
import assert from 'node:assert/strict';
import { additionalChargeBalance } from './additionalChargeBalance.js';
test('customer balances use unpaid remainders and keep deposits and waivers separate', () => {
 const charge = {status:'pending',total_amount:26,allocation_managed:true,allocated_payment_cents:1000};
 assert.equal(additionalChargeBalance(charge),16);
 assert.equal(additionalChargeBalance({...charge,allocated_deposit_cents:600}),10);
 assert.equal(additionalChargeBalance({...charge,allocated_waiver_cents:1600,status:'waived'}),0);
 assert.equal(additionalChargeBalance({...charge,status:'paid'}),0);
 assert.equal(additionalChargeBalance({status:'pending',total_amount:26}),26);
 assert.equal(additionalChargeBalance({status:'pending',total_amount:117.26,allocated_payment_cents:1726}),100);
 assert.equal(additionalChargeBalance({...charge,included_in_initial_payment:true}),0);
 assert.equal(charge.total_amount,26);
});
