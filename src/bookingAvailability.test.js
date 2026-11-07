import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setImmediate } from 'node:timers';
import { bookingAvailabilityKey as key, bookingAvailabilityDecision as decision, fetchBookingAvailability as fetchAvailability } from './bookingAvailability.js';

const trip = { pickupDate: '2026-11-08', pickupTime: '9:00 AM', returnDate: '2026-11-09', returnTime: '9:00 AM' };
const ready = rows => ({ key: key(trip), status: 'ready', rows });

test('the picker uses the server decision and preserves the blocking reason', async () => {
  const rows = [{ vehicle_id: 'car', available: false, reason: 'Vehicle awaiting physical return and inspection' }];
  const client = { rpc(name, args) {
    assert.equal(name, 'get_admin_calendar_fleet_availability');
    assert.deepEqual(args, { p_pickup_date: trip.pickupDate, p_pickup_time: trip.pickupTime, p_return_date: trip.returnDate, p_return_time: trip.returnTime });
    return { data: rows };
  } };
  assert.deepEqual(await fetchAvailability(client, trip), rows);
  assert.equal(decision(ready(rows), trip, 'car').available, false);
  assert.equal(decision(ready(rows), trip, 'car').reason, rows[0].reason);
  assert.equal(decision(ready([{ ...rows[0], available: true, reason: 'Available' }]), trip, 'car').available, true);
});

test('changed dates or times invalidate an earlier available result immediately', () => {
  const state = ready([{ vehicle_id: 'car', available: true }]);
  for (const field of Object.keys(trip)) {
    const changed = { ...trip, [field]: trip[field] + 'changed' };
    assert.equal(decision(state, changed, 'car').available, false);
    assert.equal(decision(state, changed, 'car').status, 'loading');
  }
  assert.equal(key({ ...trip, vehicleId: 'different' }), key(trip));
});

test('missing, malformed and failed responses never imply availability', async () => {
  assert.equal(decision(ready([]), trip, 'car').status, 'error');
  assert.equal(decision(ready([{ vehicle_id: 'car', available: 'true' }]), trip, 'car').available, false);
  assert.equal(decision({ ...ready([]), status: 'error', error: 'Connection timed out' }, trip, 'car').reason, 'Connection timed out');
  for (const data of [null, {}, [{ vehicle_id: 'car', available: 'true' }]]) {
    await assert.rejects(fetchAvailability({ rpc: () => ({ data }) }, trip), /could not be confirmed/);
  }
  await assert.rejects(fetchAvailability({ rpc: () => ({ error: { message: 'Connection timed out' } }) }, trip), /Connection timed out/);
});

test('the actual picker effect ignores a response from a superseded date window', async () => {
  const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const availabilityKey =');
  const end = source.indexOf('\n  const estimate =', start);
  const pending = [];
  let cleanup;
  let state;
  const context = {
    bookingAvailabilityKey: key, reservationForm: trip,
    session: { user: { id: 'customer' } }, wizardOpen: true, inventoryStatus: 'ready',
    availabilityAttempt: 0, vehicles: [{ id: 'car' }], supabase: {}, withReadRetry: () => {},
    useEffect: effect => { cleanup = effect(); },
    window: { setTimeout: callback => { callback(); return 1; }, clearTimeout() {} },
    setBookingAvailability: value => { state = value; },
    fetchBookingAvailability: () => new Promise(resolve => pending.push(resolve)),
  };
  vm.runInNewContext(source.slice(start, end), context);
  cleanup();
  const nextTrip = { ...trip, returnDate: '2026-11-10' };
  vm.runInNewContext(source.slice(start, end), { ...context, reservationForm: nextTrip });
  pending[1]([{ vehicle_id: 'car', available: false, reason: 'Blocked on the Rent Me CT calendar' }]);
  await new Promise(resolve => setImmediate(resolve));
  pending[0]([{ vehicle_id: 'car', available: true }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.key, key(nextTrip));
  assert.equal(state.rows[0].available, false);
  cleanup();
});

test('ordinary reservations recheck the server while existing holds retain their conversion path', () => {
  const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  async function createReservationIfNeeded()');
  const end = source.indexOf('  async function changeCheckoutDatesOrVehicle()', start);
  const create = source.slice(start, end);
  assert.match(create, /if \(!bookingId && !bookingFlowTestMode\)/);
  assert.match(create, /fetchBookingAvailability\(supabase, reservationForm, withReadRetry\)/);
  assert.match(create, /notify\(decision.reason\)/);
  assert.match(create, /convert_website_hold_to_rental/);
  assert.match(create, /create_rental_with_lock/);
  assert.doesNotMatch(source, /get_vehicle_booking_blocks|isVehicleAvailableForDates|rentalPeriodsOverlap/);
});
