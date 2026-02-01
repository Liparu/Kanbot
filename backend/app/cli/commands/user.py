import typer
import secrets
import string
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, or_
from rich.table import Table

from app.cli.utils.output import output_success, output_error, output_data, create_table, console
from app.cli.utils.db import get_db_session
from app.core.security import get_password_hash
from app.models.user import User

app = typer.Typer(no_args_is_help=True)


def generate_password(length: int = 16) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%^&*()"
    while True:
        password = ''.join(secrets.choice(chars) for _ in range(length))
        if (any(c.isupper() for c in password) and
            any(c.islower() for c in password) and
            any(c.isdigit() for c in password) and
            any(c in "!@#$%^&*()" for c in password)):
            return password


def find_user(session, identifier: str) -> Optional[User]:
    try:
        user_id = UUID(identifier)
        result = session.execute(select(User).where(User.id == user_id))
    except ValueError:
        result = session.execute(
            select(User).where(or_(User.email == identifier, User.username == identifier))
        )
    return result.scalar_one_or_none()


@app.command("create")
def create_user(
    email: str = typer.Option(..., help="User email address"),
    username: str = typer.Option(..., help="Username"),
    password: Optional[str] = typer.Option(None, help="Password (generated if not provided)"),
    admin: bool = typer.Option(False, help="Create as admin user"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Create a new user account."""
    session = get_db_session()
    try:
        existing = session.execute(
            select(User).where(or_(User.email == email, User.username == username))
        ).scalar_one_or_none()
        
        if existing:
            if existing.email == email:
                output_error("Email already registered", json, "EMAIL_EXISTS")
            else:
                output_error("Username already taken", json, "USERNAME_EXISTS")
        
        generated_password = None
        if not password:
            generated_password = generate_password()
            password = generated_password
        
        user = User(
            email=email,
            username=username,
            password_hash=get_password_hash(password),
            is_admin=admin,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        
        data = {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat(),
        }
        
        if generated_password:
            data["generated_password"] = generated_password
        
        output_success(f"User '{username}' created successfully", json, data)
        
        if generated_password and not json:
            console.print(f"[yellow]Generated password:[/yellow] {generated_password}")
            console.print("[dim]Save this password - it won't be shown again![/dim]")
    
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "CREATE_FAILED")
    finally:
        session.close()


@app.command("list")
def list_users(
    page: int = typer.Option(1, help="Page number"),
    limit: int = typer.Option(20, help="Results per page"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """List all users."""
    session = get_db_session()
    try:
        offset = (page - 1) * limit
        result = session.execute(
            select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)
        )
        users = result.scalars().all()
        
        total = session.execute(select(User)).scalars().all()
        total_count = len(total)
        
        data = {
            "users": [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "username": u.username,
                    "is_admin": u.is_admin,
                    "is_active": u.is_active,
                    "is_banned": u.is_banned,
                    "created_at": u.created_at.isoformat(),
                }
                for u in users
            ],
            "page": page,
            "limit": limit,
            "total": total_count,
        }
        
        if json:
            output_data(data, json)
        else:
            table = create_table("Users", ["ID", "Email", "Username", "Admin", "Active", "Banned"])
            for u in users:
                table.add_row(
                    str(u.id)[:8] + "...",
                    u.email,
                    u.username,
                    "Y" if u.is_admin else "",
                    "Y" if u.is_active else "N",
                    "Y" if u.is_banned else "",
                )
            output_data(None, False, table)
            console.print(f"\n[dim]Page {page} of {(total_count + limit - 1) // limit} ({total_count} total)[/dim]")
    
    except Exception as e:
        output_error(str(e), json, "LIST_FAILED")
    finally:
        session.close()


@app.command("get")
def get_user(
    identifier: str = typer.Argument(..., help="User ID, email, or username"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Get user details."""
    session = get_db_session()
    try:
        user = find_user(session, identifier)
        
        if not user:
            output_error(f"User not found: {identifier}", json, "USER_NOT_FOUND")
            return
        
        data = {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "language": user.language,
            "is_admin": user.is_admin,
            "is_active": user.is_active,
            "is_banned": user.is_banned,
            "banned_at": user.banned_at.isoformat() if user.banned_at else None,
            "failed_login_count": user.failed_login_count,
            "locked_until": user.locked_until.isoformat() if user.locked_until else None,
            "created_at": user.created_at.isoformat(),
        }
        
        if json:
            output_data(data, json)
        else:
            console.print(f"[bold]User Details[/bold]")
            for key, value in data.items():
                if value is not None:
                    console.print(f"  {key}: {value}")
    
    except Exception as e:
        output_error(str(e), json, "GET_FAILED")
    finally:
        session.close()


@app.command("delete")
def delete_user(
    identifier: str = typer.Argument(..., help="User ID, email, or username"),
    force: bool = typer.Option(False, help="Skip confirmation"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Delete a user account."""
    session = get_db_session()
    try:
        user = find_user(session, identifier)
        
        if not user:
            output_error(f"User not found: {identifier}", json, "USER_NOT_FOUND")
            return
        
        if not force and not json:
            confirm = typer.confirm(f"Are you sure you want to delete user '{user.email}'?")
            if not confirm:
                raise typer.Abort()
        
        user_id = str(user.id)
        user_email = user.email
        session.delete(user)
        session.commit()
        
        output_success(f"User '{user_email}' deleted", json, {"id": user_id, "email": user_email})
    
    except typer.Abort:
        console.print("[yellow]Cancelled[/yellow]")
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "DELETE_FAILED")
    finally:
        session.close()


@app.command("reset-password")
def reset_password(
    identifier: str = typer.Argument(..., help="User ID, email, or username"),
    password: Optional[str] = typer.Option(None, help="New password (generated if not provided)"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Reset user password."""
    session = get_db_session()
    try:
        user = find_user(session, identifier)
        
        if not user:
            output_error(f"User not found: {identifier}", json, "USER_NOT_FOUND")
            return
        
        generated_password = None
        if not password:
            generated_password = generate_password()
            password = generated_password
        
        user.password_hash = get_password_hash(password)
        user.failed_login_count = 0
        user.locked_until = None
        session.commit()
        
        data = {"id": str(user.id), "email": user.email}
        if generated_password:
            data["generated_password"] = generated_password
        
        output_success(f"Password reset for '{user.email}'", json, data)
        
        if generated_password and not json:
            console.print(f"[yellow]New password:[/yellow] {generated_password}")
            console.print("[dim]Save this password - it won't be shown again![/dim]")
    
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "RESET_FAILED")
    finally:
        session.close()


@app.command("ban")
def ban_user(
    identifier: str = typer.Argument(..., help="User ID, email, or username"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Ban a user account."""
    session = get_db_session()
    try:
        user = find_user(session, identifier)
        
        if not user:
            output_error(f"User not found: {identifier}", json, "USER_NOT_FOUND")
            return
        
        user.is_banned = True
        user.banned_at = datetime.now(timezone.utc)
        session.commit()
        
        output_success(f"User '{user.email}' has been banned", json, {"id": str(user.id), "email": user.email})
    
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "BAN_FAILED")
    finally:
        session.close()


@app.command("unban")
def unban_user(
    identifier: str = typer.Argument(..., help="User ID, email, or username"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Unban a user account."""
    session = get_db_session()
    try:
        user = find_user(session, identifier)
        
        if not user:
            output_error(f"User not found: {identifier}", json, "USER_NOT_FOUND")
            return
        
        user.is_banned = False
        user.banned_at = None
        session.commit()
        
        output_success(f"User '{user.email}' has been unbanned", json, {"id": str(user.id), "email": user.email})
    
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "UNBAN_FAILED")
    finally:
        session.close()


@app.command("set-admin")
def set_admin(
    identifier: str = typer.Argument(..., help="User ID, email, or username"),
    revoke: bool = typer.Option(False, help="Revoke admin status"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Grant or revoke admin status."""
    session = get_db_session()
    try:
        user = find_user(session, identifier)
        
        if not user:
            output_error(f"User not found: {identifier}", json, "USER_NOT_FOUND")
            return
        
        user.is_admin = not revoke
        session.commit()
        
        action = "revoked from" if revoke else "granted to"
        output_success(f"Admin status {action} '{user.email}'", json, {"id": str(user.id), "email": user.email, "is_admin": user.is_admin})
    
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "SET_ADMIN_FAILED")
    finally:
        session.close()
