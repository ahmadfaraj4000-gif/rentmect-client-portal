import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('the portal exposes one clear create-or-resume reservation action', () => {
  assert.match(source, /currentRental \? 'Resume Reservation' : 'Create Reservation'/);
  assert.doesNotMatch(source, /Resume Guided Steps|Continue Guided Steps|Choose a vehicle first/);
  assert.doesNotMatch(source, /onClick=\{createReservationIfNeeded\}/);
});

test('vehicle inventory loads explicitly and communicates its state', () => {
  assert.match(source, /setInventoryStatus\('loading'\)/);
  assert.match(source, /setInventoryStatus\(errors\.length \? 'error' : 'ready'\)/);
  assert.match(source, /Loading available vehicles…/);
  assert.match(source, /Retry Vehicles/);
  assert.match(source, /preloadVehicleImages\(vehiclesResult\.data\)/);
  assert.match(source, /loading="eager"/);
});

test('vehicle selection is required before the reservation action enables', () => {
  assert.match(source, /waitingForVehicleSelection/);
  assert.match(source, /vehicleInventoryUnavailable/);
  assert.match(source, /disabled=\{wizardPrimaryDisabled\}/);
  assert.match(source, /'Select a Vehicle'/);
});
