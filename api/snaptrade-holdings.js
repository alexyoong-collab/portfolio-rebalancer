// GET /api/snaptrade-holdings
// Fetches live positions and cash balance for the SMSF AU Stake account.
// Account ID is hardcoded for single-user personal use.
// Returns holdings in the same shape the frontend already expects.

const { snaptradeRequest } = require('./_snaptrade');

const SMSF_AU_ACCOUNT_ID = '2f7d211a-e784-4e08-8ee2-ef692f37bf31';

module.exports = async function handler(req, res) {
  // Allow the frontend to call this from the browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const userId = process.env.SNAPTRADE_USER_ID || 'me';
    const userSecret = process.env.SNAPTRADE_USER_SECRET;

    if (!userSecret) {
      return res.status(400).json({
        error: 'SNAPTRADE_USER_SECRET is not set.',
      });
    }

    // Fetch positions and balances in parallel
    const [positionsRes, balancesRes] = await Promise.all([
      snaptradeRequest('GET', `/accounts/${SMSF_AU_ACCOUNT_ID}/positions`, {
        query: { userId, userSecret },
      }),
      snaptradeRequest('GET', `/accounts/${SMSF_AU_ACCOUNT_ID}/balances`, {
        query: { userId, userSecret },
      }),
    ]);

    // Cash balance in AUD
    const cashBalance = (balancesRes || [])
      .filter(b => b.currency?.code === 'AUD')
      .reduce((sum, b) => sum + (b.cash || 0), 0);

    // Map positions into the shape the frontend expects
    const holdings = (positionsRes?.positions || [])
      .map(pos => {
        const symbol = pos.instrument?.symbol?.replace('.XA', '') || 'UNKNOWN';
        const name = pos.instrument?.description || symbol;
        const units = parseFloat(pos.units) || 0;
        const price = parseFloat(pos.price) || 0;
        const costBasis = parseFloat(pos.cost_basis) || 0;
        const value = units * price;
        const totalCost = costBasis * units;
        const totalReturn = totalCost > 0 ? value - totalCost : 0;
        const totalReturnPct = totalCost > 0
          ? `${((totalReturn / totalCost) * 100).toFixed(2)}%`
          : '—';

        return {
          symbol,
          name,
          units,
          price: Math.round(price * 100) / 100,
          value: Math.round(value * 100) / 100,
          totalReturn: Math.round(totalReturn * 100) / 100,
          totalReturnPct,
        };
      })
      .filter(h => h.value > 0);

    return res.status(200).json({
      holdings,
      cash: Math.round(cashBalance * 100) / 100,
      account: 'YOONG SUPERANNUATION FUND (AU)',
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('snaptrade-holdings error:', err);
    return res.status(err.status || 500).json({ error: err.message, detail: err.body });
  }
};
