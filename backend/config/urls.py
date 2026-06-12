from django.urls import path
from api.auth.views import login_view, me_view
from api.categories.views import categories_list, categories_detail
from api.rules.views import rules_list, rules_detail
from api.visits.views import visits_list, visits_detail, visits_process
from api.users.views import users_list, users_detail, users_reset_password
from api.stats.views import dashboard_stats

urlpatterns = [
    path('api/auth/login', login_view),
    path('api/auth/me', me_view),
    path('api/categories', categories_list),
    path('api/categories/<str:pk>', categories_detail),
    path('api/rules', rules_list),
    path('api/rules/<str:pk>', rules_detail),
    path('api/visits', visits_list),
    path('api/visits/<str:pk>', visits_detail),
    path('api/visits/<str:pk>/process', visits_process),
    path('api/users', users_list),
    path('api/users/<str:pk>', users_detail),
    path('api/users/<str:pk>/reset-password', users_reset_password),
    path('api/stats/dashboard', dashboard_stats),
]
