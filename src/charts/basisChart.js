
import axios from "axios";
import sharp from "sharp";
import { config } from "../config.js";

// ==========================================
// CONFIG
// ==========================================

const WIDTH = config.chartWidth;
const HEIGHT = config.chartHeight;
const INTERVAL = config.chartInterval;
const CLOSED_CANDLES = config.chartCandles;

const API_URL =
  config.binanceRest || "https://fapi.binance.com";

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000
});

const COLOR = {
  bg: "#0f1728",
  grid: "#293448",
  text: "#e5e7eb",
  muted: "#a5adba",
  cyan: "#38bdf8",
  green: "#22c55e",
  red: "#ef4444",
  yellow: "#facc15",
  white: "#f8fafc"
};

// ==========================================
// HELPERS
// ==========================================

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[c]);
}

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function timeVN(timestamp) {
  return new Date(timestamp).toLocaleTimeString(
    "en-GB",
    {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  );
}

function fullTimeVN(timestamp) {
  return new Date(timestamp).toLocaleString(
    "vi-VN",
    {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false
    }
  );
}

function text(
  x,
  y,
  value,
  size = 17,
  color = COLOR.text,
  anchor = "middle",
  extra = ""
) {
  return `
    <text
      x="${x}"
      y="${y}"
      fill="${color}"
      font-size="${size}"
      font-family="DejaVu Sans, Arial, sans-serif"
      text-anchor="${anchor}"
      ${extra}
    >${escapeXml(value)}</text>
  `;
}

// ==========================================
// FETCH BASIS M15
// ==========================================

async function fetchBasisCandles(symbol) {
  const normalized = String(symbol)
    .toUpperCase()
    .replace(/\.P$/, "");

  const [futuresRes, indexRes] = await Promise.all([
    api.get("/fapi/v1/klines", {
      params: {
        symbol: normalized,
        interval: INTERVAL,
        limit: Math.min(1000, CLOSED_CANDLES + 5)
      }
    }),

    api.get("/fapi/v1/indexPriceKlines", {
      params: {
        pair: normalized,
        interval: INTERVAL,
        limit: Math.min(1000, CLOSED_CANDLES + 5)
      }
    })
  ]);

  const now = Date.now();

  const indexMap = new Map(
    indexRes.data.map(k => [
      Number(k[0]),
      {
        openTime: Number(k[0]),
        closeTime: Number(k[6]),
        close: Number(k[4])
      }
    ])
  );

  const candles = futuresRes.data
    .map(k => {
      const openTime = Number(k[0]);
      const index = indexMap.get(openTime);

      if (!index) return null;

      const futuresPrice = Number(k[4]);
      const indexPrice = index.close;

      if (
        !Number.isFinite(futuresPrice) ||
        !Number.isFinite(indexPrice) ||
        indexPrice <= 0
      ) {
        return null;
      }

      const basisRate =
        ((futuresPrice - indexPrice) / indexPrice) * 100;

      return {
        openTime,
        closeTime: Number(k[6]),
        futuresPrice,
        indexPrice,
        basisRate,
        running: Number(k[6]) >= now ||
          index.closeTime >= now
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.openTime - b.openTime);

  const closed = candles
    .filter(c => !c.running)
    .slice(-CLOSED_CANDLES);

  if (closed.length < CLOSED_CANDLES) {
    throw new Error(
      `Không đủ ${CLOSED_CANDLES} nến Basis M15 đã đóng`
    );
  }

  const running = candles.find(c =>
    c.running &&
    c.openTime > closed.at(-1).openTime
  );

  return {
    symbol: normalized,
    closed,
    running: running || null
  };
}

// ==========================================
// CREATE CHART
// ==========================================

export async function createBasisChart(symbol) {
  const data = await fetchBasisCandles(symbol);

  const candles = data.running
    ? [...data.closed, data.running]
    : data.closed;

  const values = candles.map(c => c.basisRate);

  const margin = {
    left: 90,
    right: 50,
    top: 165,
    bottom: 95
  };

  const plotX = margin.left;
  const plotY = margin.top;

  const plotW =
    WIDTH - margin.left - margin.right;

  const plotH =
    HEIGHT - margin.top - margin.bottom;

  // ==========================================
  // Y AXIS
  // ==========================================

const rawMin = Math.min(...values, -1.99, 0);
const rawMax = Math.max(...values, -1.99, 0);

  const padding = Math.max(
    (rawMax - rawMin) * 0.12,
    0.25
  );

  let yMin = Math.floor(rawMin - padding);
  let yMax = Math.ceil(rawMax + padding);

  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const yScale = value =>
    plotY +
    ((yMax - value) / (yMax - yMin)) * plotH;

  const xScale = index =>
    plotX +
    (index / Math.max(1, candles.length - 1)) *
      plotW;

  // ==========================================
  // GRID
  // ==========================================

  let grid = "";

  const ySteps = 6;

  for (let i = 0; i <= ySteps; i++) {
    const value =
      yMax - (i / ySteps) * (yMax - yMin);

    const y = yScale(value);

    grid += `
      <line
        x1="${plotX}"
        y1="${y}"
        x2="${plotX + plotW}"
        y2="${y}"
        stroke="${COLOR.grid}"
        stroke-width="1"
      />
    `;

    grid += text(
      plotX - 14,
      y + 5,
      `${fmt(value, 1)}%`,
      15,
      COLOR.muted,
      "end"
    );
  }

  for (let i = 0; i < candles.length; i++) {
    const x = xScale(i);

    grid += `
      <line
        x1="${x}"
        y1="${plotY}"
        x2="${x}"
        y2="${plotY + plotH}"
        stroke="${COLOR.grid}"
        stroke-width="1"
      />
    `;
  }
// ==========================================
// BASIS ALERT ZONE (-1.99% TO 0%)
// ==========================================

const ALERT_MIN = -1.99;
const ALERT_MAX = 0;

const zoneTop = yScale(ALERT_MAX);
const zoneBottom = yScale(ALERT_MIN);

const alertZone = `
  <rect
    x="${plotX}"
    y="${zoneTop}"
    width="${plotW}"
    height="${zoneBottom - zoneTop}"
    fill="#22c55e"
    opacity="0.10"
  />

  <line
    x1="${plotX}"
    y1="${zoneBottom}"
    x2="${plotX + plotW}"
    y2="${zoneBottom}"
    stroke="#facc15"
    stroke-width="2"
    stroke-dasharray="9 6"
  />

  ${text(
    plotX + plotW - 12,
    zoneTop - 12,
    "ALERT ZONE: -1.99% to 0%",
    15,
    "#86efac",
    "end"
  )}
`;
  // ==========================================
  // ZERO LINE
  // ==========================================

  const zeroY = yScale(0);

  const zeroLine = `
    <line
      x1="${plotX}"
      y1="${zeroY}"
      x2="${plotX + plotW}"
      y2="${zeroY}"
      stroke="${COLOR.white}"
      stroke-width="2"
    />
  `;

  // ==========================================
  // BASIS LINE
  // ==========================================

  const path = candles
    .map((c, i) => {
      const x = xScale(i);
      const y = yScale(c.basisRate);

      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const basisLine = `
    <path
      d="${path}"
      fill="none"
      stroke="${COLOR.cyan}"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `;

  // ==========================================
  // DOTS + VALUE LABELS
  // ==========================================

  let points = "";
  let labels = "";

  candles.forEach((c, i) => {
    const x = xScale(i);
    const y = yScale(c.basisRate);

    const color = c.running
      ? COLOR.yellow
      : c.basisRate >= 0
        ? COLOR.green
        : COLOR.red;

    points += `
      <circle
        cx="${x}"
        cy="${y}"
        r="7"
        fill="${color}"
      />
    `;

    const valueText =
      `${fmt(c.basisRate)}%`;

    // Alternate labels to reduce overlap.
    const above = i % 2 === 0;

    let labelY = above ? y - 17 : y + 28;

    if (labelY < plotY + 12) {
      labelY = y + 28;
    }

    if (labelY > plotY + plotH - 4) {
      labelY = y - 17;
    }

    labels += text(
      x,
      labelY,
      valueText,
      15,
      c.running ? COLOR.yellow :
        c.basisRate >= 0
          ? "#86efac"
          : "#fca5a5",
      "middle",
      'font-weight="bold"'
    );
  });

  // ==========================================
  // TIME AXIS
  // ==========================================

  let timeLabels = "";

  candles.forEach((c, i) => {
    const x = xScale(i);

    timeLabels += `
      <g transform="translate(${x}, ${plotY + plotH + 23})">
        <text
          transform="rotate(-45)"
          text-anchor="end"
          font-size="13"
          fill="${COLOR.muted}"
          font-family="DejaVu Sans, Arial, sans-serif"
        >${escapeXml(timeVN(c.openTime))}</text>
      </g>
    `;
  });

  // ==========================================
  // LEGEND
  // ==========================================

  const legend = `
    <g font-family="DejaVu Sans, Arial, sans-serif"
       font-size="16">

      <rect x="365" y="138"
        width="19" height="14"
        fill="${COLOR.cyan}"/>

      ${text(
        392, 151,
        "Basis Rate (%)",
        16,
        COLOR.text,
        "start"
      )}

      <rect x="565" y="138"
        width="19" height="14"
        fill="${COLOR.green}"/>

      ${text(
        592, 151,
        "Futures > Index",
        16,
        COLOR.text,
        "start"
      )}

      <rect x="790" y="138"
        width="19" height="14"
        fill="${COLOR.red}"/>

      ${text(
        817, 151,
        "Futures < Index",
        16,
        COLOR.text,
        "start"
      )}

      <rect x="1020" y="138"
        width="19" height="14"
        fill="${COLOR.yellow}"/>

      ${text(
        1047, 151,
        "Running Candle",
        16,
        COLOR.text,
        "start"
      )}
    </g>
  `;

  // ==========================================
  // TITLE + FOOTER
  // ==========================================

  const lastClosed = data.closed.at(-1);

  const title = text(
    WIDTH / 2,
    83,
    `${data.symbol}.P - BASIS RATE M15`,
    29,
    COLOR.white,
    "middle",
    'font-weight="bold"'
  );

  const footer = `
    ${text(
      WIDTH / 2,
      HEIGHT - 18,
      "Time (VN)",
      16,
      COLOR.muted
    )}

    ${text(
      32,
      plotY + plotH / 2,
      "Basis Rate (%)",
      15,
      COLOR.muted,
      "middle",
      `transform="rotate(-90 32 ${plotY + plotH / 2})"`
    )}

    ${text(
      WIDTH - 50,
      112,
      `Last closed: ${fullTimeVN(lastClosed.closeTime)}`,
      13,
      COLOR.muted,
      "end"
    )}
  `;

  // ==========================================
  // SVG
  // ==========================================

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${WIDTH}"
      height="${HEIGHT}"
      viewBox="0 0 ${WIDTH} ${HEIGHT}"
    >
      <rect
        width="100%"
        height="100%"
        fill="${COLOR.bg}"
      />

      ${title}
${legend}
${grid}
${alertZone}
${zeroLine}
${basisLine}
${points}
${labels}
${timeLabels}
${footer}
    </svg>
  `;

  // ==========================================
  // OUTPUT PNG BUFFER
  // ==========================================

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}
