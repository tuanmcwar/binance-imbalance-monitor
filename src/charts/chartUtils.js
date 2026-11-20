
import sharp from "sharp";

import { config } from "../config.js";

export const WIDTH = 1100;
export const HEIGHT = 650;

// ==========================================
// HELPERS
// ==========================================

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[c]);
}

export function fmt(value, digits = 2) {
  return Number.isFinite(value)
    ? Number(value).toFixed(digits)
    : "N/A";
}

export function vnTime(timestamp) {
  return new Date(timestamp).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false
  });
}

export function timeLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export function text(
  x,
  y,
  value,
  size = 20,
  color = "#e2e8f0",
  anchor = "start"
) {
  return `<text
    x="${x}"
    y="${y}"
    font-size="${size}"
    fill="${color}"
    text-anchor="${anchor}"
    font-family="DejaVu Sans, Arial, sans-serif"
  >${escapeXml(value)}</text>`;
}

export function linePath(
  values,
  x,
  y,
  w,
  h,
  min,
  max
) {
  const range = max - min || 1;

  return values.map((v, i) => {
    const px =
      x + i * w / Math.max(1, values.length - 1);

    const py =
      y + h - (v - min) / range * h;

    return `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`;
  }).join(" ");
}

// ==========================================
// CHART FRAME
// ==========================================

export function chartFrame(
  title,
  subtitle,
  content,
  options = {}
) {
  const {
    showTitle = true,
    showSubtitle = true,
    showFooter = true,
    fullBleed = false,
    width = fullBleed
      ? config.chartWidth || 1400
      : WIDTH,
    height = fullBleed
      ? config.chartHeight || 750
      : HEIGHT
  } = options;

  const background = fullBleed
    ? `
      <rect
        width="${width}"
        height="${height}"
        fill="#0f1728"
      />
    `
    : `
      <rect
        width="${width}"
        height="${height}"
        fill="#0b1220"
      />

      <rect
        x="24"
        y="24"
        width="${width - 48}"
        height="${height - 48}"
        rx="22"
        fill="#111c30"
        stroke="#26354e"
      />
    `;

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
    >
      ${background}

      ${
        showTitle
          ? text(
              55,
              78,
              title,
              31,
              "#f8fafc"
            )
          : ""
      }

      ${
        showSubtitle && subtitle
          ? text(
              55,
              111,
              subtitle,
              17,
              "#94a3b8"
            )
          : ""
      }

      ${content}

      ${
        showFooter
          ? text(
              55,
              height - 44,
              "BINANCE FUTURES | Market data only",
              16,
              "#64748b"
            )
          : ""
      }
    </svg>
  `;
}

// ==========================================
// SVG TO PNG
// ==========================================

export async function toPng(svg) {
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

// ==========================================
// HORIZONTAL GRID
// ==========================================

export function grid(
  x,
  y,
  w,
  h,
  min,
  max,
  digits = 2
) {
  let result = "";

  for (let i = 0; i <= 4; i++) {
    const yy = y + h * i / 4;

    const value =
      max - (max - min) * i / 4;

    result += `
      <line
        x1="${x}"
        y1="${yy}"
        x2="${x + w}"
        y2="${yy}"
        stroke="#2b3b54"
        stroke-dasharray="4 5"
      />
    `;

    result += text(
      x - 14,
      yy + 5,
      fmt(value, digits),
      14,
      "#94a3b8",
      "end"
    );
  }

  return result;
}

// ==========================================
// TIME AXIS
// ==========================================

export function timeAxis(
  timestamps,
  x,
  y,
  w
) {
  let result = "";

  for (
    let i = 0;
    i < timestamps.length;
    i += 4
  ) {
    const xx =
      x +
      i * w / Math.max(1, timestamps.length - 1);

    result += text(
      xx,
      y,
      timeLabel(timestamps[i]),
      14,
      "#94a3b8",
      "middle"
    );
  }

  return result;
}
