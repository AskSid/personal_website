import { createTrackingService } from '../../../tracking/src/service.js';

const ALLOWED_METHODS = 'GET,POST,OPTIONS';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': ALLOWED_METHODS
  };
}

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders() });
}

function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function buildService(env) {
  return createTrackingService(env);
}

export const onRequestGet = async ({ request, env }) => {
  let service;
  try {
    service = buildService(env);
  } catch (error) {
    console.error('Tracking daily endpoint misconfigured', error);
    return json({ ok: false, error: 'Tracking API missing Supabase configuration.' }, 500);
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? undefined;
    const snapshot = await service.fetchDailySnapshot(date);
    return json({ ok: true, data: snapshot });
  } catch (error) {
    console.error('Failed to load daily snapshot', error);
    return json({ ok: false, error: 'Failed to load daily snapshot.' }, 500);
  }
};

export const onRequestPost = async ({ request, env }) => {
  let body;

  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const { date, updates } = body ?? {};
  if (!Array.isArray(updates)) {
    return json({ ok: false, error: 'updates must be an array.' }, 400);
  }

  let service;
  try {
    service = buildService(env);
  } catch (error) {
    console.error('Tracking daily endpoint misconfigured', error);
    return json({ ok: false, error: 'Tracking API missing Supabase configuration.' }, 500);
  }

  try {
    const payload = await service.persistDailyEntries(date, updates);
    return json({ ok: true, data: payload });
  } catch (error) {
    console.error('Failed to save daily entries', error);
    return json({ ok: false, error: 'Failed to save daily entries.' }, 500);
  }
};

export const onRequestOptions = () => optionsResponse();
