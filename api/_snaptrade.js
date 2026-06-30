// Shared helper for signing and calling the SnapTrade API.
// This file is never exposed to the browser - it only runs on Vercel's servers.

const crypto = require('crypto');

const SNAPTRADE_BASE_URL = 'https://api.snaptrade.com/api/v1';

/**
 * Builds a signed SnapTrade request.
 * SnapTrade requires every request to be signed with your Consumer Key (kept server-side only)
 * using HMAC-SHA256 over a canonical JSON representation of {content, path, query}.
 */
function buildSignature({ path, query, body }) {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;

  if (!clientId || !consumerKey) {
    throw new Error('Missing SNAPTRADE_CLIENT_ID or SNAPTRADE_CONSUMER_KEY environment variables');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const queryParams = new URLSearchParams({ clientId, timestamp: String(timestamp), ...query });
  const queryString = queryParams.toString();

  const sigObject = {
    content: body || null,
    path,
    query: queryString,
  };

  const sigContent = JSON.stringify(sortKeysDeep(sigObject));

  const signature = crypto
    .createHmac('sha256', consumerKey)
    .update(sigContent)
    .digest('base64');

  return { queryString, signature, timestamp };
}

function sortKeysDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

/**
 * Makes a signed call to a SnapTrade endpoint.
 * @param {string} method - 'GET' | 'POST' | 'DELETE'
 * @param {string} path - e.g. '/snapTrade/registerUser'
 * @param {object} [options]
 * @param {object} [options.query] - extra query params (clientId/timestamp added automatically)
 * @param {object} [options.body] - JSON body for POST requests
 */
async function snaptradeRequest(method, path, { query = {}, body } = {}) {
  const { queryString, signature } = buildSignature({ path, query, body });

  const url = `${SNAPTRADE_BASE_URL}${path}?${queryString}&signature=${encodeURIComponent(signature)}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Signature: signature,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(json?.detail || json?.message || `SnapTrade request failed (${res.status})`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}

module.exports = { snaptradeRequest };
