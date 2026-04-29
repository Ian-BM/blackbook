from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404, render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Asset, PropFirmProfile, Strategy, Trade
from .serializers import (
    AssetSerializer,
    PropFirmProfileSerializer,
    StrategySerializer,
    TradeSerializer,
)
from .utils.analytics import build_analytics, parse_trade_tags
from .utils.calc import (
    calculate_rr,
    calculate_pips,
    calculate_pnl,
    calculate_risk,
    check_rules,
    convert_to_tzs,
)


DEFAULT_CAPITAL = 10000


def landing_page(request):
    return render(request, "landing.html")


@login_required
def dashboard_page(request):
    return render(request, "dashboard.html")


@login_required
def assets_page(request):
    return render(request, "assets.html")


@login_required
def calendar_page(request):
    return render(request, "calendar.html")


@login_required
def strategies_page(request):
    return render(request, "strategies.html")


@login_required
def propfirm_page(request):
    return render(request, "propfirm.html")


@login_required
def day_detail_page(request, asset_id, date):
    asset = get_object_or_404(Asset, pk=asset_id, user=request.user)
    return render(request, "day_detail.html", {"asset": asset, "date": date})


@login_required
def analytics_page(request):
    return render(request, "analytics.html")


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def assets_api(request):
    if request.method == "POST":
        serializer = AssetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    assets = Asset.objects.filter(user=request.user).order_by("name")
    return Response(AssetSerializer(assets, many=True).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def strategies_api(request):
    if request.method == "POST":
        serializer = StrategySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    strategies = Strategy.objects.filter(user=request.user).order_by("name")
    return Response(StrategySerializer(strategies, many=True).data)


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def trades_api(request):
    if request.method == "POST":
        trade = create_or_update_trade(request.data, user=request.user)
        return Response(TradeSerializer(trade).data, status=status.HTTP_201_CREATED)

    trades = (
        Trade.objects.select_related("asset", "strategy")
        .filter(user=request.user)
        .order_by("-date", "-id")
    )
    asset_id = request.GET.get("asset_id")
    month = request.GET.get("month")
    year = request.GET.get("year")
    day = request.GET.get("day")

    if asset_id:
        trades = trades.filter(asset_id=asset_id)
    if month and year:
        trades = trades.filter(date__month=month, date__year=year)
    if day:
        trades = trades.filter(date=day)

    return Response(TradeSerializer(trades, many=True).data)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def trade_detail_api(request, trade_id):
    trade = get_object_or_404(Trade, pk=trade_id, user=request.user)
    if request.method == "DELETE":
        trade.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    updated = create_or_update_trade(request.data, trade=trade, user=request.user)
    return Response(TradeSerializer(updated).data)


def create_or_update_trade(payload, user, trade=None):
    direction = payload.get("direction", "").upper()
    entry = float(payload.get("entry"))
    exit_price = float(payload.get("exit"))
    lot_size = float(payload.get("lot_size"))
    capital = float(payload.get("capital", DEFAULT_CAPITAL))
    stop_loss_raw = payload.get("stop_loss")
    take_profit_raw = payload.get("take_profit")
    stop_loss = float(stop_loss_raw) if str(stop_loss_raw).strip() != "" else None
    take_profit = float(take_profit_raw) if str(take_profit_raw).strip() != "" else None

    asset = get_object_or_404(Asset, pk=payload.get("asset"), user=user)
    get_object_or_404(Strategy, pk=payload.get("strategy"), user=user)
    asset_type = asset.asset_type

    pips = calculate_pips(entry, exit_price, direction, asset_type)
    pnl_usd = calculate_pnl(pips, lot_size, asset_type)
    pnl_tzs = convert_to_tzs(pnl_usd)
    risk_percent = (
        calculate_risk(entry, stop_loss, lot_size, capital, asset_type)
        if stop_loss is not None
        else None
    )
    rr = calculate_rr(entry, stop_loss, take_profit, direction)

    date = payload.get("date")
    user_trades = Trade.objects.filter(user=user)
    trades_today = (
        user_trades.filter(date=date).exclude(pk=getattr(trade, "pk", None)).count()
    )
    total_pnl = (
        user_trades.exclude(pk=getattr(trade, "pk", None)).aggregate(total=Sum("pnl_usd"))["total"]
        or 0.0
    )
    drawdown = abs(total_pnl) if total_pnl < 0 else 0.0

    mode = payload.get("mode") or "normal"
    profile_id = payload.get("active_profile_id")
    rule_result = {"followed": True, "violations": []}
    if mode == "propfirm" and profile_id:
        profile = PropFirmProfile.objects.filter(pk=profile_id, user=user).first()
        if profile:
            rule_result = check_rules(
                {"risk_percent": risk_percent or 0},
                profile,
                trades_today,
                drawdown,
            )
            if total_pnl + pnl_usd < 0 and abs(total_pnl + pnl_usd) > profile.max_daily_loss:
                rule_result["violations"].append("Daily loss exceeded")
            win_rate = (
                user_trades.filter(pnl_usd__gt=0).count()
                / max(user_trades.count(), 1)
                * 100
            )
            if win_rate < profile.min_win_rate:
                rule_result["violations"].append("Win rate below profile minimum")
            rule_result["followed"] = len(rule_result["violations"]) == 0

    payload_data = {
        "user_id": user.pk,
        "asset_id": payload.get("asset"),
        "strategy_id": payload.get("strategy"),
        "date": date,
        "entry": entry,
        "exit": exit_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "lot_size": lot_size,
        "direction": direction,
        "pips": pips,
        "pnl_usd": pnl_usd,
        "pnl_tzs": pnl_tzs,
        "risk_percent": risk_percent,
        "risk_reward_ratio": rr,
        "followed_rules": rule_result["followed"],
        "rule_violation": ", ".join(rule_result["violations"]) if rule_result["violations"] else "",
        "notes": payload.get("notes", ""),
        "tags": parse_trade_tags(payload.get("tags")),
    }
    if trade is None:
        return Trade.objects.create(**payload_data)
    for key, value in payload_data.items():
        setattr(trade, key, value)
    trade.save()
    return trade


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_api(request):
    trades = Trade.objects.filter(user=request.user).order_by("date", "id")
    total_pnl = trades.aggregate(total=Sum("pnl_usd"))["total"] or 0.0
    total_trades = trades.count()
    wins = trades.filter(pnl_usd__gt=0).count()
    win_rate = (wins / total_trades * 100) if total_trades else 0

    running = 0
    equity_curve = []
    for trade in trades:
        running += trade.pnl_usd
        equity_curve.append(
            {
                "date": trade.date.isoformat(),
                "equity": round(running, 2),
                "pnl": round(trade.pnl_usd, 2),
            }
        )

    monthly = (
        trades.annotate(month=TruncMonth("date"))
        .values("month")
        .annotate(pnl=Sum("pnl_usd"))
        .order_by("month")
    )
    monthly_pnl = [
        {"month": row["month"].strftime("%Y-%m"), "pnl": round(row["pnl"] or 0, 2)}
        for row in monthly
    ]

    return Response(
        {
            "total_pnl": round(total_pnl, 2),
            "win_rate": round(win_rate, 2),
            "total_trades": total_trades,
            "equity_curve": equity_curve,
            "monthly_pnl": monthly_pnl,
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def propfirm_profiles_api(request):
    if request.method == "POST":
        serializer = PropFirmProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    profiles = PropFirmProfile.objects.filter(user=request.user).order_by("-created_at")
    return Response(PropFirmProfileSerializer(profiles, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_api(request):
    trades = Trade.objects.select_related("strategy").filter(user=request.user)
    data = build_analytics(trades)
    return Response(data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def mode_api(request):
    if request.method == "POST":
        mode = request.data.get("mode", "normal")
        active_profile_id = request.data.get("active_profile_id")
        request.session["mode"] = mode
        request.session["active_profile_id"] = active_profile_id
    return Response(
        {
            "mode": request.session.get("mode", "normal"),
            "active_profile_id": request.session.get("active_profile_id"),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def propfirm_consistency_api(request):
    profile_id = request.GET.get("profile_id")
    if not profile_id:
        return Response({"detail": "profile_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    profile = get_object_or_404(PropFirmProfile, pk=profile_id, user=request.user)
    trades = Trade.objects.filter(user=request.user).order_by("date")

    winning_trades = [t for t in trades if t.pnl_usd > 0]
    total_positive = sum(t.pnl_usd for t in winning_trades)

    day_wins = {}
    for trade in winning_trades:
        key = trade.date.isoformat()
        day_wins[key] = day_wins.get(key, 0) + trade.pnl_usd

    largest_day = max(day_wins.values()) if day_wins else 0
    largest_day_percent = (largest_day / total_positive * 100) if total_positive > 0 else 0
    threshold = profile.consistency_rule or 0
    passed = largest_day_percent <= threshold if threshold > 0 else True

    return Response(
        {
            "profile": profile.name,
            "threshold_percent": round(threshold, 2),
            "largest_day_percent": round(largest_day_percent, 2),
            "largest_day_pnl": round(largest_day, 2),
            "total_positive_pnl": round(total_positive, 2),
            "passed": passed,
            "message": (
                "Consistency rule respected."
                if passed
                else "Largest winning day exceeds your consistency threshold."
            ),
        }
    )
