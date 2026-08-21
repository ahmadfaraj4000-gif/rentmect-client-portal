import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./BookingPreviewFleet.jsx', import.meta.url), 'utf8');

test('booking preview creates holds through the protected Edge Function', () => {
  assert.match(source, /supabase\.functions\.invoke\('website-booking-hold'/);
  assert.match(source, /'X-RentMe-Device': bookingDeviceId\(\)/);
  assert.doesNotMatch(source, /rpc\('create_website_pending_booking'/);
});

test('booking preview trusts the server hold expiry and handoff id', () => {
  assert.match(source, /protectedHold\?\.booking_id/);
  assert.match(source, /protectedHold\?\.expires_at/);
});
