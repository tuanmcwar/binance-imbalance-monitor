
import axios from "axios";

import {
  chartFrame,
  toPng,
  text,
  fmt,
  grid,
  timeLabel
} from "./chartUtils.js";

import { config } from "../config.js";

// ==========================================
// BINANCE API
// ==========================================

const api = axios.create({
  baseURL: config.binanceRest || "https://fapi.binance.com",
  timeout: config.timeout || 15000
});

// ==========================================
// HELPERS
// ==========================================

function formatUSDT(value) {
  if (
    value == null ||
    !Number.isFinite(Number(value))
  ) {
    return "N/A";
  }

  return Math.round(Number(value))
    .toLocaleString("en-US");
}

function formatPercent(value) {
  if (
    value == null ||
    !Number.isFinite(Number(value))
  ) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)}%`;
}

// ==========================================
// CREATE PRICE CHART
// ==========================================

export async function createPriceChart(
  symbol,
  priceBaseline = null,
  snapshot = null
) {
  const interval = config.chartInterval || "15m";
  const candleCount = config.chartCandles || 20;

  const WIDTH = config.chartWidth || 1400;
  const HEIGHT = config.chartHeight || 750;

  // ==========================================
  // LAYOUT: 10% / 80% / 10%
  // ==========================================

  const headerH = HEIGHT * 0.10;
  const chartSectionH = HEIGHT * 0.80;
  const footerY = headerH + chartSectionH;

  const marginLeft = 90;
  const marginRight = 50;

  // ==========================================
  // FETCH CANDLES
  // ==========================================

  const limit = Math.min(
    1500,
    candleCount + 5
  );

  const { data } = await api.get(
    "/fapi/v1/klines",
    {
      params: {
        symbol,
        interval,
        limit
      }
    }
  );

  const now = Date.now();

  const candles = data
    .filter(k => Number(k[6]) < now)
    .slice(-candleCount)
    .map(k => ({
      time: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4])
    }));

  if (candles.length !== candleCount) {
    throw new Error(
      `Không đủ ${candleCount} nến ${interval}. ` +
      `Hiện có ${candles.length} nến.`
    );
  }

  // ==========================================
  // PRICE BASELINE
  // ==========================================

  const baseline = Number(priceBaseline);

  const hasBaseline =
    priceBaseline != null &&
    Number.isFinite(baseline) &&
    baseline > 0;

  const lows = candles.map(c => c.low);
  const highs = candles.map(c => c.high);

  if (hasBaseline) {
    lows.push(baseline);
    highs.push(baseline);
  }

  let min = Math.min(...lows);
  let max = Math.max(...highs);

  const pad = Math.max(
    (max - min) * 0.12,
    max * 0.002
  );

  min -= pad;
  max += pad;

  // ==========================================
  // CHART AREA - 80%
  // ==========================================

  const x = marginLeft;
  const y = headerH + 35;

  const w =
    WIDTH - marginLeft - marginRight;

  // Dành 75px cuối chart section cho
  // nhãn thời gian nghiêng 45 độ
  const h = chartSectionH - 115;

  const yy = value =>
    y + h -
    ((value - min) / (max - min)) * h;

  const spacing = w / candles.length;

  const candleWidth = Math.max(
    2,
    Math.min(26, spacing * 0.55)
  );

  // ==========================================
  // HORIZONTAL GRID
  // ==========================================

  let drawing = grid(
    x,
    y,
    w,
    h,
    min,
    max,
    6
  );

  // ==========================================
  // VERTICAL GRID
  // ==========================================

  candles.forEach((c, i) => {
    const xx =
      x + spacing * (i + 0.5);

    drawing += `
      <line
        x1="${xx}"
        y1="${y}"
        x2="${xx}"
        y2="${y + h}"
        stroke="#293448"
        stroke-width="1"
        opacity="0.85"
      />
    `;
  });

  // ==========================================
  // BASELINE LINE
  // ==========================================

  if (hasBaseline) {
    drawing += `
      <line
        x1="${x}"
        y1="${yy(baseline)}"
        x2="${x + w}"
        y2="${yy(baseline)}"
        stroke="#fbbf24"
        stroke-width="2"
        stroke-dasharray="8 5"
      />
    `;
  }

  // ==========================================
  // CANDLESTICKS
  // ==========================================

  candles.forEach((c, i) => {
    const xx =
      x + spacing * (i + 0.5);

    const color =
      c.close >= c.open
        ? "#22c55e"
        : "#ef4444";

    const top = yy(
      Math.max(c.open, c.close)
    );

    const bottom = yy(
      Math.min(c.open, c.close)
    );

    drawing += `
      <line
        x1="${xx}"
        y1="${yy(c.high)}"
        x2="${xx}"
        y2="${yy(c.low)}"
        stroke="${color}"
        stroke-width="2"
      />

      <rect
        x="${xx - candleWidth / 2}"
        y="${top}"
        width="${candleWidth}"
        height="${Math.max(1, bottom - top)}"
        fill="${color}"
      />
    `;
  });

  // ==========================================
  // TIME LABELS
  // ==========================================

  const timeLabels = candles.map((c, i) => {
    const xx =
      x + spacing * (i + 0.5);

    return `
      <g transform="translate(
        ${xx},
        ${y + h + 22}
      )">
        <text
          transform="rotate(-45)"
          text-anchor="end"
          font-family="DejaVu Sans, Arial, sans-serif"
          font-size="13"
          fill="#94a3b8"
        >${timeLabel(c.time)}</text>
      </g>
    `;
  }).join("");

  // ==========================================
  // PRICE CHANGE
  // ==========================================

  const lastClose = candles.at(-1).close;

  const change = hasBaseline
    ? ((lastClose - baseline) / baseline) * 100
    : null;

  // ==========================================
  // HEADER - 10%
  // ==========================================

  const headerTextY =
    headerH / 2 + 12;

  const header = `
    ${text(
      55,
      headerTextY,
      `${symbol} | PRICE PUMP`,
      30,
      "#f8fafc"
    )}

    ${
      hasBaseline
        ? text(
            WIDTH - 55,
            headerTextY,
            `Change: ${change >= 0 ? "+" : ""}${fmt(change)}%`,
            25,
            change >= 0 ? "#4ade80" : "#f87171",
            "end"
          )
        : ""
    }
  `;

  // ==========================================
  // ORDER BOOK DATA
  // ==========================================

  const buyDepth = snapshot?.buyTotal;
  const sellDepth = snapshot?.sellTotal;
  const imbalance = snapshot?.imbalance;

  // ==========================================
  // ORDER BOOK - 10%
  // ==========================================

  const orderBookY =
    footerY + (HEIGHT - footerY) / 2 + 7;

  const orderBookText = snapshot ? `
    ${text(
      55,
      orderBookY,
      `ORDER BOOK (±${snapshot.rangePercent ?? config.rangePercent}%)`,
      18,
      "#f8fafc"
    )}

    ${text(
      WIDTH * 0.32,
      orderBookY,
      `BUY: ${formatUSDT(buyDepth)} USDT`,
      18,
      "#4ade80"
    )}

    ${text(
      WIDTH * 0.55,
      orderBookY,
      `SELL: ${formatUSDT(sellDepth)} USDT`,
      18,
      "#f87171"
    )}

    ${text(
      WIDTH - 55,
      orderBookY,
      `Imbalance: ${formatPercent(imbalance)}`,
      18,
      "#e2e8f0",
      "end"
    )}
  ` : "";

  // ==========================================
  // CHART CONTENT
  // ==========================================

  const content = `
    ${header}

    ${drawing}

    ${timeLabels}

    ${orderBookText}
  `;

  // ==========================================
  // GENERATE PNG
  // ==========================================

  return toPng(
    chartFrame(
      "",
      "",
      content,
      {
        showTitle: false,
        showSubtitle: false,
        showFooter: false,
        fullBleed: true,
        width: WIDTH,
        height: HEIGHT
      }
    )
  );
}
