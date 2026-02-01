import typer
import subprocess
import os
from typing import Optional
from datetime import datetime

from app.cli.utils.output import output_success, output_error, output_info, output_data, console
from app.core.config import settings

app = typer.Typer(no_args_is_help=True)


@app.command("migrate")
def migrate(
    revision: str = typer.Option("head", help="Target revision (default: head)"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Run database migrations."""
    try:
        output_info(f"Running migrations to revision: {revision}")
        
        result = subprocess.run(
            ["alembic", "upgrade", revision],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        )
        
        if result.returncode != 0:
            output_error(f"Migration failed: {result.stderr}", json, "MIGRATION_FAILED")
            return
        
        output_success("Migrations completed successfully", json, {"revision": revision, "output": result.stdout})
        
        if not json and result.stdout:
            console.print(result.stdout)
    
    except Exception as e:
        output_error(str(e), json, "MIGRATION_ERROR")


@app.command("downgrade")
def downgrade(
    revision: str = typer.Option(..., help="Target revision to downgrade to"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Downgrade database migrations."""
    try:
        output_info(f"Downgrading to revision: {revision}")
        
        result = subprocess.run(
            ["alembic", "downgrade", revision],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        )
        
        if result.returncode != 0:
            output_error(f"Downgrade failed: {result.stderr}", json, "DOWNGRADE_FAILED")
            return
        
        output_success("Downgrade completed successfully", json, {"revision": revision})
        
        if not json and result.stdout:
            console.print(result.stdout)
    
    except Exception as e:
        output_error(str(e), json, "DOWNGRADE_ERROR")


@app.command("revision")
def show_revision(
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Show current database revision."""
    try:
        result = subprocess.run(
            ["alembic", "current"],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        )
        
        if result.returncode != 0:
            output_error(f"Failed to get revision: {result.stderr}", json, "REVISION_ERROR")
            return
        
        output = result.stdout.strip()
        
        if json:
            output_data({"current": output}, json)
        else:
            console.print(f"[bold]Current revision:[/bold] {output or 'None'}")
    
    except Exception as e:
        output_error(str(e), json, "REVISION_ERROR")


@app.command("history")
def history(
    limit: int = typer.Option(10, help="Number of revisions to show"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Show migration history."""
    try:
        result = subprocess.run(
            ["alembic", "history", f"-r-{limit}:"],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        )
        
        if result.returncode != 0:
            output_error(f"Failed to get history: {result.stderr}", json, "HISTORY_ERROR")
            return
        
        if json:
            output_data({"history": result.stdout}, json)
        else:
            console.print("[bold]Migration History:[/bold]")
            console.print(result.stdout or "No migrations")
    
    except Exception as e:
        output_error(str(e), json, "HISTORY_ERROR")


@app.command("backup")
def backup(
    output_path: Optional[str] = typer.Option(None, help="Output file path"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Create a database backup (pg_dump)."""
    try:
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"kanbot_backup_{timestamp}.sql"
        
        db_url = settings.DATABASE_URL.replace("+asyncpg", "").replace("+psycopg2", "")
        
        result = subprocess.run(
            ["pg_dump", db_url, "-f", output_path],
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0:
            output_error(f"Backup failed: {result.stderr}", json, "BACKUP_FAILED")
            return
        
        output_success(f"Backup created: {output_path}", json, {"path": output_path})
    
    except FileNotFoundError:
        output_error("pg_dump not found. Ensure PostgreSQL client tools are installed.", json, "PG_DUMP_NOT_FOUND")
    except Exception as e:
        output_error(str(e), json, "BACKUP_ERROR")


@app.command("seed")
def seed(
    admin_only: bool = typer.Option(False, help="Only create admin user"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Seed default data (admin user)."""
    from sqlalchemy import select
    from app.cli.utils.db import get_db_session
    from app.models.user import User
    from app.core.security import get_password_hash
    
    session = get_db_session()
    try:
        admin_email = settings.ADMIN_EMAIL
        admin_password = settings.ADMIN_PASSWORD
        
        if not admin_email or not admin_password:
            output_error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment", json, "MISSING_CONFIG")
            return
        
        existing = session.execute(select(User).where(User.email == admin_email)).scalar_one_or_none()
        
        if existing:
            output_info(f"Admin user already exists: {admin_email}")
            return
        
        admin = User(
            email=admin_email,
            username="admin",
            password_hash=get_password_hash(admin_password),
            is_admin=True,
        )
        session.add(admin)
        session.commit()
        
        output_success(f"Admin user created: {admin_email}", json, {"email": admin_email})
    
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "SEED_ERROR")
    finally:
        session.close()
