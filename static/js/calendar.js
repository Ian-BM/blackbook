const state = {
  currentMonth: dayjs(),
  selectedDay: dayjs().format("YYYY-MM-DD"),
  selectedAssetId: "",
};

function el(id) {
  return document.getElementById(id);
}

function formatMoney(v) {
  return Number(v).toFixed(2);
}

async function loadSelectOptions() {
  const { assets, strategies } = await loadAssetsAndStrategies();
  const filter = el("calendarAssetFilter");
  filter.innerHTML = `<option value="">All Assets</option>${assets
    .map((a) => `<option value="${a.id}">${a.name} (${a.symbol})</option>`)
    .join("")}`;
  filter.addEventListener("change", async () => {
    state.selectedAssetId = filter.value;
    renderCalendar(await loadTradesForMonth());
  });
  if (el("assetSelect")) {
    el("assetSelect").innerHTML = assets
      .map((a) => `<option value="${a.id}" data-asset-type="${a.asset_type}">${a.name} (${a.symbol})</option>`)
      .join("");
  }
  if (el("strategySelect")) {
    el("strategySelect").innerHTML = strategies.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  }
  return { assets, strategies };
}

async function loadTradesForMonth() {
  const month = state.currentMonth.month() + 1;
  const year = state.currentMonth.year();
  const assetParam = state.selectedAssetId ? `&asset_id=${state.selectedAssetId}` : "";
  const res = await bbFetch(`/api/trades/?month=${month}&year=${year}${assetParam}`);
  return res.json();
}

function renderCalendar(trades) {
  const monthStart = state.currentMonth.startOf("month");
  const monthEnd = state.currentMonth.endOf("month");
  const startOffset = monthStart.day();
  const totalDays = monthEnd.date();

  el("monthLabel").textContent = state.currentMonth.format("MMMM YYYY");
  const grid = el("calendarGrid");
  grid.innerHTML = "";

  const pnlByDate = {};
  const complianceByDate = {};
  const assetByDate = {};
  trades.forEach((t) => {
    pnlByDate[t.date] = (pnlByDate[t.date] || 0) + Number(t.pnl_usd);
    assetByDate[t.date] = assetByDate[t.date] || t.asset;
    if (!complianceByDate[t.date]) complianceByDate[t.date] = true;
    if (!t.followed_rules) complianceByDate[t.date] = false;
  });

  for (let i = 0; i < 35; i++) {
    const cell = document.createElement("button");
    cell.className = "calendar-cell";
    const day = i - startOffset + 1;
    if (day > 0 && day <= totalDays) {
      const dateStr = state.currentMonth.date(day).format("YYYY-MM-DD");
      const pnl = pnlByDate[dateStr] || 0;
      cell.innerHTML = `<span>${day}</span><small>${formatMoney(pnl)}</small>`;
      if (pnl > 0) cell.classList.add("profit");
      if (pnl < 0) cell.classList.add("loss");
      if (complianceByDate[dateStr] === false) cell.classList.add("violation");
      if (complianceByDate[dateStr] === true && pnlByDate[dateStr] !== undefined) cell.classList.add("compliant");
      cell.addEventListener("click", () => {
        state.selectedDay = dateStr;
        const assetId = state.selectedAssetId || assetByDate[dateStr];
        if (!assetId) return;
        window.location.href = `/calendar/${assetId}/${dateStr}/`;
      });
    } else {
      cell.disabled = true;
    }
    grid.appendChild(cell);
  }
}

function modePayload() {
  return {
    mode: localStorage.getItem("journal_mode") || "normal",
    active_profile_id: localStorage.getItem("active_profile_id") || "",
  };
}

function bindModal() {
  const modal = el("tradeModal");
  if (!modal) return;
  el("openTradeModal").addEventListener("click", () => {
    el("tradeForm").reset();
    el("dateInput").value = state.selectedDay;
    if (state.selectedAssetId) {
      el("assetSelect").value = state.selectedAssetId;
    }
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("show"));
    updatePreview();
  });
  el("closeTradeModal").addEventListener("click", () => {
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 220);
  });
}

function bindPreview() {
  if (!el("tradeForm")) return;
  ["assetSelect", "entryInput", "exitInput", "stopLossInput", "takeProfitInput", "lotSizeInput", "directionInput", "capitalInput"].forEach(
    (id) => el(id).addEventListener("input", updatePreview)
  );
}

function bindTradeSubmit() {
  if (!el("tradeForm")) return;
  el("tradeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = { ...Object.fromEntries(new FormData(e.target).entries()), ...modePayload() };
    const res = await bbFetch("/api/trades/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      alert("Trade save failed.");
      return;
    }
    const modal = el("tradeModal");
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 220);
    renderCalendar(await loadTradesForMonth());
  });
}

async function initCalendar() {
  if (!el("calendarGrid")) return;
  await loadSelectOptions();
  const trades = await loadTradesForMonth();
  renderCalendar(trades);
  bindModal();
  bindPreview();
  bindTradeSubmit();
  updatePreview();

  el("prevMonth").addEventListener("click", async () => {
    state.currentMonth = state.currentMonth.subtract(1, "month");
    renderCalendar(await loadTradesForMonth());
  });
  el("nextMonth").addEventListener("click", async () => {
    state.currentMonth = state.currentMonth.add(1, "month");
    renderCalendar(await loadTradesForMonth());
  });
}

initCalendar();
