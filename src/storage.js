
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
const stateFile = path.join(dataDir, "monitored-coins.json");

let state = {};

export function loadState() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(stateFile)) {
    state = {};
    return;
  }

  const raw = fs.readFileSync(stateFile, "utf8");
  const parsed = JSON.parse(raw);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error("Dữ liệu theo dõi không hợp lệ");
  }

  state = parsed;
}

function saveState() {
  fs.mkdirSync(dataDir, { recursive: true });

  const temporary = `${stateFile}.tmp`;

  fs.writeFileSync(
    temporary,
    JSON.stringify(state, null, 2),
    "utf8"
  );

  fs.renameSync(temporary, stateFile);
}

export function getCoin(symbol) {
  return state[symbol] || null;
}

export function getCoins() {
  return Object.entries(state).map(([symbol, data]) => ({
    symbol,
    ...data
  }));
}


export function addCoin(symbol, baseline, basisBaseline = null) {
  if (state[symbol]) return false;

  state[symbol] = {
    baseline,
    basisBaseline,
    lastImbalance: baseline,
    lastBasisRate: basisBaseline,
    paused: false,
    addedAt: Date.now(),
    lastScanAt: Date.now(),
    lastAlertAt: null,
    alertCount: 0
  };

  saveState();
  return true;
}


export function updateCoin(symbol, changes) {
  if (!state[symbol]) return false;

  state[symbol] = {
    ...state[symbol],
    ...changes
  };

  saveState();
  return true;
}

export function removeCoin(symbol) {
  if (!state[symbol]) return false;

  delete state[symbol];
  saveState();
  return true;
}

export function clearCoins() {
  const count = Object.keys(state).length;
  state = {};
  saveState();
  return count;
}

