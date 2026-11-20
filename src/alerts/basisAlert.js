
import { config } from "../config.js";

// ==========================================
// CHECK BASIS RATE ALERT
// ==========================================

export function checkBasisAlert(currentBasisRate) {
  if (
    currentBasisRate == null ||
    !Number.isFinite(Number(currentBasisRate))
  ) {
    return false;
  }

  const rate = Number(currentBasisRate);

  return (
    rate >= config.basisAlertMin &&
    rate <= config.basisAlertMax
  );
}

// ==========================================
// FORMAT BASIS RATE TRIGGER
// ==========================================

export function formatBasisTrigger(options = {}) {
  const currentBasisRate = Number(
    options.currentBasisRate ??
    options.basisRate ??
    0
  );

  return [
    "📈 BASIS RATE TRIGGER",
    `Basis Rate hiện tại: ${currentBasisRate.toFixed(2)}%`,
    `Điều kiện: ${config.basisAlertMin}% đến ${config.basisAlertMax}%`
  ].join("\n");
}
