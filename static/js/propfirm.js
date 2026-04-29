async function loadProfiles() {
  const res = await bbFetch("/api/propfirm/profiles/");
  return res.json();
}

async function loadMode() {
  const res = await bbFetch("/api/mode/");
  return res.json();
}

async function loadConsistency(profileId) {
  const res = await bbFetch(`/api/propfirm/consistency/?profile_id=${profileId}`);
  return res.json();
}

async function renderProfiles() {
  const list = document.getElementById("propfirmList");
  const select = document.getElementById("activeProfileSelect");
  if (!list || !select) return;
  const profiles = await loadProfiles();
  const active = localStorage.getItem("active_profile_id") || "";
  select.innerHTML = `<option value="">Select Profile</option>${profiles
    .map((p) => `<option value="${p.id}" ${String(p.id) === active ? "selected" : ""}>${p.name}</option>`)
    .join("")}`;
  list.innerHTML = profiles
    .map(
      (p) =>
        `<div class="trade-row"><b>${p.name}</b> | DD ${p.max_drawdown}% | Daily ${p.max_daily_loss}% | Risk ${p.risk_per_trade}% | Min Win ${p.min_win_rate}% | Trades/day ${p.max_trades_per_day} | Consistency ${p.consistency_rule}% | Max days ${p.max_trading_days} | Target ${p.profit_target_percent}% | Leverage ${p.leverage_required}x | Best day rule ${p.best_day_rule}%</div>`
    )
    .join("");
}

async function initPropFirmPage() {
  const form = document.getElementById("propfirmForm");
  if (!form) return;

  await renderProfiles();
  const serverMode = await loadMode();
  const chosenMode = localStorage.getItem("journal_mode") || serverMode.mode || "normal";
  document.querySelector(`input[name="journalMode"][value="${chosenMode}"]`).checked = true;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("pfName").value,
      max_drawdown: document.getElementById("pfDrawdown").value,
      max_daily_loss: document.getElementById("pfDailyLoss").value,
      risk_per_trade: document.getElementById("pfRisk").value,
      min_win_rate: document.getElementById("pfWinRate").value,
      max_trades_per_day: document.getElementById("pfTradesPerDay").value,
      consistency_rule: document.getElementById("pfConsistencyRule").value,
      max_trading_days: document.getElementById("pfMaxTradingDays").value,
      profit_target_percent: document.getElementById("pfProfitTarget").value,
      leverage_required: document.getElementById("pfLeverageRequired").value,
      best_day_rule: document.getElementById("pfBestDayRule").value,
    };
    await bbFetch("/api/propfirm/profiles/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    form.reset();
    renderProfiles();
  });

  const runBtn = document.getElementById("runConsistencyCheck");
  const resultBox = document.getElementById("consistencyResult");
  if (runBtn && resultBox) {
    runBtn.addEventListener("click", async () => {
      const activeProfileId = document.getElementById("activeProfileSelect").value;
      if (!activeProfileId) {
        resultBox.innerHTML = "Select a profile first.";
        return;
      }
      const data = await loadConsistency(activeProfileId);
      if (data.detail) {
        resultBox.innerHTML = data.detail;
        return;
      }
      resultBox.innerHTML = `
        <strong>${data.profile}</strong><br>
        Threshold: ${data.threshold_percent}%<br>
        Largest winning day: ${data.largest_day_percent}% (${data.largest_day_pnl} USD)<br>
        Total positive PnL: ${data.total_positive_pnl} USD<br>
        Status: ${data.passed ? "✅ Pass" : "❌ Fail"}<br>
        ${data.message}
      `;
    });
  }

  document.getElementById("saveModeBtn").addEventListener("click", async () => {
    const mode = document.querySelector('input[name="journalMode"]:checked').value;
    const activeProfileId = document.getElementById("activeProfileSelect").value;
    localStorage.setItem("journal_mode", mode);
    localStorage.setItem("active_profile_id", activeProfileId);
    await bbFetch("/api/mode/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, active_profile_id: activeProfileId }),
    });
    alert("Mode saved.");
  });
}

initPropFirmPage();
