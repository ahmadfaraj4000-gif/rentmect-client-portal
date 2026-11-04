import { customerMatchFeedback } from './merchantCustomer.js';
// Explain failures without exposing the existing customer's saved identity values.
export function merchantFailure(error) {
  if(error?.customerMatch)return customerMatchFeedback(error.customerMatch);
  const raw=error?.message||'Something went wrong. Please try again. If it continues, contact Rent Me CT.';
  if(raw.includes('Customer details require Rent Me CT review'))return {
    title:raw.includes('Existing identity details were not changed')?'Existing customer found — check details':'Check customer account',
    message:raw.includes('Existing identity details were not changed')
      ?'The customer details entered do not match the existing Rent Me CT account. Check the customer’s legal name, email, phone number and date of birth. If they are correct, contact Rent Me CT to review the account before continuing. Existing identity details were not changed.'
      :'Rent Me CT needs to review this customer account before the reservation can continue. Check the customer details and contact Rent Me CT if they are correct.',
    selector:'[data-merchant-section="customer"] input',
  };
  if(raw.includes('already has an open rental'))return customerMatchFeedback({status:'open_rental'});
  if(/failed to fetch|failed to send a request|networkerror|load failed/i.test(raw))return {title:'Connection problem',message:'Could not reach Rent Me CT. Check your internet connection, then try again.',selector:'[data-merchant-section="review"] button[type="submit"]'};
  let selector='[data-merchant-section="review"] button[type="submit"]';
  if(/availability|available vehicle|pickup and drop-off|quote/i.test(raw))selector='[data-merchant-section="vehicle"] button';
  else if(/25|birth|aged/i.test(raw))selector='[name="ageConfirmation"]';
  else if(/license/i.test(raw))selector='[data-merchant-section="customer"] input[title]';
  else if(/insurance|coverage/i.test(raw))selector='[data-merchant-section="insurance"] input';
  return {title:'Unable to continue',message:raw,selector};
}

export function invalidMerchantField(field) {
  const label=field.labels?.[0];
  const labelText=label&&([...label.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join(' ').trim()||label.querySelector('span')?.textContent);
  const name=labelText||field.getAttribute('aria-label')||'This field';
  const hint=field.validity.patternMismatch&&field.title?field.title:field.validationMessage;
  return `${name}: ${hint||'Please complete this field before continuing.'}`;
}
