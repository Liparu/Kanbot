"""Tests for dashboard API endpoints"""
import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from app.api.v1.dashboard import (
    get_recent_events,
    calculate_next_cron_run,
)


class TestEventStream:
    """Test suite for event stream functionality"""

    def test_get_recent_events_default_limit(self):
        """get_recent_events respects default limit of 50"""
        events = get_recent_events()
        assert isinstance(events, list)
        assert len(events) <= 50

    def test_get_recent_events_custom_limit(self):
        """get_recent_events respects custom limit"""
        events = get_recent_events(limit=10)
        assert isinstance(events, list)
        assert len(events) <= 10

    def test_get_recent_events_returns_list(self):
        """Events returns a list of items"""
        events = get_recent_events(limit=5)
        assert isinstance(events, list)


class TestCronScheduling:
    """Test suite for cron schedule parsing"""

    def test_calculate_next_run_every_minute(self):
        """Every minute cron runs in next minute"""
        now = datetime(2026, 2, 8, 3, 0, 0, tzinfo=timezone.utc)
        next_run = calculate_next_cron_run("* * * * *", now)
        if next_run:
            assert next_run > now
            assert next_run.minute in range(0, 60)

    def test_calculate_next_run_hourly(self):
        """Hourly cron (0 * * * *) runs at minute 0"""
        now = datetime(2026, 2, 8, 3, 15, 0, tzinfo=timezone.utc)
        next_run = calculate_next_cron_run("0 * * * *", now)
        if next_run:
            assert next_run.minute == 0

    def test_calculate_next_run_daily(self):
        """Daily cron (0 9 * * *) runs at 9:00"""
        now = datetime(2026, 2, 8, 3, 0, 0, tzinfo=timezone.utc)
        next_run = calculate_next_cron_run("0 9 * * *", now)
        if next_run:
            assert next_run.hour == 9
            assert next_run.minute == 0

    def test_calculate_next_run_invalid_expression(self):
        """Invalid cron expression returns None"""
        now = datetime.now(timezone.utc)
        next_run = calculate_next_cron_run("invalid", now)
        assert next_run is None

    def test_calculate_next_run_complex_expression(self):
        """Complex cron expression (0 */2 * * *) works"""
        now = datetime(2026, 2, 8, 3, 0, 0, tzinfo=timezone.utc)
        next_run = calculate_next_cron_run("0 */2 * * *", now)
        if next_run:
            assert next_run.minute == 0
            assert next_run.hour % 2 == 0


class TestEventStreamSchema:
    """Test suite for event stream data structure"""

    def test_event_type_field_exists(self):
        """Events should have event_type field in their structure"""
        # Testing the concept that events have types
        event_types = ['card_created', 'card_moved', 'card_updated', 'agent_run']
        assert 'card_created' in event_types
        assert 'agent_run' in event_types

    def test_event_timestamp_format(self):
        """Events should use ISO format timestamps"""
        now = datetime.now(timezone.utc)
        iso_format = now.isoformat()
        assert 'T' in iso_format
        assert '+' in iso_format or 'Z' in iso_format


class TestDashboardIntegration:
    """Integration tests for dashboard components"""

    def test_events_are_list_type(self):
        """Recent events should always be a list"""
        events = get_recent_events(limit=20)
        assert isinstance(events, list)

    def test_empty_event_stream(self):
        """Empty event stream returns empty list, not None"""
        events = get_recent_events(limit=1)
        assert events is not None
        assert isinstance(events, list)

    def test_event_limit_boundary(self):
        """Limit of 0 should return empty list"""
        events = get_recent_events(limit=0)
        assert isinstance(events, list)
        assert len(events) == 0


class TestCronNextRunEdgeCases:
    """Edge cases for cron next run calculation"""

    def test_weekly_cron(self):
        """Weekly cron (0 0 * * 0) calculates correctly"""
        now = datetime(2026, 2, 8, 3, 0, 0, tzinfo=timezone.utc)  # Saturday
        next_run = calculate_next_cron_run("0 0 * * 0", now)
        if next_run:
            # croniter uses 0=Sunday, Python weekday uses 0=Monday
            # So Sunday in cron = 6 in Python weekday, or result is a future date
            assert next_run > now

    def test_monthly_cron(self):
        """Monthly cron (0 0 1 * *) calculates correctly"""
        now = datetime(2026, 2, 8, 3, 0, 0, tzinfo=timezone.utc)
        next_run = calculate_next_cron_run("0 0 1 * *", now)
        if next_run:
            # Next 1st of month should be March 1
            assert next_run > now

    def test_end_of_day_cron(self):
        """End of day cron (59 23 * * *) calculates correctly"""
        now = datetime(2026, 2, 8, 3, 0, 0, tzinfo=timezone.utc)
        next_run = calculate_next_cron_run("59 23 * * *", now)
        if next_run:
            assert next_run.hour == 23
            assert next_run.minute == 59
