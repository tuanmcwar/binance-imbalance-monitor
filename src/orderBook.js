
import { config } from "./config.js";

function parseLevels(levels) {
  return levels.map(([p, q]) => {
    const price = Number(p);
    const quantity = Number(q);

    return {
      price,
      quantity,
      notional: price * quantity
    };
  }).filter(item =>
    Number.isFinite(item.price) &&
    Number.isFinite(item.quantity) &&
    item.price > 0 &&
    item.quantity > 0
  );
}

function sumNotional(levels) {
  return levels.reduce(
    (total, item) => total + item.notional,
    0
  );
}

function biggestWall(levels, currentPrice) {
  let best = null;

  for (const level of levels) {
    if (!best || level.notional > best.notional) {
      best = level;
    }
  }

  if (!best) return null;

  return {
    ...best,
    distancePercent:
      ((best.price - currentPrice) / currentPrice) * 100
  };
}

export function analyzeOrderBook(symbol, book, currentPrice) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error("Giá Futures không hợp lệ");
  }

  const lower = currentPrice * (1 - config.rangePercent / 100);
  const upper = currentPrice * (1 + config.rangePercent / 100);

  const bids = parseLevels(book.bids).filter(
    x => x.price >= lower && x.price <= upper
  );

  const asks = parseLevels(book.asks).filter(
    x => x.price >= lower && x.price <= upper
  );

  const buyTotal = sumNotional(bids);
  const sellTotal = sumNotional(asks);
  const total = buyTotal + sellTotal;

  if (total <= 0) {
    throw new Error("Không có thanh khoản trong phạm vi quét");
  }

  return {
    symbol,
    timestamp: Date.now(),
    currentPrice,
    rangePercent: config.rangePercent,
    buyTotal,
    sellTotal,
    imbalance: ((buyTotal - sellTotal) / total) * 100,
    buyWall: biggestWall(bids, currentPrice),
    sellWall: biggestWall(asks, currentPrice),
    bidLevels: bids.length,
    askLevels: asks.length
  };
}

