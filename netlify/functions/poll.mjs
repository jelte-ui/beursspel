import { getStore } from '@netlify/blobs';
const SYMS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "BRK.B", "AVGO", "LLY", "JPM", "V", "WMT", "XOM", "UNH", "MA", "PG", "JNJ", "HD", "COST", "ORCL", "ABBV", "BAC", "KO", "MRK", "CVX", "NFLX", "CRM", "AMD", "PEP", "ADBE", "TMO", "LIN", "MCD", "CSCO", "ACN", "ABT", "DIS", "WFC", "INTC", "QCOM", "TXN", "IBM", "GE", "CAT", "AMGN", "VZ", "PFE", "NKE", "UBER", "SHEL", "BA", "PYPL", "SBUX", "GS", "MS", "T", "LOW", "HON", "UPS", "SPGI", "BLK", "SCHW", "MDT", "DE", "LMT", "PLTR", "SNOW", "SHOP", "SQ", "COIN", "ABNB", "ZM", "SPOT", "ASML", "TSM", "SAP", "TM", "BABA", "NVO", "AZN", "BP", "TTE", "RIO", "F", "GM", "MU", "AMAT", "LRCX", "PANW", "CRWD", "DDOG", "ROKU", "PINS", "SNAP", "RBLX", "DASH", "LYFT", "EA", "TGT"];
const COINS = {"BTC": "bitcoin", "ETH": "ethereum", "BNB": "binancecoin", "SOL": "solana", "XRP": "ripple", "DOGE": "dogecoin", "ADA": "cardano", "AVAX": "avalanche-2", "LINK": "chainlink", "DOT": "polkadot", "TRX": "tron", "MATIC": "polygon-ecosystem-token", "LTC": "litecoin", "BCH": "bitcoin-cash", "ATOM": "cosmos", "NEAR": "near", "UNI": "uniswap", "APT": "aptos", "ARB": "arbitrum", "OP": "optimism", "AAVE": "aave", "ALGO": "algorand", "FIL": "filecoin", "ICP": "internet-computer", "ETC": "ethereum-classic", "XLM": "stellar", "HBAR": "hedera-hashgraph", "VET": "vechain", "INJ": "injective-protocol", "SUI": "sui", "SEI": "sei-network", "TIA": "celestia", "RUNE": "thorchain", "MKR": "maker", "LDO": "lido-dao", "GRT": "the-graph", "SAND": "the-sandbox", "MANA": "decentraland", "AXS": "axie-infinity", "CAKE": "pancakeswap-token", "SHIB": "shiba-inu", "PEPE": "pepe", "BONK": "bonk", "WIF": "dogwifcoin", "FET": "fetch-ai", "RNDR": "render-token", "IMX": "immutable-x", "STX": "blockstack", "EGLD": "elrond-erd-2", "TON": "the-open-network"};
const PAIRS = ["EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "EURCHF", "GBPJPY", "AUDJPY", "EURAUD", "EURCAD", "GBPCHF", "CADJPY", "CHFJPY", "USDMXN", "USDZAR", "USDTRY"];
const J = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };
// Bewaar volledig de laatste 3 uur, daarna 1 punt per 10 minuten tot 26 uur terug.
function trim(a, now) {
  const keep = []; let lastB = -1;
  for (const p of a) {
    if (p[0] < now - 26 * 36e5) continue;
    if (p[0] > now - 3 * 36e5) keep.push(p);
    else { const b = Math.floor(p[0] / 6e5); if (b !== lastB) { keep.push(p); lastB = b; } }
  }
  return keep;
}
// Draait elke minuut: aandelen (Finnhub, 50 per minuut), crypto (CoinGecko), goud/zilver (gold-api.com) en forex.
export default async () => {
  const key = process.env.FINNHUB_KEY, st = getStore('beursspel'), now = Date.now();
  const cur = (await st.get('cursor', { type: 'json' })) || 0;
  const hist = (await st.get('hist', { type: 'json' })) || {};
  const add = (id, p) => {
    if (!(p > 0)) return false;
    const a = hist[id] || (hist[id] = []), l = a[a.length - 1];
    if (!l || l[1] !== p || now - l[0] > 6e5) a.push([now, p]);
    return true;
  };
  const got = { stocks: 0, crypto: 0, metals: 0, forex: 0 };
  if (key) {
    const batch = Array.from({ length: 50 }, (_, i) => SYMS[(cur + i) % SYMS.length]);
    await Promise.all(batch.map(async s => {
      const j = await J('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(s) + '&token=' + key);
      if (j && add(s, j.c)) got.stocks++;
    }));
  } else console.log('FINNHUB_KEY ontbreekt');
  const cg = await J('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=' + Object.values(COINS).join(','));
  if (cg) for (const [sym, id] of Object.entries(COINS)) if (cg[id] && add(sym, cg[id].usd)) got.crypto++;
  for (const m of ['XAU', 'XAG']) { const j = await J('https://api.gold-api.com/price/' + m); if (j && add(m, j.price)) got.metals++; }
  let rt = null;
  if (key) { const j = await J('https://finnhub.io/api/v1/forex/rates?base=USD&token=' + key); if (j && j.quote && j.quote.EUR) rt = j.quote; }
  if (!rt) { const j = await J('https://api.frankfurter.dev/v1/latest?base=USD'); if (j && j.rates) rt = j.rates; }
  if (rt) {
    rt.USD = 1;
    for (const p of PAIRS) { const b = p.slice(0, 3), q = p.slice(3); if (rt[b] && rt[q] && add(p, rt[q] / rt[b])) got.forex++; }
    if (rt.EUR) add('__EUR', rt.EUR);
  }
  for (const k in hist) hist[k] = trim(hist[k], now);
  await st.setJSON('hist', hist);
  await st.setJSON('cursor', (cur + 50) % SYMS.length);
  console.log('opgehaald', JSON.stringify(got));
};
export const config = { schedule: '* * * * *' };
