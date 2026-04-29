from rest_framework import serializers

from .models import Asset, PropFirmProfile, Strategy, Trade


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = ["id", "name", "symbol", "asset_type"]


class StrategySerializer(serializers.ModelSerializer):
    class Meta:
        model = Strategy
        fields = ["id", "name"]


class TradeSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_symbol = serializers.CharField(source="asset.symbol", read_only=True)
    strategy_name = serializers.CharField(source="strategy.name", read_only=True)

    class Meta:
        model = Trade
        fields = [
            "id",
            "asset",
            "asset_name",
            "asset_symbol",
            "strategy",
            "strategy_name",
            "date",
            "entry",
            "exit",
            "stop_loss",
            "take_profit",
            "lot_size",
            "direction",
            "pips",
            "pnl_usd",
            "pnl_tzs",
            "risk_percent",
            "risk_reward_ratio",
            "followed_rules",
            "rule_violation",
            "notes",
            "tags",
        ]


class PropFirmProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropFirmProfile
        fields = [
            "id",
            "name",
            "max_drawdown",
            "max_daily_loss",
            "risk_per_trade",
            "min_win_rate",
            "max_trades_per_day",
            "consistency_rule",
            "max_trading_days",
            "profit_target_percent",
            "leverage_required",
            "best_day_rule",
            "created_at",
        ]
