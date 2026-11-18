
import axios from "axios";
import { config } from "./config.js";

const api = axios.create({
  baseURL: config.binanceRest,
  timeout: config.timeout
});

export function errorText(error) {
  return (
    error.response?.data?.msg ||
    error.message ||
    "Unknown error"
  );
}

export async function getExchangeInfo() {
  const { data } = await api.get("/fapi/v1/exchangeInfo");
  return data;
}

export async function getOrderBook(symbol) {
  const { data } = await api.get("/fapi/v1/depth", {
    params: {
      symbol,
      limit: config.depthLimit
    }
  });

  if (
    !Array.isArray(data.bids) ||
    !Array.isArray(data.asks)
  ) {
    throw new Error("Order Book không hợp lệ");
  }

  return data;
}

export async function getFuturesPrice(symbol) {
  const { data } = await api.get("/fapi/v1/ticker/price", {
    params: { symbol }
  });

  const price = Number(data.price);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Giá Futures không hợp lệ");
  }

  return price;
}

// ==========================================
// REALTIME BASIS + FUNDING RATE
// Futures Last Price - Index Price
// ==========================================

export async function getBasis(symbol) {
  const [tickerResponse, indexResponse] =
    await Promise.all([
      api.get("/fapi/v1/ticker/price", {
        params: { symbol }
      }),

      api.get("/fapi/v1/premiumIndex", {
        params: { symbol }
      })
    ]);

  const ticker = tickerResponse.data;
  const indexData = indexResponse.data;

  if (
    !ticker ||
    Array.isArray(ticker) ||
    !indexData ||
    Array.isArray(indexData)
  ) {
    throw new Error("Dữ liệu Basis không hợp lệ");
  }

  const futuresPrice = Number(ticker.price);
  const indexPrice = Number(indexData.indexPrice);

  if (
    !Number.isFinite(futuresPrice) ||
    futuresPrice <= 0 ||
    !Number.isFinite(indexPrice) ||
    indexPrice <= 0
  ) {
    throw new Error(
      "Futures Price hoặc Index Price không hợp lệ"
    );
  }

  const basis = futuresPrice - indexPrice;

  // Giữ dạng tỷ lệ thập phân để tương thích
  // với code cũ: nhân 100 khi hiển thị.
  const basisRate = basis / indexPrice;

  // Funding Rate từ Binance premiumIndex.
  // Giữ dạng thập phân, nhân 100 khi hiển thị.
  const rawFunding = indexData.lastFundingRate;

  const fundingRate =
    rawFunding != null &&
    rawFunding !== "" &&
    Number.isFinite(Number(rawFunding))
      ? Number(rawFunding)
      : null;

  const timestamp = Date.now();

  return {
    pair: symbol,
    contractType: "PERPETUAL",

    basis: basis.toFixed(12),
    basisRate: basisRate.toFixed(12),

    futuresPrice: futuresPrice.toString(),
    indexPrice: indexPrice.toString(),

    fundingRate,

    timestamp,
    period: "realtime",
    source: "LAST_INDEX"
  };
}

// ==========================================
// ORDER BOOK SNAPSHOT
// ==========================================

export async function getSnapshotInputs(symbol) {
  const [book, price] = await Promise.all([
    getOrderBook(symbol),
    getFuturesPrice(symbol)
  ]);

  return { book, price };
}
