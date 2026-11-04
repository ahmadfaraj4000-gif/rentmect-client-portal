export function merchantBookingStatus(booking) {
  if (booking.status === 'cancelled') return 'Cancelled';
  if (booking.status === 'completed') return 'Completed';
  if (['active', 'rented', 'overdue', 'return_initiated'].includes(booking.status)) return 'Rental in progress';
  if (booking.status === 'ready_for_pickup') return 'Ready for pickup';
  if (booking.payment_status === 'paid') return 'Reserved · customer steps pending';
  const deadline = booking.payment_due_at || booking.checkout_expires_at;
  if (deadline && new Date(deadline).getTime() <= Date.now()) return 'Payment window expired';
  return 'Awaiting payment';
}

export function merchantEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Enter a valid email address.');
  }
  return email;
}

export function merchantSignInOptions(href, slug) {
  const redirect = new URL(href);
  redirect.hash = '';
  redirect.search = '';
  redirect.searchParams.set('merchant', slug);
  return { shouldCreateUser: false, emailRedirectTo: redirect.toString() };
}

export function customerMerchantIdentity(currentRental, verification) {
  return Boolean(currentRental?.merchant_id && currentRental?.id === verification?.rental_id && verification?.verified === true);
}
