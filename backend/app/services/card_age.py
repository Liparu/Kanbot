"""Service for computing card age in current column"""
from datetime import datetime, timezone
from typing import Optional


def compute_card_age_days(
    column_entered_at: Optional[datetime],
    current_time: Optional[datetime] = None
) -> Optional[int]:
    """
    Compute the number of days a card has been in its current column.

    Args:
        column_entered_at: When the card entered the current column
        current_time: Current time for testing (defaults to now)

    Returns:
        Number of days (floor) or None if column_entered_at is None
    """
    if column_entered_at is None:
        return None

    if current_time is None:
        current_time = datetime.now(timezone.utc)

    # Ensure both datetimes are timezone-aware
    if column_entered_at.tzinfo is None:
        column_entered_at = column_entered_at.replace(tzinfo=timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    # Compute difference
    delta = current_time - column_entered_at

    # Return days (floor), minimum 0
    return max(0, int(delta.total_seconds() // 86400))
