export const customerFieldNames = { fullName: 'legal name', email: 'email', phone: 'phone number', dateOfBirth: 'date of birth' };
export function customerIdentityKey(customer) {
  return JSON.stringify({fullName:customer.fullName, email:customer.email, phone:customer.phone, dateOfBirth:customer.dateOfBirth});
}
export function customerLookupReady(customer) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) || customer.phone.replace(/\D/g, '').length === 10;
}
export function customerMatchFeedback(match) {
  const fields = (match?.fields || []).filter(field => customerFieldNames[field]);
  const selector = `[name="${fields[0] || 'email'}"]`;
  switch (match?.status) {
    case 'existing': return { title: 'Existing customer found', message: 'The customer details match their Rent Me CT account. This reservation will use that account. Continue with the license, insurance and reservation details.', selector };
    case 'new': return { title: 'New customer', message: 'No existing account matches this email or phone. An account will be created when you reserve the vehicle.', selector };
    case 'mismatch': return { title: 'Existing customer found — check details', message: `Check ${fields.map(field => customerFieldNames[field]).join(', ')}. These details are missing or do not match the existing account. Correct the entered details to book with that account. If the saved account needs updating, contact Rent Me CT.`, selector };
    case 'open_rental': return { title: 'Existing customer — open rental', message: 'This customer already has an open rental. Resume it from Reservations if it belongs to your merchant, or contact Rent Me CT to resolve it before creating another.', selector };
    case 'ambiguous': return { title: 'Customer records conflict', message: 'The email or phone matches more than one account. Check both fields. Rent Me CT must resolve conflicting accounts before booking.', selector };
    case 'restricted': return { title: 'Account needs assistance', message: 'This account is not eligible for merchant booking. Contact Rent Me CT for assistance.', selector };
    default: return { title: 'Customer check unavailable', message: 'The customer account could not be checked. Try Check customer again.', selector };
  }
}
