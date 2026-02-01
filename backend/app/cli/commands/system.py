import typer
import httpx
import redis

from sqlalchemy import text, select

from app.cli.utils.output import output_success, output_error, output_data, create_table, console
from app.cli.utils.db import get_db_session
from app.core.config import settings
from app.models.user import User
from app.models.space import Space
from app.models.card import Card

app = typer.Typer(no_args_is_help=True)


@app.command("health")
def health_check(
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Check health of all services."""
    results = {
        "database": {"status": "unknown", "message": ""},
        "redis": {"status": "unknown", "message": ""},
        "api": {"status": "unknown", "message": ""},
    }
    
    session = get_db_session()
    try:
        session.execute(text("SELECT 1"))
        results["database"] = {"status": "healthy", "message": "Connected"}
    except Exception as e:
        results["database"] = {"status": "unhealthy", "message": str(e)}
    finally:
        session.close()
    
    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        results["redis"] = {"status": "healthy", "message": "Connected"}
    except Exception as e:
        results["redis"] = {"status": "unhealthy", "message": str(e)}
    
    try:
        response = httpx.get("http://localhost:8000/health", timeout=5.0)
        if response.status_code == 200:
            results["api"] = {"status": "healthy", "message": "Responding"}
        else:
            results["api"] = {"status": "unhealthy", "message": f"Status {response.status_code}"}
    except Exception as e:
        results["api"] = {"status": "unknown", "message": f"Not reachable: {e}"}
    
    all_healthy = all(r["status"] == "healthy" for r in results.values())
    
    if json:
        output_data({"services": results, "overall": "healthy" if all_healthy else "unhealthy"}, json)
    else:
        table = create_table("Service Health", ["Service", "Status", "Message"])
        for service, data in results.items():
            status_icon = "[green]OK[/green]" if data["status"] == "healthy" else "[red]ERR[/red]" if data["status"] == "unhealthy" else "[yellow]?[/yellow]"
            table.add_row(service.title(), f"{status_icon} {data['status']}", data["message"])
        output_data(None, False, table)
        
        if all_healthy:
            console.print("\n[green]All services healthy[/green]")
        else:
            console.print("\n[red]Some services are unhealthy[/red]")


@app.command("stats")
def show_stats(
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Show system statistics."""
    session = get_db_session()
    try:
        user_count = len(session.execute(select(User)).scalars().all())
        admin_count = len(session.execute(select(User).where(User.is_admin == True)).scalars().all())
        space_count = len(session.execute(select(Space)).scalars().all())
        card_count = len(session.execute(select(Card)).scalars().all())
        
        stats = {
            "users": {
                "total": user_count,
                "admins": admin_count,
            },
            "spaces": space_count,
            "cards": card_count,
        }
        
        if json:
            output_data(stats, json)
        else:
            console.print("[bold]System Statistics[/bold]")
            console.print(f"  Users: {user_count} (admins: {admin_count})")
            console.print(f"  Spaces: {space_count}")
            console.print(f"  Cards: {card_count}")
    
    except Exception as e:
        output_error(str(e), json, "STATS_ERROR")
    finally:
        session.close()


@app.command("version")
def show_version(
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Show version information."""
    data = {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "api_prefix": settings.API_V1_STR,
    }
    
    if json:
        output_data(data, json)
    else:
        console.print(f"[bold]{settings.PROJECT_NAME}[/bold] v{settings.VERSION}")
        console.print(f"Environment: {settings.ENVIRONMENT}")
        console.print(f"API: {settings.API_V1_STR}")


@app.command("config")
def show_config(
    show_secrets: bool = typer.Option(False, help="Show secret values"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Show current configuration."""
    config = {
        "PROJECT_NAME": settings.PROJECT_NAME,
        "VERSION": settings.VERSION,
        "ENVIRONMENT": settings.ENVIRONMENT,
        "API_V1_STR": settings.API_V1_STR,
        "DATABASE_URL": settings.DATABASE_URL if show_secrets else "***hidden***",
        "REDIS_URL": settings.REDIS_URL if show_secrets else "***hidden***",
        "SECRET_KEY": settings.SECRET_KEY[:8] + "..." if show_secrets else "***hidden***",
        "CORS_ORIGINS": settings.CORS_ORIGINS,
        "ACCESS_TOKEN_EXPIRE_MINUTES": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "MAX_LOGIN_ATTEMPTS": settings.MAX_LOGIN_ATTEMPTS,
        "LOGIN_LOCKOUT_MINUTES": settings.LOGIN_LOCKOUT_MINUTES,
        "ADMIN_EMAIL": settings.ADMIN_EMAIL or "Not set",
    }
    
    if json:
        output_data(config, json)
    else:
        console.print("[bold]Current Configuration[/bold]")
        for key, value in config.items():
            console.print(f"  {key}: {value}")
        
        if not show_secrets:
            console.print("\n[dim]Use --show-secrets to reveal hidden values[/dim]")
