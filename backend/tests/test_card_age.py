"""Tests for card age computation"""
import pytest
from datetime import datetime, timedelta, timezone
from app.services.card_age import compute_card_age_days


class TestCardAgeComputation:
    """Test suite for card age computation logic"""

    def test_card_less_than_one_day_old(self):
        """Card entered column 12 hours ago should return 0 days"""
        now = datetime.now(timezone.utc)
        column_entered_at = now - timedelta(hours=12)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 0

    def test_card_exactly_one_day_old(self):
        """Card entered column exactly 24 hours ago should return 1 day"""
        now = datetime.now(timezone.utc)
        column_entered_at = now - timedelta(days=1)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 1

    def test_card_two_days_old(self):
        """Card entered column 2 days ago should return 2 days"""
        now = datetime.now(timezone.utc)
        column_entered_at = now - timedelta(days=2)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 2

    def test_card_three_days_old(self):
        """Card entered column 3 days ago should return 3 days"""
        now = datetime.now(timezone.utc)
        column_entered_at = now - timedelta(days=3)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 3

    def test_card_seven_days_old(self):
        """Card entered column 7 days ago should return 7 days"""
        now = datetime.now(timezone.utc)
        column_entered_at = now - timedelta(days=7)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 7

    def test_card_ten_days_old(self):
        """Card entered column 10 days ago should return 10 days"""
        now = datetime.now(timezone.utc)
        column_entered_at = now - timedelta(days=10)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 10

    def test_card_with_fractional_days(self):
        """Card entered 1.5 days ago should return 1 day (floor)"""
        now = datetime.now(timezone.utc)
        column_entered_at = now - timedelta(days=1, hours=12)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 1

    def test_card_entered_in_future_returns_zero(self):
        """Card with future column_entered_at should return 0"""
        now = datetime.now(timezone.utc)
        column_entered_at = now + timedelta(days=1)
        age_days = compute_card_age_days(column_entered_at, now)
        assert age_days == 0

    def test_none_column_entered_at_returns_none(self):
        """Card without column_entered_at should return None"""
        now = datetime.now(timezone.utc)
        age_days = compute_card_age_days(None, now)
        assert age_days is None
