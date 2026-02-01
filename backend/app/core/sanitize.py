import bleach
import re
from typing import Optional


ALLOWED_TAGS = []
ALLOWED_ATTRIBUTES = {}


def sanitize_text(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    cleaned = bleach.clean(text, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)
    return cleaned


def sanitize_search_term(term: str) -> str:
    sanitized = re.sub(r'[%_\\]', lambda m: '\\' + m.group(0), term)
    return sanitized


def escape_like_pattern(pattern: str) -> str:
    return pattern.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
