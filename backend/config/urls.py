from django.urls import path
from api.auth.views import login_view, me_view
from api.categories.views import categories_list, categories_detail
from api.rules.views import rules_list, rules_detail
from api.visits.views import visits_list, visits_detail, visits_process, visits_generate_reminders
from api.users.views import users_list, users_detail, users_reset_password
from api.stats.views import dashboard_stats
from api.warnings.views import (
    warnings_list,
    warnings_detail,
    warnings_refresh,
    warnings_follow_up,
    warnings_resolve,
    warnings_ignore,
    warnings_stats,
    warning_rules_list,
    warning_rules_detail,
    warning_rules_delete,
)

urlpatterns = [
    path('api/auth/login', login_view),
    path('api/auth/me', me_view),
    path('api/categories', categories_list),
    path('api/categories/<str:pk>', categories_detail),
    path('api/rules', rules_list),
    path('api/rules/<str:pk>', rules_detail),
    path('api/visits', visits_list),
    path('api/visits/generate-reminders', visits_generate_reminders),
    path('api/visits/<str:pk>', visits_detail),
    path('api/visits/<str:pk>/process', visits_process),
    path('api/users', users_list),
    path('api/users/<str:pk>', users_detail),
    path('api/users/<str:pk>/reset-password', users_reset_password),
    path('api/users/<str:pk>/password', users_reset_password),
    path('api/stats/dashboard', dashboard_stats),
    path('api/warnings', warnings_list),
    path('api/warnings/refresh', warnings_refresh),
    path('api/warnings/stats', warnings_stats),
    path('api/warnings/<str:pk>', warnings_detail),
    path('api/warnings/<str:pk>/follow-up', warnings_follow_up),
    path('api/warnings/<str:pk>/resolve', warnings_resolve),
    path('api/warnings/<str:pk>/ignore', warnings_ignore),
    path('api/warning-rules', warning_rules_list),
    path('api/warning-rules/<str:pk>', warning_rules_detail),
    path('api/warning-rules/<str:pk>/delete', warning_rules_delete),
]
