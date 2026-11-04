import test from 'node:test';
import assert from 'node:assert/strict';
import { customerIdentityKey, customerLookupReady, customerMatchFeedback } from './merchantCustomer.js';
import { merchantFailure } from './merchantFeedback.js';
test('customer results invalidate for every identity field',()=>{
  const customer={fullName:'Test Driver',email:'driver@example.test',phone:'860-555-0101',dateOfBirth:'1990-01-01'};
  for(const key of Object.keys(customer))assert.notEqual(customerIdentityKey(customer),customerIdentityKey({...customer,[key]:'changed'}));
  assert.equal(customerIdentityKey(customer),customerIdentityKey({...customer,address:'new address'}));
  assert.equal(customerLookupReady({...customer,email:''}),true);
  assert.equal(customerLookupReady({...customer,phone:''}),true);
  assert.equal(customerLookupReady({email:'incomplete',phone:'860'}),false);
});
test('existing customer mismatch focuses the specific field while a match explains reuse',()=>{
  const feedback=merchantFailure(Object.assign(new Error('Customer account needs attention'),{customerMatch:{status:'mismatch',fields:['dateOfBirth']}}));
  assert.equal(feedback.selector,'[name="dateOfBirth"]');
  assert.match(feedback.title,/Existing customer found/);
  assert.match(feedback.message,/date of birth/);
  assert.match(customerMatchFeedback({status:'existing'}).message,/will use that account/);
  assert.match(merchantFailure(new Error('This customer already has an open rental. Contact Rent Me CT.')).title,/open rental/);
});
