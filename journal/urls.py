from django.urls import path

from . import auth_views, views

urlpatterns = [
    path("login/", auth_views.login_view, name="login"),
    path("register/", auth_views.register_view, name="register"),
    path("logout/", auth_views.logout_view, name="logout"),
    path("", views.landing_page, name="home"),
    path("dashboard/", views.dashboard_page, name="dashboard"),
    path("assets/", views.assets_page, name="assets-page"),
    path("calendar/", views.calendar_page, name="calendar-page"),
    path("calendar/<int:asset_id>/<str:date>/", views.day_detail_page, name="day-detail-page"),
    path("strategies/", views.strategies_page, name="strategies-page"),
    path("propfirm/", views.propfirm_page, name="propfirm-page"),
    path("analytics/", views.analytics_page, name="analytics-page"),
    path("api/assets/", views.assets_api, name="assets-api"),
    path("api/strategies/", views.strategies_api, name="strategies-api"),
    path("api/trades/", views.trades_api, name="trades-api"),
    path("api/trades/<int:trade_id>/", views.trade_detail_api, name="trade-detail-api"),
    path("api/dashboard/", views.dashboard_api, name="dashboard-api"),
    path("api/propfirm/profiles/", views.propfirm_profiles_api, name="propfirm-profiles-api"),
    path("api/propfirm/consistency/", views.propfirm_consistency_api, name="propfirm-consistency-api"),
    path("api/mode/", views.mode_api, name="mode-api"),
    path("api/analytics/", views.analytics_api, name="analytics-api"),
]
