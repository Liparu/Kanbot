import json
import sys
from typing import Any, Optional
from rich.console import Console
from rich.table import Table

console = Console()
error_console = Console(stderr=True)


def output_json(data: Any, success: bool = True, message: Optional[str] = None, error: Optional[str] = None, code: Optional[str] = None):
    result = {"success": success}
    
    if success:
        result["data"] = data
        if message:
            result["message"] = message
    else:
        result["error"] = error or "Unknown error"
        if code:
            result["code"] = code
    
    print(json.dumps(result, indent=2, default=str))


def output_success(message: str, json_mode: bool = False, data: Any = None):
    if json_mode:
        output_json(data, success=True, message=message)
    else:
        console.print(f"[green]✓[/green] {message}")


def output_error(message: str, json_mode: bool = False, code: Optional[str] = None):
    if json_mode:
        output_json(None, success=False, error=message, code=code)
    else:
        error_console.print(f"[red]✗[/red] {message}")
    sys.exit(1)


def output_warning(message: str):
    console.print(f"[yellow]![/yellow] {message}")


def output_info(message: str):
    console.print(f"[blue]ℹ[/blue] {message}")


def create_table(title: str, columns: list[str]) -> Table:
    table = Table(title=title, show_header=True, header_style="bold magenta")
    for col in columns:
        table.add_column(col)
    return table


def output_table(table: Table):
    console.print(table)


def output_data(data: Any, json_mode: bool = False, table: Optional[Table] = None):
    if json_mode:
        output_json(data, success=True)
    elif table:
        output_table(table)
    else:
        console.print(data)
