import typer
from rich.console import Console

from app.cli.commands import user, apikey, db, system, space
from app.core.config import settings

app = typer.Typer(
    name="kanbot",
    help="Kanbot CLI - Management tool for Kanbot application",
    no_args_is_help=True,
)

app.add_typer(user.app, name="user", help="User management commands")
app.add_typer(apikey.app, name="apikey", help="API key management commands")
app.add_typer(db.app, name="db", help="Database management commands")
app.add_typer(system.app, name="system", help="System utilities")
app.add_typer(space.app, name="space", help="Space management commands")


@app.callback()
def callback():
    pass


@app.command()
def version():
    """Show Kanbot version information."""
    console = Console()
    console.print(f"[bold]Kanbot[/bold] v{settings.VERSION}")
    console.print(f"Environment: {settings.ENVIRONMENT}")


if __name__ == "__main__":
    app()
