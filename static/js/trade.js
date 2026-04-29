function pipMultiplier(assetType) {
  if (assetType === "forex") return 10000;
  if (assetType === "gold") return 100;
  return 1;
}

function calculatePips(entry, exitPrice, direction, assetType) {
  const move = direction === "BUY" ? exitPrice - entry : entry - exitPrice;
  return move * pipMultiplier(assetType);
}

function pipValue(lotSize, assetType) {
  if (assetType === "forex") return lotSize * 10;
  if (assetType === "gold") return lotSize * 1;
  return lotSize;
}

function calculatePnl(pips, lotSize, assetType) {
  return pips * pipValue(lotSize, assetType);
}

function convertToTzs(usd) {
  return usd * 2500;
}

function calculateRisk(entry, stopLoss, lotSize, capital, assetType) {
  if (stopLoss === null || stopLoss === undefined || stopLoss === "") return null;
  if (!capital) return null;
  const riskAmount = Math.abs(entry - stopLoss) * pipValue(lotSize, assetType);
  return (riskAmount / capital) * 100;
}

function calculateRR(entry, stopLoss, takeProfit, direction) {
  if (stopLoss === null || stopLoss === undefined || stopLoss === "") return null;
  if (takeProfit === null || takeProfit === undefined || takeProfit === "") return null;
  let risk = 0;
  let reward = 0;
  if (direction === "BUY") {
    risk = entry - stopLoss;
    reward = takeProfit - entry;
  } else {
    risk = stopLoss - entry;
    reward = entry - takeProfit;
  }
  if (risk <= 0) return null;
  return reward / risk;
}

function simulatePnl(entry, exitPrice, stopLoss, direction, assetType) {
  const capitals = [10000, 100000, 5000000];
  const pips = calculatePips(entry, exitPrice, direction, assetType);
  const unitValue = pipValue(1, assetType);
  const priceRisk = stopLoss === null || stopLoss === undefined || stopLoss === "" ? 0 : Math.abs(entry - stopLoss);
  const denom = priceRisk * unitValue;
  if (!denom) {
    return capitals.map((capital) => ({ capital, lotSize: null, pnl: null }));
  }
  return capitals.map((capital) => {
    const lotSize = (capital * 0.01) / denom;
    return { capital, lotSize, pnl: calculatePnl(pips, lotSize, assetType) };
  });
}

function getSelectedAssetType() {
  const sel = document.getElementById("assetSelect");
  if (!sel) return "forex";
  const option = sel.options[sel.selectedIndex];
  return option?.dataset.assetType || "forex";
}

async function loadAssetsAndStrategies() {
  const [assetsRes, strategiesRes] = await Promise.all([
    bbFetch("/api/assets/"),
    bbFetch("/api/strategies/"),
  ]);
  return {
    assets: await assetsRes.json(),
    strategies: await strategiesRes.json(),
  };
}

async function initAssetPage() {
  const form = document.getElementById("assetForm");
  const list = document.getElementById("assetList");
  if (!form || !list) return;

  const render = async () => {
    const res = await bbFetch("/api/assets/");
    const assets = await res.json();
    list.innerHTML = assets.map((a) => `<li>${a.name} (${a.symbol}) - ${a.asset_type}</li>`).join("");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await bbFetch("/api/assets/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("assetName").value,
        symbol: document.getElementById("assetSymbol").value,
        asset_type: document.getElementById("assetType").value,
      }),
    });
    form.reset();
    render();
  });

  render();
}

async function initStrategyPage() {
  const form = document.getElementById("strategyForm");
  const list = document.getElementById("strategyList");
  if (!form || !list) return;

  const render = async () => {
    const res = await bbFetch("/api/strategies/");
    const strategies = await res.json();
    list.innerHTML = strategies.map((s) => `<li>${s.name}</li>`).join("");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await bbFetch("/api/strategies/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: document.getElementById("strategyName").value }),
    });
    form.reset();
    render();
  });

  render();
}

initAssetPage();
initStrategyPage();

function updatePreview() {
  const get = (id) => document.getElementById(id);
  if (!get("entryInput")) return;
  const entry = Number(get("entryInput").value || 0);
  const exitPrice = Number(get("exitInput").value || 0);
  const stopLossRaw = get("stopLossInput").value;
  const takeProfitRaw = get("takeProfitInput") ? get("takeProfitInput").value : "";
  const stopLoss = stopLossRaw === "" ? null : Number(stopLossRaw);
  const takeProfit = takeProfitRaw === "" ? null : Number(takeProfitRaw);
  const lotSize = Number(get("lotSizeInput").value || 0);
  const capital = Number(get("capitalInput").value || 10000);
  const direction = get("directionInput").value;
  const assetType = getSelectedAssetType();
  const pips = calculatePips(entry, exitPrice, direction, assetType);
  const pnlUsd = calculatePnl(pips, lotSize, assetType);
  const pnlTzs = convertToTzs(pnlUsd);
  const risk = calculateRisk(entry, stopLoss, lotSize, capital, assetType);
  const rr = calculateRR(entry, stopLoss, takeProfit, direction);

  get("tradePreview").innerHTML = `
    <strong>Live Preview</strong><br>
    Pips: ${pips.toFixed(2)}<br>
    PnL USD: ${pnlUsd.toFixed(2)}<br>
    PnL TZS: ${pnlTzs.toFixed(2)}<br>
    Risk %: ${risk === null ? "N/A (no stop loss)" : risk.toFixed(2)}<br>
    RR: ${rr === null ? "N/A" : rr.toFixed(2)}
  `;

  const sim = simulatePnl(entry, exitPrice, stopLoss, direction, assetType);
  get("simulationPreview").innerHTML =
    "<strong>Multi-Capital Simulation</strong><br>" +
    sim
      .map((s) =>
        s.pnl === null
          ? `${s.capital.toLocaleString()}: N/A (add stop loss)`
          : `${s.capital.toLocaleString()}: ${s.pnl.toFixed(2)} USD (lot ${s.lotSize.toFixed(4)})`
      )
      .join("<br>");
}
