function dEl(id) {
  return document.getElementById(id);
}

const dayMeta = dEl("dayMeta");
const dayState = {
  assetId: dayMeta?.dataset.assetId,
  date: dayMeta?.dataset.date,
};

function modePayload() {
  return {
    mode: localStorage.getItem("journal_mode") || "normal",
    active_profile_id: localStorage.getItem("active_profile_id") || "",
  };
}

function fillTradeForm(trade) {
  dEl("tradeIdInput").value = trade.id;
  dEl("assetSelect").value = trade.asset;
  dEl("strategySelect").value = trade.strategy;
  dEl("dateInput").value = trade.date;
  dEl("entryInput").value = trade.entry;
  dEl("exitInput").value = trade.exit;
  dEl("stopLossInput").value = trade.stop_loss ?? "";
  dEl("takeProfitInput").value = trade.take_profit ?? "";
  dEl("lotSizeInput").value = trade.lot_size;
  dEl("directionInput").value = trade.direction;
  dEl("notesInput").value = trade.notes || "";
  const tags = trade.tags;
  const ti = dEl("tagsInput");
  if (ti) ti.value = Array.isArray(tags) ? tags.join(", ") : "";
  updatePreview();
}

async function fetchTrades() {
  const res = await bbFetch(`/api/trades/?asset_id=${dayState.assetId}&day=${dayState.date}`);
  return res.json();
}

async function renderDay() {
  const trades = await fetchTrades();
  let total = 0;
  let wins = 0;
  let losses = 0;
  trades.forEach((t) => {
    total += Number(t.pnl_usd);
    if (Number(t.pnl_usd) > 0) wins += 1;
    if (Number(t.pnl_usd) < 0) losses += 1;
  });
  dEl("dayTotalPnl").textContent = total.toFixed(2);
  dEl("dayWins").textContent = wins;
  dEl("dayLosses").textContent = losses;

  dEl("dayTrades").innerHTML = trades.length
    ? trades
        .map(
          (t) => `<div class="trade-row ${t.followed_rules ? "compliant-row" : "violation-row"} ${String(t.id) === String(dayState.highlightTradeId || "") ? "row-highlight" : ""}" data-trade-row-id="${t.id}">
            <b>${t.asset_symbol}</b> ${t.direction} | Entry ${t.entry} Exit ${t.exit} | Pips ${Number(t.pips).toFixed(2)} |
            PnL ${Number(t.pnl_usd).toFixed(2)} | Strategy ${t.strategy_name}<br>
            Notes: ${t.notes || "-"} | Tags: ${Array.isArray(t.tags) && t.tags.length ? t.tags.join(", ") : "-"}<br>
            ${t.followed_rules ? "✅ Followed rules" : `❌ Violations: ${t.rule_violation || "N/A"}`}
            <div class="row-actions">
              <button data-edit="${t.id}">Edit</button>
              <button data-delete="${t.id}">Delete</button>
            </div>
          </div>`
        )
        .join("")
    : '<div class="empty-state">No trades yet<br>Start by adding your first trade</div>';

  if (dayState.highlightTradeId) {
    setTimeout(() => {
      const row = dEl("dayTrades").querySelector(`[data-trade-row-id="${dayState.highlightTradeId}"]`);
      if (row) row.classList.remove("row-highlight");
      dayState.highlightTradeId = null;
    }, 1200);
  }

  dEl("dayTrades").querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!window.confirm("Delete this trade?")) return;
      const row = btn.closest(".trade-row");
      if (row) row.classList.add("row-fade");
      await new Promise((resolve) => setTimeout(resolve, 220));
      await bbFetch(`/api/trades/${btn.dataset.delete}/`, { method: "DELETE" });
      renderDay();
    })
  );
  dEl("dayTrades").querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const trade = trades.find((t) => String(t.id) === btn.dataset.edit);
      if (!trade) return;
      fillTradeForm(trade);
      dEl("tradeModal").classList.remove("hidden");
    })
  );
}

function bindModal() {
  const modal = dEl("tradeModal");
  dEl("openTradeModal").addEventListener("click", () => {
    dEl("tradeForm").reset();
    dEl("tradeIdInput").value = "";
    dEl("dateInput").value = dayState.date;
    dEl("assetSelect").value = dayState.assetId;
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("show"));
    updatePreview();
  });
  dEl("closeTradeModal").addEventListener("click", () => {
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 220);
  });
}

function bindPreview() {
  ["assetSelect", "entryInput", "exitInput", "stopLossInput", "takeProfitInput", "lotSizeInput", "directionInput", "capitalInput"].forEach(
    (id) => dEl(id).addEventListener("input", updatePreview)
  );
}

function bindTradeSubmit() {
  dEl("tradeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = { ...Object.fromEntries(new FormData(e.target).entries()), ...modePayload() };
    const tradeId = dEl("tradeIdInput").value;
    const url = tradeId ? `/api/trades/${tradeId}/` : "/api/trades/";
    const method = tradeId ? "PUT" : "POST";
    const res = await bbFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      alert("Trade save failed.");
      return;
    }
    const saved = await res.json();
    dayState.highlightTradeId = saved.id;
    const modal = dEl("tradeModal");
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 220);
    renderDay();
  });
}

async function initDayDetail() {
  if (!dayMeta) return;
  const { assets, strategies } = await loadAssetsAndStrategies();
  dEl("assetSelect").innerHTML = assets
    .map((a) => `<option value="${a.id}" data-asset-type="${a.asset_type}">${a.name} (${a.symbol})</option>`)
    .join("");
  dEl("strategySelect").innerHTML = strategies.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  bindModal();
  bindPreview();
  bindTradeSubmit();
  renderDay();
  updatePreview();
}

initDayDetail();
