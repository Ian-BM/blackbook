"""Aggregate trade stats and auto-generated insights for the analytics API."""
from collections import Counter, defaultdict


def parse_trade_tags(raw):
    """Normalize tags from API payload (list or comma-separated string)."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(t).strip() for t in raw if str(t).strip()]
    if isinstance(raw, str):
        return [p.strip() for p in raw.split(",") if p.strip()]
    return []


def build_analytics(trades_qs):
    """
    trades_qs: QuerySet of Trade with select_related('strategy').
    Returns dict matching GET /api/analytics/ shape.
    """
    trades = list(trades_qs)
    total_trades = len(trades)
    if total_trades == 0:
        return {
            "total_trades": 0,
            "win_rate": 0.0,
            "total_pnl": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "win_loss_distribution": {"wins": 0, "losses": 0},
            "strategy_distribution": [],
            "tag_distribution": [],
            "monthly_pnl": [],
            "strategy_performance": [],
            "insights": ["Add trades to unlock analytics and insights."],
        }

    wins_list = [t for t in trades if t.pnl_usd > 0]
    losses_list = [t for t in trades if t.pnl_usd < 0]
    breakeven = total_trades - len(wins_list) - len(losses_list)
    wins = len(wins_list)
    losses = len(losses_list)

    total_pnl = sum(t.pnl_usd for t in trades)
    win_rate = (wins / total_trades) * 100

    avg_win = sum(t.pnl_usd for t in wins_list) / wins if wins else 0.0
    avg_loss = sum(t.pnl_usd for t in losses_list) / losses if losses else 0.0

    # Strategy: trade counts
    strat_counts = Counter()
    strat_pnls = defaultdict(float)
    strat_wins = defaultdict(int)
    strat_totals = defaultdict(int)
    for t in trades:
        name = t.strategy.name
        strat_counts[name] += 1
        strat_pnls[name] += t.pnl_usd
        strat_totals[name] += 1
        if t.pnl_usd > 0:
            strat_wins[name] += 1

    strategy_distribution = [
        {"strategy": name, "count": c} for name, c in strat_counts.most_common()
    ]
    strategy_performance = [
        {"strategy": name, "pnl": round(strat_pnls[name], 2)} for name in strat_pnls
    ]
    strategy_performance.sort(key=lambda x: x["pnl"], reverse=True)

    # Tags
    tag_counts = Counter()
    tag_losses = Counter()
    tag_trades = Counter()
    for t in trades:
        tags = t.tags if isinstance(t.tags, list) else []
        for tag in tags:
            tag = str(tag).strip()
            if not tag:
                continue
            tag_counts[tag] += 1
            tag_trades[tag] += 1
            if t.pnl_usd < 0:
                tag_losses[tag] += 1

    tag_distribution = [{"tag": tag, "count": c} for tag, c in tag_counts.most_common()]

    # Monthly PnL
    monthly = defaultdict(float)
    for t in trades:
        key = t.date.strftime("%Y-%m")
        monthly[key] += t.pnl_usd
    monthly_pnl = [
        {"month": m, "pnl": round(monthly[m], 2)} for m in sorted(monthly.keys())
    ]

    # Insights
    insights = []

    # Best strategy by win rate (min 3 trades)
    best_strat = None
    best_wr = -1.0
    for name, tot in strat_totals.items():
        if tot < 3:
            continue
        wr = (strat_wins[name] / tot) * 100
        if wr > best_wr:
            best_wr = wr
            best_strat = name
    if best_strat:
        insights.append(
            f"Your best strategy is {best_strat} with {best_wr:.1f}% win rate (3+ trades)."
        )

    # Dominating strategy by volume
    if strategy_distribution:
        top_name, top_count = strategy_distribution[0]["strategy"], strategy_distribution[0]["count"]
        if top_count / total_trades >= 0.5:
            insights.append(
                f"Over half your trades ({top_count}/{total_trades}) use strategy “{top_name}”."
            )

    # Worst tag by losses
    worst_tag = None
    worst_loss_ratio = -1.0
    for tag, tcount in tag_trades.items():
        if tcount < 2:
            continue
        lr = tag_losses[tag] / tcount
        if lr > worst_loss_ratio:
            worst_loss_ratio = lr
            worst_tag = tag
    if worst_tag and worst_loss_ratio >= 0.5:
        insights.append(
            f"You lose most trades when tagged as “{worst_tag}” "
            f"({tag_losses[worst_tag]} losses in {tag_trades[worst_tag]} tagged trades)."
        )

    if losses and wins:
        if abs(avg_loss) > avg_win:
            insights.append(
                "Your average loss is higher than your average win — consider tighter risk or smaller size on losers."
            )

    # Best month
    if monthly_pnl:
        best_month = max(monthly_pnl, key=lambda x: x["pnl"])
        worst_month = min(monthly_pnl, key=lambda x: x["pnl"])
        if best_month["pnl"] > 0:
            insights.append(
                f"You performed best in {best_month['month']} (PnL {best_month['pnl']:+.2f} USD)."
            )
        if worst_month["pnl"] < 0:
            insights.append(
                f"Toughest month so far: {worst_month['month']} (PnL {worst_month['pnl']:.2f} USD)."
            )

    # Best weekday
    dow_pnl = defaultdict(float)
    dow_counts = defaultdict(int)
    for t in trades:
        dow = t.date.weekday()
        dow_pnl[dow] += t.pnl_usd
        dow_counts[dow] += 1
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    if dow_pnl:
        best_dow = max(dow_pnl, key=lambda d: dow_pnl[d])
        insights.append(
            f"Best weekday by total PnL: {names[best_dow]} ({dow_pnl[best_dow]:+.2f} USD across {dow_counts[best_dow]} trades)."
        )

    if breakeven:
        insights.append(f"{breakeven} trade(s) closed at breakeven (excluded from win/loss pie segments).")

    if not insights:
        insights.append("Keep journaling — more data will sharpen these insights.")

    return {
        "total_trades": total_trades,
        "win_rate": round(win_rate, 2),
        "total_pnl": round(total_pnl, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "win_loss_distribution": {
            "wins": wins,
            "losses": losses,
            "breakeven": breakeven,
        },
        "strategy_distribution": strategy_distribution,
        "tag_distribution": tag_distribution,
        "monthly_pnl": monthly_pnl,
        "strategy_performance": strategy_performance,
        "insights": insights,
    }
