export const onRequestGet = () => Response.json({ ok: true, time: new Date().toISOString() });

export const onRequestOptions = () => new Response(null, { status: 204 });
