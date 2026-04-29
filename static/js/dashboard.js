async function loadDashboard() {
  const totalPnlEl = document.getElementById("totalPnl");
  const winRateEl = document.getElementById("winRate");
  const totalTradesEl = document.getElementById("totalTrades");
  totalPnlEl.classList.add("skeleton");
  winRateEl.classList.add("skeleton");
  totalTradesEl.classList.add("skeleton");

  const res = await bbFetch("/api/dashboard/");
  const data = await res.json();

  totalPnlEl.classList.remove("skeleton");
  winRateEl.classList.remove("skeleton");
  totalTradesEl.classList.remove("skeleton");
  totalPnlEl.textContent = data.total_pnl.toFixed(2);
  winRateEl.textContent = `${data.win_rate.toFixed(2)}%`;
  totalTradesEl.textContent = data.total_trades;

  const equityCtx = document.getElementById("equityChart");
  const monthlyCtx = document.getElementById("monthlyChart");

  new Chart(equityCtx, {
    type: "line",
    data: {
      labels: data.equity_curve.map((x) => x.date),
      datasets: [{ label: "Equity", data: data.equity_curve.map((x) => x.equity), borderWidth: 2 }],
    },
    options: { animation: { duration: 800, easing: "easeOutQuart" } },
  });

  new Chart(monthlyCtx, {
    type: "bar",
    data: {
      labels: data.monthly_pnl.map((x) => x.month),
      datasets: [{ label: "Monthly PnL", data: data.monthly_pnl.map((x) => x.pnl), borderWidth: 1 }],
    },
    options: { animation: { duration: 800, easing: "easeOutQuart" } },
  });
}

loadDashboard();
