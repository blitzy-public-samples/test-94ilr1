"""
Integration Test Suite for Response Generator Service

Tests end-to-end response generation flow including template management,
AI processing, response customization, and learning system capabilities.

Version: 1.0.0
"""

import pytest
import fakeredis
import asyncio
from datetime import datetime
from typing import Dict, Any

from ....shared.proto.response_pb2 import ResponseTone, TemplateCategory
from ...src.services.generator import ResponseGenerator
from ...src.services.template_manager import TemplateManager
from ...src.utils.ai_processor import AIProcessor
from ...src.config.settings import Settings

# Test constants
TEST_EMAIL_ID = "test-email-123"
TEST_CONTEXT_DATA = {
    "project": "Sales Q4",
    "priority": "high",
    "tone": "professional",
    "confidence_threshold": 0.85
}
TEST_TEMPLATE_CONTENT = """Dear {recipient},

Thank you for your email regarding {subject}.

Best regards,
{sender}"""
PERFORMANCE_THRESHOLDS = {
    "response_generation": 2000,  # ms
    "template_selection": 500,    # ms
    "context_analysis": 1000      # ms
}

@pytest.mark.asyncio
class TestResponseGenerator:
    """
    Comprehensive integration test suite for ResponseGenerator service
    with enhanced testing capabilities.
    """

    async def setup_method(self):
        """Set up test dependencies and configurations with enhanced monitoring."""
        # Initialize settings
        self.settings = Settings()
        self.settings.configure_logging()

        # Initialize Redis mock with cluster mode
        self.redis_client = fakeredis.FakeRedis(cluster=True)
        
        # Initialize AI processor with test settings
        self.ai_processor = AIProcessor(self.settings)
        
        # Initialize template manager with versioning
        self.template_manager = TemplateManager(
            redis_client=self.redis_client,
            ai_processor=self.ai_processor,
            config={"analytics_retention": 7}  # 7 days for testing
        )
        
        # Initialize response generator with learning capabilities
        self.generator = ResponseGenerator(
            template_manager=self.template_manager,
            ai_processor=self.ai_processor,
            config={
                "min_confidence": 0.7,
                "learning_interval": 5  # Shorter interval for testing
            }
        )
        
        # Initialize performance metrics tracking
        self.performance_metrics = {}
        
        # Initialize learning metrics collection
        self.learning_data = {
            "responses": [],
            "confidence_scores": [],
            "template_usage": {}
        }

    @pytest.mark.benchmark
    async def test_generate_response_success(self):
        """Test successful response generation with enhanced context awareness."""
        # Create test template
        template = await self.template_manager.create_template(
            name="Professional Response",
            content=TEST_TEMPLATE_CONTENT,
            tone=ResponseTone.TONE_PROFESSIONAL,
            category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
            tags=["professional", "acknowledgment"]
        )
        
        # Start performance timer
        start_time = datetime.utcnow()
        
        # Generate response
        response = await self.generator.generate_response(
            email_id=TEST_EMAIL_ID,
            context_data=TEST_CONTEXT_DATA,
            tone=ResponseTone.TONE_PROFESSIONAL,
            preferences={"template_category": TemplateCategory.CATEGORY_ACKNOWLEDGMENT}
        )
        
        # Record performance metrics
        generation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        self.performance_metrics["response_generation"] = generation_time
        
        # Verify response content
        assert response.content is not None
        assert len(response.content) > 0
        assert "Best regards" in response.content
        
        # Verify context integration
        assert TEST_CONTEXT_DATA["project"] in response.metadata["context_used"]
        assert response.confidence_score >= TEST_CONTEXT_DATA["confidence_threshold"]
        
        # Verify template usage
        template_analytics = await self.template_manager.get_template_analytics(
            template.template_id
        )
        assert template_analytics["usage_count"] > 0
        
        # Verify learning metrics update
        assert response.metadata["learning_metrics"] is not None
        self.learning_data["responses"].append(response)
        self.learning_data["confidence_scores"].append(response.confidence_score)
        
        # Verify performance thresholds
        assert generation_time <= PERFORMANCE_THRESHOLDS["response_generation"]

    async def test_response_customization(self):
        """Test advanced response customization with tone analysis."""
        # Generate initial response
        initial_response = await self.generator.generate_response(
            email_id=TEST_EMAIL_ID,
            context_data=TEST_CONTEXT_DATA,
            tone=ResponseTone.TONE_PROFESSIONAL,
            preferences={}
        )
        
        # Customize response
        customization_params = {
            "tone": "friendly",
            "add_signature": True,
            "include_context": True
        }
        
        customized_response = await self.generator.customize_response(
            response_id=initial_response.response_id,
            customization_params=customization_params,
            preserve_context=True
        )
        
        # Verify customization
        assert customized_response.content != initial_response.content
        assert customized_response.tone == ResponseTone.TONE_FRIENDLY
        assert customized_response.metadata["customization_params"] == customization_params
        
        # Verify tone consistency
        tone_validation = await self.ai_processor.validate_tone_consistency(
            customized_response.content,
            "friendly"
        )
        assert tone_validation["tone_match_score"] >= 0.8
        
        # Verify context preservation
        assert customized_response.metadata["preserved_context"] is True
        assert TEST_CONTEXT_DATA["project"] in customized_response.metadata["context_used"]

    async def test_template_version_control(self):
        """Test template versioning and analytics."""
        # Create initial template version
        template_v1 = await self.template_manager.create_template(
            name="Test Template",
            content=TEST_TEMPLATE_CONTENT,
            tone=ResponseTone.TONE_PROFESSIONAL,
            category=TemplateCategory.CATEGORY_ACKNOWLEDGMENT,
            tags=["test"]
        )
        
        # Create updated version
        template_v2 = await self.template_manager.version_template(
            template_v1.template_id,
            content=TEST_TEMPLATE_CONTENT + "\n\nRegards,\nTeam",
            tone=ResponseTone.TONE_PROFESSIONAL
        )
        
        # Track template usage
        await self.template_manager.track_template_usage(
            template_v2.template_id,
            {"success": True, "confidence": 0.9}
        )
        
        # Verify version control
        template_versions = await self.template_manager.get_template_versions(
            template_v1.template_id
        )
        assert len(template_versions) == 2
        assert template_versions[-1].version > template_versions[0].version
        
        # Verify analytics
        analytics = await self.template_manager.get_template_analytics(
            template_v2.template_id
        )
        assert analytics["usage_count"] > 0
        assert analytics["success_rate"] > 0

    async def test_learning_system(self):
        """Test learning system feedback and metrics."""
        # Generate multiple responses to accumulate learning data
        for _ in range(5):
            response = await self.generator.generate_response(
                email_id=f"test-email-{_}",
                context_data=TEST_CONTEXT_DATA,
                tone=ResponseTone.TONE_PROFESSIONAL,
                preferences={}
            )
            
            # Track learning metrics
            self.learning_data["responses"].append(response)
            self.learning_data["confidence_scores"].append(response.confidence_score)
            
            # Simulate user feedback
            await self.generator.update_learning_metrics(
                response.response_id,
                {
                    "user_satisfaction": 0.9,
                    "context_relevance": 0.85,
                    "tone_accuracy": 0.95
                }
            )
        
        # Verify learning improvements
        avg_confidence = sum(self.learning_data["confidence_scores"]) / len(
            self.learning_data["confidence_scores"]
        )
        assert avg_confidence >= 0.8
        
        # Verify feedback incorporation
        latest_response = self.learning_data["responses"][-1]
        assert "learning_metrics" in latest_response.metadata
        assert latest_response.metadata["learning_metrics"]["improvement_rate"] > 0