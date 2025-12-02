import { createTrackingService } from '../../../tracking/src/service.js';

const ALLOWED_METHODS = 'GET,OPTIONS';

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
    console.error('Tracking global endpoint misconfigured', error);
    return json({ ok: false, error: 'Tracking API missing Supabase configuration.' }, 500);
  }

  try {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? Number(daysParam) : undefined;
    const snapshot = await service.fetchGlobalSnapshot(days);
    return json({ ok: true, data: snapshot });
  } catch (error) {
    console.error('Failed to load global snapshot', error);
    return json({ ok: false, error: 'Failed to load global snapshot.' }, 500);
  }
};

export const onRequestOptions = () => optionsResponse();
