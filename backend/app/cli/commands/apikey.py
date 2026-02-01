import typer
import secrets
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from rich.table import Table

from app.cli.utils.output import output_success, output_error, output_data, create_table, console
from app.cli.utils.db import get_db_session
from app.models.user import User, APIKey

app = typer.Typer(no_args_is_help=True)


def find_user(session, identifier: str) -> Optional[User]:
    from sqlalchemy import or_
    try:
        user_id = UUID(identifier)
        result = session.execute(select(User).where(User.id == user_id))
    except ValueError:
        result = session.execute(
            select(User).where(or_(User.email == identifier, User.username == identifier))
        )
    return result.scalar_one_or_none()


@app.command("create")
def create_api_key(
    user: str = typer.Option(..., help="User ID, email, or username"),
    name: str = typer.Option(..., help="API key name/description"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Create a new API key for a user."""
    session = get_db_session()
    try:
        user_obj = find_user(session, user)
        
        if not user_obj:
            output_error(f"User not found: {user}", json, "USER_NOT_FOUND")
            return
        
        key_value = f"kb_{secrets.token_urlsafe(32)}"
        
        api_key = APIKey(
            user_id=user_obj.id,
            name=name,
            key=key_value,
            is_agent=True,
        )
        session.add(api_key)
        session.commit()
        session.refresh(api_key)
        
        data = {
            "id": str(api_key.id),
            "name": api_key.name,
            "key": key_value,
            "user_email": user_obj.email,
            "created_at": api_key.created_at.isoformat(),
        }
        
        output_success("API key created successfully", json, data)
        
        if not json:
            console.print(f"\n[yellow]API Key:[/yellow] {key_value}")
            console.print("[dim]Save this key - it won't be shown again![/dim]")
    
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "CREATE_FAILED")
    finally:
        session.close()


@app.command("list")
def list_api_keys(
    user: Optional[str] = typer.Option(None, help="Filter by user ID, email, or username"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """List API keys."""
    session = get_db_session()
    try:
        query = select(APIKey)
        
        if user:
            user_obj = find_user(session, user)
            if not user_obj:
                output_error(f"User not found: {user}", json, "USER_NOT_FOUND")
                return
            query = query.where(APIKey.user_id == user_obj.id)
        
        result = session.execute(query)
        keys = result.scalars().all()
        
        data = {
            "api_keys": [
                {
                    "id": str(k.id),
                    "name": k.name,
                    "key_prefix": k.key[:12] + "..." if k.key else "***",
                    "user_id": str(k.user_id),
                    "is_active": k.is_active,
                    "is_agent": k.is_agent,
                    "created_at": k.created_at.isoformat(),
                }
                for k in keys
            ],
            "total": len(keys),
        }
        
        if json:
            output_data(data, json)
        else:
            table = create_table("API Keys", ["ID", "Name", "Key Prefix", "Active", "Agent"])
            for k in keys:
                table.add_row(
                    str(k.id)[:8] + "...",
                    k.name,
                    k.key[:12] + "..." if k.key else "***",
                    "Y" if k.is_active else "N",
                    "Y" if k.is_agent else "N",
                )
            output_data(None, False, table)
            console.print(f"\n[dim]{len(keys)} key(s) found[/dim]")
    
    except Exception as e:
        output_error(str(e), json, "LIST_FAILED")
    finally:
        session.close()


@app.command("revoke")
def revoke_api_key(
    key_id: str = typer.Argument(..., help="API key ID"),
    force: bool = typer.Option(False, help="Skip confirmation"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Revoke an API key."""
    session = get_db_session()
    try:
        try:
            key_uuid = UUID(key_id)
        except ValueError:
            output_error("Invalid key ID format", json, "INVALID_ID")
            return
        
        result = session.execute(select(APIKey).where(APIKey.id == key_uuid))
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            output_error(f"API key not found: {key_id}", json, "KEY_NOT_FOUND")
            return
        
        if not force and not json:
            confirm = typer.confirm(f"Are you sure you want to revoke key '{api_key.name}'?")
            if not confirm:
                raise typer.Abort()
        
        api_key.is_active = False
        session.commit()
        
        output_success(f"API key '{api_key.name}' has been revoked", json, {"id": str(api_key.id), "name": api_key.name})
    
    except typer.Abort:
        console.print("[yellow]Cancelled[/yellow]")
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "REVOKE_FAILED")
    finally:
        session.close()
