from fastapi import APIRouter

from app.api.v1 import auth, users, spaces, columns, cards, tags, calendar, webhooks, agents, notifications, filter_templates, scheduled_cards, admin, search, dashboard, analytics

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(spaces.router, prefix="/spaces", tags=["Spaces"])
api_router.include_router(columns.router, prefix="/columns", tags=["Columns"])
api_router.include_router(cards.router, prefix="/cards", tags=["Cards"])
api_router.include_router(tags.router, prefix="/tags", tags=["Tags"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
api_router.include_router(agents.router, prefix="/agents", tags=["Agents"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(filter_templates.router, prefix="/filter-templates", tags=["Filter Templates"])
api_router.include_router(scheduled_cards.router, prefix="/scheduled-cards", tags=["Scheduled Cards"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(search.router, tags=["Search"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(analytics.router, tags=["Analytics"])
