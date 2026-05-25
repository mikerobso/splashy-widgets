// POST /api/share/create — mints a new share record and returns its
// short URL. Called from the widget's share button. CORS-open so it
// works from any client domain that embeds a SPLSHY widget.

import { generateShareId, validateShareInput, writeShare } from '../../lib/share';

export const config = { runtime: 'edge' };

const ALLOWED_METHODS = 'POST, OPTIONS';

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '600',
  };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status:  405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid JSON body');
  }

  const validated = validateShareInput(body);
  if (typeof validated === 'string') return jsonError(400, validated);

  const id = generateShareId();
  const ok = await writeShare(id, validated);
  if (!ok) return jsonError(500, 'store failed');

  return new Response(
    JSON.stringify({
      id,
      url: `https://splshy.com/r/${id}`,
    }),
    {
      status:  200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    }
  );
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
