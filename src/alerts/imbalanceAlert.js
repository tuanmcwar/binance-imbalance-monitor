
export function calculateImbalanceChange(
  currentImbalance,
  baseline
) {
  if (
    !Number.isFinite(currentImbalance) ||
    !Number.isFinite(baseline)
  ) {
    return null;
  }

  return currentImbalance - baseline;
}

export function checkImbalanceAlert(
  imbalanceChange,
  threshold
) {
  return (
    imbalanceChange != null &&
    Number.isFinite(imbalanceChange) &&
    Math.abs(imbalanceChange) > threshold
  );
}

export function formatImbalanceTrigger(
  baseline,
  change
) {
  return [
    "⚖️ IMBALANCE TRIGGER",
    `Mốc trước: ${baseline.toFixed(2)}%`,
    `Thay đổi: ${change >= 0 ? "+" : ""}${change.toFixed(2)} điểm %`
  ].join("\n");
}
