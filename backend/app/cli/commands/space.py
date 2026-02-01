import typer
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.cli.utils.output import output_success, output_error, output_data, create_table, console
from app.cli.utils.db import get_db_session
from app.models.space import Space, SpaceMember, SpaceType
from app.models.user import User

app = typer.Typer(no_args_is_help=True)


@app.command("list")
def list_spaces(
    owner: Optional[str] = typer.Option(None, help="Filter by owner email"),
    space_type: Optional[str] = typer.Option(None, help="Filter by type (personal/company/agent)"),
    page: int = typer.Option(1, help="Page number"),
    limit: int = typer.Option(20, help="Results per page"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """List all spaces."""
    session = get_db_session()
    try:
        query = select(Space).options(selectinload(Space.owner), selectinload(Space.members))
        
        owner_user = None
        if owner:
            owner_result = session.execute(select(User).where(User.email == owner))
            owner_user = owner_result.scalar_one_or_none()
            if not owner_user:
                output_error(f"Owner not found: {owner}", json, "OWNER_NOT_FOUND")
                return
            query = query.where(Space.owner_id == owner_user.id)
        
        if space_type:
            try:
                stype = SpaceType(space_type.lower())
                query = query.where(Space.type == stype)
            except ValueError:
                output_error(f"Invalid space type: {space_type}. Must be personal/company/agent", json, "INVALID_TYPE")
                return
        
        offset = (page - 1) * limit
        query = query.order_by(Space.created_at.desc()).offset(offset).limit(limit)
        
        result = session.execute(query)
        spaces = result.scalars().all()
        
        total_query = select(Space)
        if owner and owner_user:
            total_query = total_query.where(Space.owner_id == owner_user.id)
        if space_type:
            total_query = total_query.where(Space.type == SpaceType(space_type.lower()))
        total_count = len(session.execute(total_query).scalars().all())
        
        data = {
            "spaces": [
                {
                    "id": str(s.id),
                    "name": s.name,
                    "type": s.type.value if s.type else "personal",
                    "owner_email": s.owner.email if s.owner else "N/A",
                    "member_count": len(s.members),
                    "created_at": s.created_at.isoformat(),
                }
                for s in spaces
            ],
            "page": page,
            "limit": limit,
            "total": total_count,
        }
        
        if json:
            output_data(data, json)
        else:
            table = create_table("Spaces", ["ID", "Name", "Type", "Owner", "Members", "Created"])
            for s in spaces:
                table.add_row(
                    str(s.id)[:8] + "...",
                    s.name[:30] + "..." if len(s.name) > 30 else s.name,
                    s.type.value if s.type else "personal",
                    s.owner.email if s.owner else "N/A",
                    str(len(s.members)),
                    s.created_at.strftime("%Y-%m-%d"),
                )
            output_data(None, False, table)
            console.print(f"\n[dim]Page {page} of {(total_count + limit - 1) // limit} ({total_count} total)[/dim]")
    
    except Exception as e:
        output_error(str(e), json, "LIST_FAILED")
    finally:
        session.close()


@app.command("get")
def get_space(
    space_id: str = typer.Argument(..., help="Space ID"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Get space details."""
    session = get_db_session()
    try:
        try:
            uuid_id = UUID(space_id)
        except ValueError:
            output_error(f"Invalid space ID: {space_id}", json, "INVALID_ID")
            return
        
        result = session.execute(
            select(Space)
            .where(Space.id == uuid_id)
            .options(selectinload(Space.owner), selectinload(Space.members).selectinload(SpaceMember.user))
        )
        space = result.scalar_one_or_none()
        
        if not space:
            output_error(f"Space not found: {space_id}", json, "SPACE_NOT_FOUND")
            return
        
        data = {
            "id": str(space.id),
            "name": space.name,
            "type": space.type.value if space.type else "personal",
            "owner": {
                "id": str(space.owner.id) if space.owner else None,
                "email": space.owner.email if space.owner else None,
            },
            "members": [
                {
                    "user_id": str(m.user_id),
                    "email": m.user.email if m.user else "Unknown",
                    "role": m.role.value if m.role else "member",
                }
                for m in space.members
            ],
            "calendar_public": space.calendar_public,
            "created_at": space.created_at.isoformat(),
        }
        
        if json:
            output_data(data, json)
        else:
            console.print(f"[bold]Space Details[/bold]")
            console.print(f"  ID: {data['id']}")
            console.print(f"  Name: {data['name']}")
            console.print(f"  Type: {data['type']}")
            console.print(f"  Owner: {data['owner']['email']}")
            console.print(f"  Calendar Public: {data['calendar_public']}")
            console.print(f"  Created: {data['created_at']}")
            console.print(f"\n[bold]Members ({len(data['members'])}):[/bold]")
            for m in data['members']:
                console.print(f"    - {m['email']} ({m['role']})")
    
    except Exception as e:
        output_error(str(e), json, "GET_FAILED")
    finally:
        session.close()


@app.command("delete")
def delete_space(
    space_id: str = typer.Argument(..., help="Space ID"),
    force: bool = typer.Option(False, help="Skip confirmation"),
    json: bool = typer.Option(False, help="Output as JSON"),
):
    """Delete a space and all its contents."""
    session = get_db_session()
    try:
        try:
            uuid_id = UUID(space_id)
        except ValueError:
            output_error(f"Invalid space ID: {space_id}", json, "INVALID_ID")
            return
        
        result = session.execute(select(Space).where(Space.id == uuid_id))
        space = result.scalar_one_or_none()
        
        if not space:
            output_error(f"Space not found: {space_id}", json, "SPACE_NOT_FOUND")
            return
        
        if not force and not json:
            console.print(f"[yellow]Warning:[/yellow] This will delete space '{space.name}' and ALL its contents!")
            confirm = typer.confirm("Are you sure you want to proceed?")
            if not confirm:
                raise typer.Abort()
        
        space_name = space.name
        session.delete(space)
        session.commit()
        
        output_success(f"Space '{space_name}' deleted", json, {"id": space_id, "name": space_name})
    
    except typer.Abort:
        console.print("[yellow]Cancelled[/yellow]")
    except Exception as e:
        session.rollback()
        output_error(str(e), json, "DELETE_FAILED")
    finally:
        session.close()
