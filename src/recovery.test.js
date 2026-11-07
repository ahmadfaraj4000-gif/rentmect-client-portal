import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { withReadRetry, withRequestDeadline, PORTAL_REQUEST_DEADLINE_MS } from './requestDeadline.js';
import { createAuthFetch } from './authFetch.js';
const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('an interrupted inventory read recovers readiness via the actual realtime/focus loader', async () => {
  let online = false;
  const state = { inventoryStatus: 'idle', health: {}, vehicles: [], blocks: [] };
  const chain = { select() { return this; }, eq() { return this; }, or() { return this; }, order() { return this; },
    then(resolve) { return Promise.resolve(online ? { data: [{ id: 'available-car' }], error: null } : { data: null, error: new Error('network interrupted') }).then(resolve); } };
  const context = { session: { user: { id: 'renter' } }, document: { visibilityState: 'visible' },
    supabase: { from: () => Object.create(chain), rpc: () => Object.create(chain) },
    BOOKING_FLOW_TEST_ENABLED: false, loadedPortalSectionsRef: { current: new Set() }, portalSectionLoadsRef: { current: new Map() },
    withReadRetry, window: globalThis, preloadVehicleImages() {},
    setInventoryStatus: value => { state.inventoryStatus = typeof value === 'function' ? value(state.inventoryStatus) : value; },
    setVehicles: value => { state.vehicles = value; }, setFleetRentals: value => { state.blocks = value; },
    setPortalHealth: update => { state.health = update(state.health); },
    recordPortalResults: results => results.filter(([, r]) => r.error),
    userFacingPortalError: e => e.message,
  };
  globalThis.window = globalThis;
  try {
    const start = source.indexOf('  async function loadPortalSection(');
    const end = source.indexOf('  async function loadPortalData(', start);
    const refreshStart = source.indexOf('    const refreshInventory =');
    const refreshEnd = source.indexOf('    const refreshRentals', refreshStart);
    vm.createContext(context);
    vm.runInContext(source.slice(start, end) + '\n' + source.slice(refreshStart, refreshEnd) + '\nglobalThis.refresh = refreshInventory;', context);
    await context.refresh();
    assert.equal(state.inventoryStatus, 'error');
    assert.equal(context.portalSectionLoadsRef.current.size, 0);
    online = true;
    await context.refresh();
    assert.equal(state.inventoryStatus, 'ready');
    assert.equal(state.vehicles.length, 1);
    assert.equal(state.blocks.length, 1);
    const background = context.refresh();
    assert.equal(state.inventoryStatus, 'ready', 'healthy refresh must not disable the vehicle picker');
    await background;
  } finally { delete globalThis.window; }
});

test('read budgets include session renewal and queries; timed-out reads abort before retry', async () => {
  assert.equal(PORTAL_REQUEST_DEADLINE_MS, 25_000);
  globalThis.window = globalThis;
  try {
    const signals = [];
    const result = await withReadRetry(() => ({ abortSignal(signal) {
      if (signals.length) assert.equal(signals.at(-1).aborted, true);
      signals.push(signal);
      return signals.length === 1 ? new Promise(() => {}) : Promise.resolve({ data: ['rental'], error: null });
    } }), 'Rentals', 10);
    assert.equal(signals.length, 2);
    assert.deepEqual(result.data, ['rental']);
    const rejected = await withRequestDeadline(Promise.reject(new TypeError('offline')), 'Session');
    assert.match(rejected.error.message, /offline/);
    let calls = 0;
    await withReadRetry(() => { calls++; return { error: { code: '42501', message: 'permission denied' } }; }, 'Rentals');
    assert.equal(calls, 1);
  } finally { delete globalThis.window; }
});

test('authentication timeout includes a stalled response body and later requests recover', async () => {
  let stalled = true;
  const bounded = createAuthFetch(async () => stalled
    ? new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } })
    : new Response('{"session":"recovered"}', { headers: { 'Content-Type': 'application/json' } }), 10);
  await assert.rejects(bounded('https://example.supabase.co/auth/v1/token'), /Session connection timed out/);
  stalled = false;
  assert.deepEqual(await (await bounded('https://example.supabase.co/auth/v1/token')).json(), { session: 'recovered' });
});

test('auth transport does not replay or impose new timeout behavior on booking/payment writes', async () => {
  const options = { method: 'POST', body: '{"rental":"one"}' };
  let calls = 0;
  const response = new Response('{}');
  const bounded = createAuthFetch(async (url, actual) => { calls++; assert.equal(actual, options); return response; }, 10);
  assert.equal(await bounded('https://example.supabase.co/rest/v1/rpc/create_rental_with_lock', options), response);
  assert.equal(calls, 1);
});

test('customer startup exits a hung session with retry feedback and removes its auth listener', async () => {
  const start = source.indexOf('  useEffect(() => {\n    let mounted = true;');
  const end = source.indexOf('\n\n  useEffect(', start);
  const state = { loading: true, error: '', unsubscribed: false };
  let cleanup;
  globalThis.window = globalThis;
  try {
    vm.runInNewContext(source.slice(start, end), {
      adminBookingToken: null, startupAttempt: 0,
      useEffect: effect => { cleanup = effect(); },
      setLoading: value => { state.loading = value; },
      setStartupError: value => { state.error = value; }, setSession() {},
      withRequestDeadline: (request, label) => withRequestDeadline(request, label, 10),
      supabase: { auth: { getSession: () => new Promise(() => {}), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { state.unsubscribed = true; } } } }) } },
    });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(state.loading, false);
    assert.match(state.error, /Session verification request timed out/);
    cleanup();
    assert.equal(state.unsubscribed, true);
  } finally { delete globalThis.window; }
});
