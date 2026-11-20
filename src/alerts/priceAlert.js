
export function calculatePriceChange(
  currentPrice,
  priceBaseline
) {
  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(priceBaseline) ||
    priceBaseline <= 0
  ) {
    return null;
  }

  return (
    ((currentPrice - priceBaseline) / priceBaseline) * 100
  );
}

export function checkPriceAlert(
  priceChange,
  threshold = 10
) {
  return (
    priceChange != null &&
    Number.isFinite(priceChange) &&
    priceChange > threshold
  );
}

export function formatPriceTrigger(priceChange) {
  return [
    "🚀 PRICE PUMP TRIGGER",
    `📈 Tăng giá: +${priceChange.toFixed(2)}%`
  ].join("\n");
}
