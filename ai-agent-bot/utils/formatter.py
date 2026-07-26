from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.table import Table

console = Console()


def format_code(code: str, language: str = "python") -> str:
    syntax = Syntax(code, language, theme="monokai", line_numbers=True)
    panel = Panel(syntax, border_style="blue")
    with console.capture() as capture:
        console.print(panel)
    return capture.get()


def format_table(data: list[dict], headers: list[str]) -> str:
    table = Table(show_header=True, header_style="bold magenta")
    for header in headers:
        table.add_column(header)
    for row in data:
        table.add_row(*[str(row.get(h, "")) for h in headers])
    with console.capture() as capture:
        console.print(table)
    return capture.get()


def format_agent_response(agent: str, content: str) -> str:
    return f"[bold cyan]{agent}:[/bold cyan]\n{content}"
