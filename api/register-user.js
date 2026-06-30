// POST /api/register-user
// One-time setup: registers a SnapTrade user and returns a userSecret.
//
// IMPORTANT: SnapTrade's userSecret must be saved somewhere and reused for every
// future request (connect-link, holdings, etc). For a single-user personal app,
// the simplest approach is to save it once and paste it into a Vercel environment
// variable called SNAPTRADE_USER_SECRET, then redeploy.
//
// Body: { "userId": "your-chosen-id" }   e.g. { "userId": "me" }

const { snaptradeRequest } = require('./_snaptrade');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required, e.g. { "userId": "me" }' });
    }

    const result = await snaptradeRequest('POST', '/snapTrade/registerUser', {
      body: { userId },
    });

    // result looks like: { userId: "me", userSecret: "xxxxxxxx-xxxx-..." }
    return res.status(200).json({
      message:
        'User registered. Copy the userSecret below into a new Vercel environment variable called SNAPTRADE_USER_SECRET, then redeploy. You only need to do this once.',
      ...result,
    });
  } catch (err) {
    console.error('register-user error:', err);
    return res.status(err.status || 500).json({ error: err.message, detail: err.body });
  }
};
