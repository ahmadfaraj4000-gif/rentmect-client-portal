import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('requesting a phone code saves the current renter details before invoking Twilio Verify', () => {
  const sendCodeSource = source.slice(
    source.indexOf('async function sendPhoneCode()'),
    source.indexOf('async function verifyPhoneCode'),
  );

  const savePosition = sendCodeSource.indexOf('await saveProfileDetails(false)');
  const invokePosition = sendCodeSource.indexOf("supabase.functions.invoke('send-phone-code'");
  assert.ok(savePosition >= 0, 'sendPhoneCode must save the profile');
  assert.ok(invokePosition > savePosition, 'Twilio Verify must run only after the profile save');
  assert.match(sendCodeSource, /body: \{ phone: savedPhone \}/);
  assert.doesNotMatch(sendCodeSource, /body: \{ phone: normalizeUSPhone\(profileForm\.phone\) \}/);
});

test('editing the phone invalidates stale verification and clears any old code', () => {
  const updatePhoneSource = source.slice(
    source.indexOf('function updateProfilePhone(nextPhone)'),
    source.indexOf('async function sendPhoneCode()'),
  );

  assert.match(updatePhoneSource, /setPhoneCode\(''\)/);
  assert.match(updatePhoneSource, /profile\?\.phone_verified/);
  assert.match(updatePhoneSource, /nextNormalizedPhone === savedPhone/);
  assert.equal((source.match(/updateProfilePhone\((?:e|event)\.target\.value\)/g) || []).length, 2);
});

test('both booking contact surfaces explain that phone saving is automatic', () => {
  assert.match(source, /Save Details & Send Verification Code/);
  assert.match(source, /Save details & send verification code/);
  assert.equal(
    (source.match(/Your renter details and phone number are saved automatically before the code is sent\./g) || []).length,
    2,
  );
  assert.doesNotMatch(source, />\s*Save Profile\s*</);
});
