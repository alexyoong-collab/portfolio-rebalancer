// GET /api/holdings
// Fetches all connected brokerage accounts, then returns positions (holdings,
// excluding cash) and cash balances in the same shape the frontend already
// expects from a Navexa CSV/XLSX upload.
//
// Requires SNAPTRADE_USER_SECRET to already be set (see register-user.js)
// and at least one brokerage connected via the link from connect-link.js.

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
          'SNAPTRADE_USER_SECRET is not set. Complete register-user and connect-link first.',
      });
    }

    // 1. List all accounts (one per connected brokerage, e.g. Stake + Betashares)
    const accounts = await snaptradeRequest('GET', '/accounts', {
      query: { userId, userSecret },
    });

    if (!accounts.length) {
      return res.status(200).json({
        holdings: [],
        cash: 0,
        message: 'No connected accounts yet. Use /api/connect-link to connect one.',
      });
    }

    let totalCash = 0;
    const holdings = [];

    // 2. For each account, pull positions (stocks/ETFs) and balances (cash)
    for (const account of accounts) {
      const accountId = account.id;

      const [positionsRes, balancesRes] = await Promise.all([
        snaptradeRequest('GET', `/accounts/${accountId}/positions`, {
          query: { userId, userSecret },
        }),
        snaptradeRequest('GET', `/accounts/${accountId}/balances`, {
          query: { userId, userSecret },
        }),
      ]);

      // Cash: sum balances across accounts (assumes AUD; multi-currency could be split out later)
      (balancesRes || []).forEach((bal) => {
        totalCash += bal.cash || 0;
      });

      // Positions: map into the same shape the app already uses
      // { symbol, name, value, totalReturn, totalReturnPct }
      (positionsRes || []).forEach((pos) => {
        const symbol = pos.symbol?.symbol?.symbol || pos.symbol?.symbol || 'UNKNOWN';
        const name = pos.symbol?.symbol?.description || symbol;
        const units = pos.units || 0;
        const price = pos.price || 0;
        const value = units * price;
        const costBasis = (pos.average_purchase_price || 0) * units;
        const totalReturn = costBasis > 0 ? value - costBasis : 0;
        const totalReturnPct = costBasis > 0 ? `${((totalReturn / costBasis) * 100).toFixed(2)}%` : '—';

        if (value > 0) {
          holdings.push({
            symbol,
            name,
            value: Math.round(value * 100) / 100,
            totalReturn: Math.round(totalReturn * 100) / 100,
            totalReturnPct,
            brokerage: account.brokerage_authorization?.brokerage?.name || account.institution_name || 'Unknown',
          });
        }
      });
    }

    return res.status(200).json({
      holdings,
      cash: Math.round(totalCash * 100) / 100,
      accountCount: accounts.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('holdings error:', err);
    return res.status(err.status || 500).json({ error: err.message, detail: err.body });
  }
};
