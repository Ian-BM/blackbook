def _pip_multiplier(asset_type):
    if asset_type == "forex":
        return 10000
    if asset_type == "gold":
        return 100
    return 1


def calculate_pips(entry, exit_price, direction, asset_type):
    delta = (exit_price - entry) if direction == "BUY" else (entry - exit_price)
    return delta * _pip_multiplier(asset_type)


def pip_value(lot_size, asset_type):
    if asset_type == "forex":
        return lot_size * 10
    if asset_type == "gold":
        return lot_size * 1
    return lot_size


def calculate_pnl(pips, lot_size, asset_type):
    return pips * pip_value(lot_size, asset_type)


def convert_to_tzs(usd):
    return usd * 2500


def calculate_risk(entry, stop_loss, lot_size, capital, asset_type):
    if stop_loss is None or capital <= 0:
        return None
    risk_amount = abs(entry - stop_loss) * pip_value(lot_size, asset_type)
    return (risk_amount / capital) * 100


def simulate_pnl(entry, exit_price, stop_loss, direction, asset_type):
    capitals = [10000, 100000, 5000000]
    results = []
    pips = calculate_pips(entry, exit_price, direction, asset_type)
    if stop_loss is None:
        return [{"capital": cap, "lot_size": None, "pnl": None} for cap in capitals]

    price_risk = abs(entry - stop_loss)
    if price_risk == 0:
        return [{"capital": cap, "lot_size": None, "pnl": None} for cap in capitals]

    unit_pip_value = pip_value(1, asset_type)
    denom = price_risk * unit_pip_value
    if denom == 0:
        return [{"capital": cap, "lot_size": None, "pnl": None} for cap in capitals]

    for cap in capitals:
        lot_size = (cap * 0.01) / denom
        pnl = calculate_pnl(pips, lot_size, asset_type)
        results.append({"capital": cap, "lot_size": lot_size, "pnl": pnl})

    return results


def check_rules(trade, rules, trades_today, drawdown):
    violations = []

    if trade["risk_percent"] > rules.risk_per_trade:
        violations.append("Risk too high")
    if trades_today >= rules.max_trades_per_day:
        violations.append("Too many trades")
    if drawdown > rules.max_drawdown:
        violations.append("Drawdown exceeded")

    return {"followed": len(violations) == 0, "violations": violations}


def calculate_rr(entry, stop_loss, take_profit, direction):
    if stop_loss is None or take_profit is None:
        return None

    if direction == "BUY":
        risk = entry - stop_loss
        reward = take_profit - entry
    else:
        risk = stop_loss - entry
        reward = entry - take_profit

    if risk <= 0:
        return None
    return reward / risk
