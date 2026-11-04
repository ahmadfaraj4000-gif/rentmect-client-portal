import assert from 'node:assert/strict';
import test from 'node:test';
import { customerMerchantIdentity, merchantBookingStatus, merchantEmail, merchantSignInOptions } from './merchantWorkflow.js';
test('an in-person check never carries over to another rental',()=>{
  const proof={rental_id:'first',verified:true};
  assert.equal(customerMerchantIdentity({id:'first',merchant_id:'carcraft'},proof),true);
  assert.equal(customerMerchantIdentity({id:'second',merchant_id:'carcraft'},proof),false);
  assert.equal(customerMerchantIdentity({id:'first'},proof),false);
  assert.equal(customerMerchantIdentity({id:'first',merchant_id:'carcraft'},{...proof,verified:false}),false);
});
test('paid does not mean ready and an old payment deadline never expires a paid reservation',()=>{
  assert.equal(merchantBookingStatus({status:'documents_needed',payment_status:'paid',payment_due_at:'2020-01-01'}),'Reserved · customer steps pending');
  assert.equal(merchantBookingStatus({status:'ready_for_pickup',payment_status:'paid'}),'Ready for pickup');
  assert.equal(merchantBookingStatus({status:'documents_needed',payment_status:'pending',payment_due_at:'2020-01-01'}),'Payment window expired');
});
test('merchant email is normalized and invalid addresses are rejected',()=>{
  assert.equal(merchantEmail(' Test@Example.com '),'test@example.com');
  for(const value of ['123','name@','a b@example.com']) assert.throws(()=>merchantEmail(value),/valid email/);
});
test('merchant sign-in cannot create accounts and preserves only the merchant redirect',()=>{
  const options=merchantSignInOptions('https://login.rentmect.com/?merchant=carcraft&adminRental=private#access_token=secret','carcraft');
  assert.deepEqual(options,{shouldCreateUser:false,emailRedirectTo:'https://login.rentmect.com/?merchant=carcraft'});
});
