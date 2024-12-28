"""
Unit Test Suite for Template Management

Comprehensive test coverage for template management functionality including CRUD operations,
versioning, analytics, and performance metrics.

Version: 1.0.0
License: MIT
"""

import pytest
import asyncio
import fakeredis  # ^2.18.0
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

from ...src.services.template_manager import TemplateManager
from ...src.models.response import ResponseTemplate
from ...src.utils.ai_processor import AIProcessor
from ....shared.proto.response_pb2 import ResponseTone, TemplateCategory

# Test constants
TEST_TEMPLATE_CONTENT = """Dear {recipient},

Thank you for your {topic} inquiry. We will {action} as soon as possible.

Best regards,
{sender}"""

@pytest.fixture
async def redis_mock():
    """Fixture for mocked Redis client."""
    return fakeredis.FakeRedis()

@pytest.fixture
def ai_processor_mock():
    """Fixture for mocked AI processor."""
    mock = MagicMock(spec=AIProcessor)
    mock.calculate_confidence_score.return_value = {
        "aggregate_score": 0.85,
        "context_relevance": 0.9,
        "tone_consistency": 0.8,
        "response_coherence": 0.85
    }
    return mock

@pytest.fixture
async def template_manager(redis_mock, ai_processor_mock):
    """Fixture for template manager instance with mocked dependencies."""
    return TemplateManager(redis_mock, ai_processor_mock)

def setup_module():
    """Module level setup for test suite."""
    logging.basicConfig(level=logging.DEBUG)
    logging.info("Initializing template management test suite")

def teardown_module():
    """Module level cleanup."""
    logging.info("Cleaning up template management test suite")

class TestTemplateManager:
    """Comprehensive test suite for template management functionality."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(5)
    async def test_create_template(self, template_manager, redis_mock, ai_processor_mock):
        """Test template creation with validation and versioning."""
        # Prepare test data
        template_data = {
            "name": "Professional Inquiry Response",
            "content": TEST_TEMPLATE_CONTENT,
            "tone": ResponseTone.TONE_PROFESSIONAL,
            "category": TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
            "tags": ["inquiry", "professional", "standard"],
            "metadata": {
                "department": "sales",
                "priority": "normal"
            }
        }

        # Execute template creation
        template = await template_manager.create_template(**template_data)

        # Verify template creation
        assert template.template_id is not None
        assert template.version == 1
        assert template.tone == ResponseTone.TONE_PROFESSIONAL
        
        # Verify placeholders extraction
        assert set(template.placeholders) == {"recipient", "topic", "action", "sender"}
        
        # Verify Redis storage
        template_key = f"template:{template.template_id}"
        stored_data = await redis_mock.get(template_key)
        assert stored_data is not None

        # Verify analytics initialization
        analytics_key = f"analytics:{template.template_id}"
        analytics_data = await redis_mock.hgetall(analytics_key)
        assert int(analytics_data[b"usage_count"]) == 0
        assert float(analytics_data[b"success_rate"]) == 0.0

    @pytest.mark.asyncio
    async def test_template_validation(self, template_manager):
        """Test template validation logic."""
        # Test invalid content
        with pytest.raises(ValueError):
            await template_manager.create_template(
                name="Invalid Template",
                content="Too short",
                tone=ResponseTone.TONE_PROFESSIONAL,
                category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
                tags=[]
            )

        # Test missing placeholders
        with pytest.raises(ValueError):
            await template_manager.create_template(
                name="No Placeholders",
                content="Content without any placeholders",
                tone=ResponseTone.TONE_PROFESSIONAL,
                category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
                tags=[]
            )

    @pytest.mark.asyncio
    async def test_template_versioning(self, template_manager):
        """Test template versioning functionality."""
        # Create initial template
        template = await template_manager.create_template(
            name="Versioned Template",
            content=TEST_TEMPLATE_CONTENT,
            tone=ResponseTone.TONE_PROFESSIONAL,
            category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
            tags=["test"]
        )

        # Update template content
        updated_content = TEST_TEMPLATE_CONTENT.replace(
            "Best regards", "Kind regards"
        )
        updated_template = await template_manager.update_template(
            template.template_id,
            content=updated_content
        )

        # Verify version increment
        assert updated_template.version == template.version + 1
        
        # Verify version history
        versions = await template_manager.get_template_versions(template.template_id)
        assert len(versions) == 2
        assert versions[0].version == 1
        assert versions[1].version == 2

    @pytest.mark.asyncio
    async def test_template_analytics(self, template_manager):
        """Test template analytics and metrics tracking."""
        # Create template
        template = await template_manager.create_template(
            name="Analytics Test",
            content=TEST_TEMPLATE_CONTENT,
            tone=ResponseTone.TONE_PROFESSIONAL,
            category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
            tags=["test"]
        )

        # Simulate template usage
        usage_data = {
            "success": True,
            "response_time": 1.5,
            "user_rating": 4.5
        }
        await template_manager.track_template_usage(
            template.template_id,
            usage_data
        )

        # Verify analytics update
        analytics = await template_manager.get_template_analytics(template.template_id)
        assert analytics["usage_count"] == 1
        assert analytics["success_rate"] > 0
        assert "last_used" in analytics

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, template_manager):
        """Test concurrent template operations."""
        async def create_template(index):
            return await template_manager.create_template(
                name=f"Concurrent Template {index}",
                content=TEST_TEMPLATE_CONTENT,
                tone=ResponseTone.TONE_PROFESSIONAL,
                category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
                tags=[f"test_{index}"]
            )

        # Execute concurrent template creations
        tasks = [create_template(i) for i in range(5)]
        templates = await asyncio.gather(*tasks)

        # Verify unique template IDs
        template_ids = [t.template_id for t in templates]
        assert len(set(template_ids)) == 5

    @pytest.mark.asyncio
    async def test_template_search(self, template_manager):
        """Test template search and filtering."""
        # Create test templates
        templates = []
        for i in range(3):
            template = await template_manager.create_template(
                name=f"Search Template {i}",
                content=TEST_TEMPLATE_CONTENT,
                tone=ResponseTone.TONE_PROFESSIONAL,
                category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
                tags=[f"test_{i}", "search"]
            )
            templates.append(template)

        # Test search by tag
        search_results = await template_manager.find_templates(
            tags=["search"],
            category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT
        )
        assert len(search_results) == 3

        # Test search by name pattern
        search_results = await template_manager.find_templates(
            name_pattern="Template 1"
        )
        assert len(search_results) == 1

    @pytest.mark.asyncio
    async def test_performance_metrics(self, template_manager):
        """Test template performance metrics collection."""
        template = await template_manager.create_template(
            name="Performance Test",
            content=TEST_TEMPLATE_CONTENT,
            tone=ResponseTone.TONE_PROFESSIONAL,
            category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
            tags=["performance"]
        )

        # Simulate multiple usage events
        usage_events = [
            {"success": True, "response_time": 1.2},
            {"success": True, "response_time": 1.5},
            {"success": False, "response_time": 2.0}
        ]

        for event in usage_events:
            await template_manager.track_template_usage(
                template.template_id,
                event
            )

        # Verify performance metrics
        metrics = await template_manager.get_template_analytics(template.template_id)
        assert metrics["usage_count"] == 3
        assert metrics["success_rate"] == pytest.approx(0.67, rel=0.01)