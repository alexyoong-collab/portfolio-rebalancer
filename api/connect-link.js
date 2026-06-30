// GET /api/connect-link
// Generates a secure, one-time-use URL that lets you log into the SnapTrade
// portal and connect a brokerage (Stake, Betashares, etc). Open the returned
// redirectURI in your browser to connect an account.
//
// Requires SNAPTRADE_USER_SECRET to already be set (see register-user.js).

const { snaptradeRequest } = require('./_snaptrade');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const userId = process.env.SNAPTRADE_USER_ID || 'me';
    const userSecret = process.env.SNAPTRADE_USER_SECRET;

    if (!userSecret) {
      return res.status(400).json({
        error:
          'SNAPTRADE_USER_SECRET is not set. Call /api/register-user first, then add the returned userSecret as a Vercel environment variable and redeploy.',
      });
    }

    const result = await snaptradeRequest('POST', '/snapTrade/login', {
      body: { userId, userSecret },
    });

    // result looks like: { redirectURI: "https://app.snaptrade.com/..." }
    return res.status(200).json({
      message: 'Open this URL in your browser to connect a brokerage account.',
      redirectURI: result.redirectURI,
    });
  } catch (err) {
    console.error('connect-link error:', err);
    return res.status(err.status || 500).json({ error: err.message, detail: err.body });
  }
};
