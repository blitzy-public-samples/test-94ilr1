"""
Integration tests for the Context Engine service.
Verifies end-to-end functionality with comprehensive validation of context analysis,
API endpoints, and data persistence.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

import pytest
import pytest_asyncio
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from httpx import AsyncClient

# Internal imports
from ...src.models.context import (
    Context, 
    ProjectContext, 
    RelationshipContext,
    ProjectStatus,
    RelationshipType
)
from ...src.services.analyzer import ContextAnalyzer

# Test constants
TEST_EMAIL_ID = "test-email-123"
TEST_THREAD_ID = "test-thread-456"
TEST_PROJECT_ID = "test-project-789"
ACCURACY_THRESHOLD = 0.95
TEST_DATA_PATH = "./test_data"

@pytest.mark.integration
class TestContextEngine:
    """Comprehensive test class for Context Engine integration testing."""

    def __init__(self):
        """Initialize test class with enhanced test configuration."""
        self._analyzer = ContextAnalyzer()
        self._accuracy_threshold = ACCURACY_THRESHOLD
        self._test_data = self._load_test_data()

    def _load_test_data(self) -> Dict[str, Any]:
        """Load test data from files with validation."""
        try:
            with open(os.path.join(TEST_DATA_PATH, "test_emails.json"), "r") as f:
                return json.load(f)
        except Exception as e:
            pytest.fail(f"Failed to load test data: {e}")

    async def validate_context_accuracy(self, context: Context, expected_accuracy: float) -> bool:
        """
        Validates context analysis accuracy against threshold.
        
        Args:
            context: Generated context object
            expected_accuracy: Expected accuracy threshold
            
        Returns:
            bool: Whether context meets accuracy requirements
        """
        # Validate confidence score
        if context.confidence_score < expected_accuracy:
            return False

        # Validate project contexts
        for project in context.project_contexts:
            if project.relevance_score < expected_accuracy:
                return False
            if not project.key_terms or len(project.key_terms) == 0:
                return False

        # Validate relationship contexts
        for relationship in context.relationship_contexts:
            if relationship.interaction_frequency < expected_accuracy:
                return False
            if not relationship.sentiment_metrics:
                return False

        return True

@pytest.fixture(scope='module')
@pytest_asyncio.fixture
async def setup_module():
    """Enhanced pytest fixture to set up test environment."""
    # Initialize test client
    client = AsyncClient(base_url="http://test")
    
    try:
        # Set up test data
        if not os.path.exists(TEST_DATA_PATH):
            os.makedirs(TEST_DATA_PATH)
            
        # Initialize test environment
        test_instance = TestContextEngine()
        
        yield client
        
    finally:
        # Cleanup
        await client.aclose()

@pytest.mark.asyncio
async def test_analyze_single_email(client: AsyncClient):
    """
    Tests single email context analysis with accuracy validation.
    
    Args:
        client: Configured test client
    """
    # Prepare test data
    test_email = {
        "email_id": TEST_EMAIL_ID,
        "thread_id": TEST_THREAD_ID,
        "content": "Important project update for Q4 sales targets. Meeting with stakeholders tomorrow.",
        "metadata": {
            "source": "test",
            "version": "1.0",
            "timestamp": datetime.utcnow().isoformat()
        }
    }

    # Initialize analyzer
    analyzer = ContextAnalyzer()

    try:
        # Analyze email
        context = await analyzer.analyze_email(
            test_email["email_id"],
            test_email["content"],
            test_email["thread_id"]
        )

        # Validate response
        assert context is not None
        assert context.email_id == TEST_EMAIL_ID
        assert context.thread_id == TEST_THREAD_ID
        assert context.confidence_score >= ACCURACY_THRESHOLD

        # Validate project context
        assert len(context.project_contexts) > 0
        project = context.project_contexts[0]
        assert project.project_name is not None
        assert project.relevance_score >= ACCURACY_THRESHOLD
        assert len(project.key_terms) > 0

        # Validate relationship context
        assert len(context.relationship_contexts) > 0
        relationship = context.relationship_contexts[0]
        assert relationship.interaction_frequency >= ACCURACY_THRESHOLD
        assert relationship.sentiment_metrics is not None

        # Validate topics
        assert len(context.topics) > 0
        assert "sales" in [topic.lower() for topic in context.topics]

    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_analyze_batch_emails(client: AsyncClient):
    """
    Tests batch email context analysis with comprehensive validation.
    
    Args:
        client: Configured test client
    """
    # Prepare batch test data
    test_emails = [
        (
            f"test-email-{i}",
            f"Test email content {i} discussing project updates and team collaboration.",
            f"test-thread-{i}"
        )
        for i in range(5)
    ]

    # Initialize analyzer
    analyzer = ContextAnalyzer()

    try:
        # Analyze batch
        contexts = await analyzer.analyze_batch(test_emails)

        # Validate batch results
        assert len(contexts) == len(test_emails)
        
        for context in contexts:
            # Validate basic structure
            assert context is not None
            assert context.email_id is not None
            assert context.thread_id is not None
            
            # Validate confidence scores
            assert context.confidence_score >= ACCURACY_THRESHOLD
            
            # Validate project contexts
            assert len(context.project_contexts) > 0
            for project in context.project_contexts:
                assert project.relevance_score >= ACCURACY_THRESHOLD
                assert len(project.key_terms) > 0
                
            # Validate relationship contexts
            assert len(context.relationship_contexts) > 0
            for relationship in context.relationship_contexts:
                assert relationship.interaction_frequency >= ACCURACY_THRESHOLD
                assert relationship.sentiment_metrics is not None
                
            # Validate metadata
            assert "source" in context.metadata
            assert "version" in context.metadata
            assert "timestamp" in context.metadata

    except Exception as e:
        pytest.fail(f"Batch analysis test failed: {str(e)}")