"""Card templates API - pre-filled card templates for common types."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

router = APIRouter()

# Predefined templates - can be extended or moved to database later
CARD_TEMPLATES = [
    {
        "id": "meeting",
        "name": "📅 Meeting",
        "icon": "📅",
        "fields": {
            "name": "",
            "description": "## Agenda\n- \n\n## Attendees\n- \n\n## Notes\n\n## Action Items\n- [ ] ",
            "tag_names": ["meeting"],
        }
    },
    {
        "id": "bug",
        "name": "🐛 Bug Report",
        "icon": "🐛",
        "fields": {
            "name": "Bug: ",
            "description": "## Description\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Actual Behavior\n\n## Environment\n- Browser:\n- OS:\n\n## Screenshots\n",
            "tag_names": ["bug"],
        }
    },
    {
        "id": "feature",
        "name": "✨ Feature Request",
        "icon": "✨",
        "fields": {
            "name": "Feature: ",
            "description": "## Problem Statement\nAs a [user], I want [goal] so that [benefit].\n\n## Proposed Solution\n\n## Alternatives Considered\n\n## Acceptance Criteria\n- [ ] \n- [ ] \n",
            "tag_names": ["feature"],
        }
    },
    {
        "id": "task",
        "name": "✅ Task",
        "icon": "✅",
        "fields": {
            "name": "",
            "description": "## Description\n\n## Checklist\n- [ ] \n- [ ] \n\n## Notes\n",
            "tag_names": ["task"],
        }
    },
    {
        "id": "research",
        "name": "🔬 Research",
        "icon": "🔬",
        "fields": {
            "name": "Research: ",
            "description": "## Objective\n\n## Questions to Answer\n1. \n2. \n\n## Resources\n- \n\n## Findings\n\n## Conclusions\n",
            "tag_names": ["research"],
        }
    },
    {
        "id": "review",
        "name": "👀 Review",
        "icon": "👀",
        "fields": {
            "name": "Review: ",
            "description": "## Item to Review\n\n## Review Criteria\n- [ ] \n- [ ] \n\n## Feedback\n\n## Decision\n",
            "tag_names": ["review"],
        }
    },
]


class CardTemplate(BaseModel):
    id: str
    name: str
    icon: str
    fields: dict


@router.get("/", response_model=List[CardTemplate])
async def list_templates():
    """List all available card templates."""
    return CARD_TEMPLATES


@router.get("/{template_id}", response_model=CardTemplate)
async def get_template(template_id: str):
    """Get a specific card template by ID."""
    for template in CARD_TEMPLATES:
        if template["id"] == template_id:
            return template
    raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
