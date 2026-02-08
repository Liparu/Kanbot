"""Tests for duplicate detection functionality"""
import pytest
from app.services.duplicates import calculate_similarity, format_duplicate_warning


class TestCalculateSimilarity:
    """Test suite for similarity calculation"""

    def test_identical_strings(self):
        """Identical strings have 1.0 similarity"""
        assert calculate_similarity("hello", "hello") == 1.0

    def test_completely_different(self):
        """Completely different strings have low similarity"""
        score = calculate_similarity("abc", "xyz")
        assert score < 0.3

    def test_similar_strings(self):
        """Similar strings have high similarity"""
        score = calculate_similarity("Fix bug in login", "Fix bug in logging")
        assert score > 0.8

    def test_case_insensitive(self):
        """Comparison is case insensitive"""
        assert calculate_similarity("Hello World", "hello world") == 1.0

    def test_whitespace_handling(self):
        """Leading/trailing whitespace is ignored"""
        assert calculate_similarity("  hello  ", "hello") == 1.0

    def test_empty_string(self):
        """Empty strings return 0.0"""
        assert calculate_similarity("", "hello") == 0.0
        assert calculate_similarity("hello", "") == 0.0
        assert calculate_similarity("", "") == 0.0

    def test_none_handling(self):
        """None values return 0.0"""
        assert calculate_similarity(None, "hello") == 0.0
        assert calculate_similarity("hello", None) == 0.0

    def test_partial_match(self):
        """Partial matches have moderate similarity"""
        score = calculate_similarity("Create user interface", "Create API interface")
        assert 0.5 < score < 0.9

    def test_word_order_matters(self):
        """Word order affects similarity"""
        score1 = calculate_similarity("deploy server", "server deploy")
        score2 = calculate_similarity("deploy server", "deploy server")
        assert score2 > score1


class TestFormatDuplicateWarning:
    """Test suite for duplicate warning formatting"""

    def test_empty_list(self):
        """Empty list returns empty string"""
        assert format_duplicate_warning([]) == ""

    def test_single_duplicate(self):
        """Single duplicate formats correctly"""
        # Create a mock card-like object
        class MockCard:
            name = "Test Card"
        
        result = format_duplicate_warning([(MockCard(), 0.85)])
        assert "⚠️ Potential duplicates found:" in result
        assert "Test Card" in result
        assert "85%" in result

    def test_multiple_duplicates(self):
        """Multiple duplicates format correctly"""
        class MockCard1:
            name = "Card One"
        
        class MockCard2:
            name = "Card Two"
        
        result = format_duplicate_warning([
            (MockCard1(), 0.90),
            (MockCard2(), 0.75),
        ])
        assert "Card One" in result
        assert "Card Two" in result
        assert "90%" in result
        assert "75%" in result


class TestSimilarityThresholds:
    """Test suite for similarity threshold logic"""

    def test_high_threshold(self):
        """High threshold only catches very similar strings"""
        score = calculate_similarity("Deploy to production", "Deploy to staging")
        # These are somewhat similar but not identical
        assert score < 0.9  # Would be filtered by 0.9 threshold

    def test_low_threshold(self):
        """Low threshold catches more diverse matches"""
        score = calculate_similarity("Fix login bug", "Login issue fix")
        assert score > 0.3  # Would pass 0.3 threshold

    def test_exact_duplicate(self):
        """Exact duplicates always pass any threshold"""
        score = calculate_similarity("Same title", "Same title")
        assert score == 1.0
