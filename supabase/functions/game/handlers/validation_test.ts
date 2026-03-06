/**
 * Edge Function handler validation tests.
 *
 * Tests parameter validation for game and night handlers.
 * Handlers reject bad input with 400 BEFORE touching the database,
 * so these tests run without a real Supabase instance.
 *
 * Run: deno test --no-check --allow-env --allow-net --allow-read supabase/functions/game/handlers/validation_test.ts
 */

import { strict as assert } from 'node:assert';

// Must set env vars BEFORE dynamic imports resolve supabaseAdmin.ts
Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Dynamic imports: env vars must be set before these modules load
const {
  handleSeat,
  handleSetAnimation,
  handleShareReview,
  handleStart,
  handleUpdateTemplateRoute,
  handleViewRole,
} = await import('./gameControl.ts');
const {
  handleAction,
  handleAudioAck,
  handleAudioGate,
  handleEnd,
  handleGroupConfirmAck,
  handleProgression,
  handleRevealAck,
  handleWolfRobotViewed,
} = await import('./night.ts');
const { missingParams } = await import('./shared.ts');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function jsonRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/game/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function expectMissingParams(response: Response): Promise<void> {
  assert.strictEqual(response.status, 400);
  const body = await response.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.reason, 'MISSING_PARAMS');
}

// ---------------------------------------------------------------------------
// shared.ts
// ---------------------------------------------------------------------------

Deno.test('missingParams returns 400 with MISSING_PARAMS', async () => {
  const res = missingParams();
  await expectMissingParams(res);
});

// ---------------------------------------------------------------------------
// gameControl handlers — parameter validation
// ---------------------------------------------------------------------------

Deno.test('handleSeat rejects missing roomCode', async () => {
  const res = await handleSeat(jsonRequest({ action: 'sit', uid: 'u1', seat: 1 }));
  await expectMissingParams(res);
});

Deno.test('handleSeat rejects missing uid', async () => {
  const res = await handleSeat(jsonRequest({ roomCode: 'ABCD', action: 'sit', seat: 1 }));
  await expectMissingParams(res);
});

Deno.test('handleSeat rejects missing action', async () => {
  const res = await handleSeat(jsonRequest({ roomCode: 'ABCD', uid: 'u1', seat: 1 }));
  await expectMissingParams(res);
});

Deno.test('handleSeat rejects invalid action value', async () => {
  const res = await handleSeat(
    jsonRequest({ roomCode: 'ABCD', action: 'invalid', uid: 'u1', seat: 1 }),
  );
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.reason, 'INVALID_ACTION');
});

Deno.test('handleSeat rejects sit with missing seat', async () => {
  const res = await handleSeat(jsonRequest({ roomCode: 'ABCD', action: 'sit', uid: 'u1' }));
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.reason, 'MISSING_SEAT');
});

Deno.test('handleSetAnimation rejects missing roomCode', async () => {
  const res = await handleSetAnimation(jsonRequest({ animation: 'flip' }));
  await expectMissingParams(res);
});

Deno.test('handleSetAnimation rejects missing animation', async () => {
  const res = await handleSetAnimation(jsonRequest({ roomCode: 'ABCD' }));
  await expectMissingParams(res);
});

Deno.test('handleStart rejects missing roomCode', async () => {
  const res = await handleStart(jsonRequest({}));
  await expectMissingParams(res);
});

Deno.test('handleUpdateTemplateRoute rejects missing roomCode', async () => {
  const res = await handleUpdateTemplateRoute(jsonRequest({ templateRoles: ['wolf'] }));
  await expectMissingParams(res);
});

Deno.test('handleUpdateTemplateRoute rejects missing templateRoles', async () => {
  const res = await handleUpdateTemplateRoute(jsonRequest({ roomCode: 'ABCD' }));
  await expectMissingParams(res);
});

Deno.test('handleUpdateTemplateRoute rejects non-array templateRoles', async () => {
  const res = await handleUpdateTemplateRoute(
    jsonRequest({ roomCode: 'ABCD', templateRoles: 'wolf' }),
  );
  await expectMissingParams(res);
});

Deno.test('handleViewRole rejects missing roomCode', async () => {
  const res = await handleViewRole(jsonRequest({ uid: 'u1', seat: 0 }));
  await expectMissingParams(res);
});

Deno.test('handleViewRole rejects missing uid', async () => {
  const res = await handleViewRole(jsonRequest({ roomCode: 'ABCD', seat: 0 }));
  await expectMissingParams(res);
});

Deno.test('handleViewRole rejects non-number seat', async () => {
  const res = await handleViewRole(jsonRequest({ roomCode: 'ABCD', uid: 'u1', seat: 'zero' }));
  await expectMissingParams(res);
});

Deno.test('handleShareReview rejects missing roomCode', async () => {
  const res = await handleShareReview(jsonRequest({ allowedSeats: [1, 2] }));
  await expectMissingParams(res);
});

Deno.test('handleShareReview rejects non-array allowedSeats', async () => {
  const res = await handleShareReview(jsonRequest({ roomCode: 'ABCD', allowedSeats: 'all' }));
  await expectMissingParams(res);
});

// ---------------------------------------------------------------------------
// night handlers — parameter validation
// ---------------------------------------------------------------------------

Deno.test('handleAction rejects missing roomCode', async () => {
  const res = await handleAction(jsonRequest({ seat: 0, role: 'wolf' }));
  await expectMissingParams(res);
});

Deno.test('handleAction rejects non-number seat', async () => {
  const res = await handleAction(jsonRequest({ roomCode: 'ABCD', seat: 'zero', role: 'wolf' }));
  await expectMissingParams(res);
});

Deno.test('handleAction rejects missing role', async () => {
  const res = await handleAction(jsonRequest({ roomCode: 'ABCD', seat: 0 }));
  await expectMissingParams(res);
});

Deno.test('handleAudioAck rejects missing roomCode', async () => {
  const res = await handleAudioAck(jsonRequest({}));
  await expectMissingParams(res);
});

Deno.test('handleAudioGate rejects missing roomCode', async () => {
  const res = await handleAudioGate(jsonRequest({ isPlaying: true }));
  await expectMissingParams(res);
});

Deno.test('handleAudioGate rejects non-boolean isPlaying', async () => {
  const res = await handleAudioGate(jsonRequest({ roomCode: 'ABCD', isPlaying: 'yes' }));
  await expectMissingParams(res);
});

Deno.test('handleEnd rejects missing roomCode', async () => {
  const res = await handleEnd(jsonRequest({}));
  await expectMissingParams(res);
});

Deno.test('handleProgression rejects missing roomCode', async () => {
  const res = await handleProgression(jsonRequest({}));
  await expectMissingParams(res);
});

Deno.test('handleRevealAck rejects missing roomCode', async () => {
  const res = await handleRevealAck(jsonRequest({}));
  await expectMissingParams(res);
});

Deno.test('handleWolfRobotViewed rejects missing roomCode', async () => {
  const res = await handleWolfRobotViewed(jsonRequest({ seat: 0 }));
  await expectMissingParams(res);
});

Deno.test('handleWolfRobotViewed rejects non-number seat', async () => {
  const res = await handleWolfRobotViewed(jsonRequest({ roomCode: 'ABCD', seat: 'zero' }));
  await expectMissingParams(res);
});

Deno.test('handleGroupConfirmAck rejects missing roomCode', async () => {
  const res = await handleGroupConfirmAck(jsonRequest({ seat: 0, uid: 'u1' }));
  await expectMissingParams(res);
});

Deno.test('handleGroupConfirmAck rejects non-number seat', async () => {
  const res = await handleGroupConfirmAck(
    jsonRequest({ roomCode: 'ABCD', seat: 'zero', uid: 'u1' }),
  );
  await expectMissingParams(res);
});

Deno.test('handleGroupConfirmAck rejects missing uid', async () => {
  const res = await handleGroupConfirmAck(jsonRequest({ roomCode: 'ABCD', seat: 0 }));
  await expectMissingParams(res);
});
