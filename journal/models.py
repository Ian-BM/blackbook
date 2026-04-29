from django.conf import settings
from django.db import models


class Asset(models.Model):
    ASSET_TYPE_CHOICES = [
        ("forex", "Forex"),
        ("gold", "Gold"),
        ("crypto", "Crypto"),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assets",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=50)
    symbol = models.CharField(max_length=20)
    asset_type = models.CharField(max_length=20, choices=ASSET_TYPE_CHOICES, default="forex")

    def __str__(self):
        return f"{self.name} ({self.symbol})"


class Strategy(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="strategies",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name


class Trade(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trades",
        null=True,
        blank=True,
    )
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)
    strategy = models.ForeignKey(Strategy, on_delete=models.CASCADE)

    date = models.DateField()
    entry = models.FloatField()
    exit = models.FloatField()
    stop_loss = models.FloatField(null=True, blank=True)
    take_profit = models.FloatField(null=True, blank=True)
    lot_size = models.FloatField()
    direction = models.CharField(max_length=4)

    pips = models.FloatField()
    pnl_usd = models.FloatField()
    pnl_tzs = models.FloatField()
    risk_percent = models.FloatField(null=True, blank=True)
    risk_reward_ratio = models.FloatField(null=True, blank=True)

    followed_rules = models.BooleanField(default=True)
    rule_violation = models.TextField(null=True, blank=True)

    notes = models.TextField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.asset.symbol} {self.direction} {self.date}"


class PropFirmRule(models.Model):
    max_daily_loss = models.FloatField()
    max_drawdown = models.FloatField()
    risk_per_trade = models.FloatField()
    max_trades_per_day = models.IntegerField()
    min_rr = models.FloatField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Prop Rules #{self.pk}"


class PropFirmProfile(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="propfirm_profiles",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    max_drawdown = models.FloatField()
    max_daily_loss = models.FloatField()
    risk_per_trade = models.FloatField()
    min_win_rate = models.FloatField()
    max_trades_per_day = models.IntegerField()
    consistency_rule = models.FloatField(default=0)
    max_trading_days = models.IntegerField(default=0)
    profit_target_percent = models.FloatField(default=0)
    leverage_required = models.FloatField(default=0)
    best_day_rule = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
