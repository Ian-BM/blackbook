const chartRefs = {};

const colors = {
  win: "rgba(47, 143, 84, 0.85)",
  loss: "rgba(181, 67, 93, 0.85)",
  neutral: "rgba(132, 183, 255, 0.7)",
  palette: [
    "#5b8cff",
    "#2f8f54",
    "#e6a23c",
    "#b5435d",
    "#9b59b6",
    "#1abc9c",
    "#e74c3c",
    "#3498db",
  ],
};

function destroyChart(key) {
  if (chartRefs[key]) {
    chartRefs[key].destroy();
    chartRefs[key] = null;
  }
}

function setPnlCardClass(el, value) {
  el.classList.remove("card-good", "card-bad");
  if (value > 0) el.classList.add("card-good");
  else if (value < 0) el.classList.add("card-bad");
}

async function loadAnalytics() {
  const insightsEl = document.getElementById("insightsList");
  insightsEl.innerHTML = '<div class="loading-spinner"></div>';
  const res = await bbFetch("/api/analytics/");
  const d = await res.json();

  document.getElementById("statTotalTrades").textContent = d.total_trades;
  document.getElementById("statWinRate").textContent = `${d.win_rate}%`;
  document.getElementById("statTotalPnl").textContent = d.total_pnl.toFixed(2);
  document.getElementById("statAvgWin").textContent = d.avg_win.toFixed(2);
  document.getElementById("statAvgLoss").textContent = d.avg_loss.toFixed(2);

  setPnlCardClass(document.getElementById("statPnlCard"), d.total_pnl);

  const ul = document.getElementById("insightsList");
  ul.innerHTML = (d.insights || []).map((t) => `<li>${t}</li>`).join("");

  const wl = d.win_loss_distribution || {};
  const pieLabels = [];
  const pieData = [];
  const pieColors = [];
  if (wl.wins > 0) {
    pieLabels.push("Wins");
    pieData.push(wl.wins);
    pieColors.push(colors.win);
  }
  if (wl.losses > 0) {
    pieLabels.push("Losses");
    pieData.push(wl.losses);
    pieColors.push(colors.loss);
  }
  if (wl.breakeven > 0) {
    pieLabels.push("Breakeven");
    pieData.push(wl.breakeven);
    pieColors.push(colors.neutral);
  }
  if (!pieData.length) {
    pieLabels.push("No data");
    pieData.push(1);
    pieColors.push("#444");
  }

  destroyChart("winLoss");
  chartRefs.winLoss = new Chart(document.getElementById("chartWinLoss"), {
    type: "pie",
    data: {
      labels: pieLabels,
      datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 1 }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, animation: { duration: 800, easing: "easeOutQuart" } },
  });

  const stratDist = d.strategy_distribution || [];
  const stratLabels = stratDist.length ? stratDist.map((x) => x.strategy) : ["No data"];
  const stratCounts = stratDist.length ? stratDist.map((x) => x.count) : [1];
  destroyChart("stratDist");
  chartRefs.stratDist = new Chart(document.getElementById("chartStrategyDist"), {
    type: "pie",
    data: {
      labels: stratLabels,
      datasets: [
        {
          data: stratCounts,
          backgroundColor: stratLabels.map((_, i) => colors.palette[i % colors.palette.length]),
          borderWidth: 1,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, animation: { duration: 800, easing: "easeOutQuart" } },
  });

  const tagDist = d.tag_distribution || [];
  const tagLabels = tagDist.length ? tagDist.map((x) => x.tag) : ["No tags yet"];
  const tagCounts = tagDist.length ? tagDist.map((x) => x.count) : [1];
  destroyChart("tagDist");
  chartRefs.tagDist = new Chart(document.getElementById("chartTagDist"), {
    type: "pie",
    data: {
      labels: tagLabels,
      datasets: [
        {
          data: tagCounts,
          backgroundColor: tagLabels.map((_, i) => colors.palette[i % colors.palette.length]),
          borderWidth: 1,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, animation: { duration: 800, easing: "easeOutQuart" } },
  });

  const monthly = d.monthly_pnl || [];
  const monthLabels = monthly.length ? monthly.map((x) => x.month) : ["—"];
  const monthData = monthly.length ? monthly.map((x) => x.pnl) : [0];
  destroyChart("monthly");
  chartRefs.monthly = new Chart(document.getElementById("chartMonthly"), {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: "PnL (USD)",
          data: monthData,
          backgroundColor: monthly.length
            ? monthly.map((x) => (x.pnl >= 0 ? colors.win : colors.loss))
            : ["#444"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
      animation: { duration: 800, easing: "easeOutQuart" },
    },
  });

  const stratPnl = d.strategy_performance || [];
  const spLabels = stratPnl.length ? stratPnl.map((x) => x.strategy) : ["—"];
  const spData = stratPnl.length ? stratPnl.map((x) => x.pnl) : [0];
  destroyChart("stratPnl");
  chartRefs.stratPnl = new Chart(document.getElementById("chartStrategyPnl"), {
    type: "bar",
    data: {
      labels: spLabels,
      datasets: [
        {
          label: "PnL (USD)",
          data: spData,
          backgroundColor: stratPnl.length
            ? stratPnl.map((x) => (x.pnl >= 0 ? colors.win : colors.loss))
            : ["#444"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      indexAxis: "y",
      scales: { x: { beginAtZero: true } },
      plugins: { legend: { display: false } },
      animation: { duration: 800, easing: "easeOutQuart" },
    },
  });
}

loadAnalytics();
