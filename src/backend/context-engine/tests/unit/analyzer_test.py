"""
Comprehensive unit tests for the Context Engine's analyzer service.
Tests GPU acceleration, context analysis accuracy, and performance benchmarks.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

import pytest
import asyncio
from unittest.mock import MagicMock, patch
from typing import Dict, List, Any
import time
import torch

from ...src.services.analyzer import ContextAnalyzer
from ...src.models.context import Context, ProjectContext, RelationshipContext
from ...src.services.nlp_processor import NLPProcessor
from ...src.utils.text_processor import TextAnalyzer

# Test constants
TEST_EMAIL_ID = "test_email_123"
TEST_THREAD_ID = "test_thread_456"
TEST_CONTENT = "Sample email content for testing context analysis"
ACCURACY_THRESHOLD = 0.95
BATCH_SIZE = 100
GPU_REQUIRED = True

@pytest.mark.asyncio
class TestContextAnalyzer:
    """
    Comprehensive test suite for ContextAnalyzer with GPU acceleration 
    and performance validation.
    """

    async def setup_method(self):
        """Initialize test environment with GPU support and mocks."""
        # Configure GPU context
        self._mock_gpu_context = MagicMock()
        self._mock_gpu_context.is_available.return_value = GPU_REQUIRED
        self._mock_gpu_context.get_device_name.return_value = "NVIDIA Test GPU"

        # Initialize NLP processor mock with GPU support
        self._mock_nlp_processor = MagicMock(spec=NLPProcessor)
        self._mock_nlp_processor.process_email_content.return_value = {
            'embedding': torch.randn(768),
            'semantic_analysis': {
                'confidence_score': 0.96,
                'main_topics': ['project', 'meeting'],
                'sentiment': {'polarity': 0.8},
                'relationships': [
                    {'source': 'John', 'confidence': 0.97, 'type': 'sender'}
                ]
            },
            'confidence_score': 0.96,
            'timestamp': time.time()
        }

        # Initialize text analyzer mock
        self._mock_text_analyzer = MagicMock(spec=TextAnalyzer)
        self._mock_text_analyzer.preprocess_text.return_value = TEST_CONTENT
        self._mock_text_analyzer.extract_entities.return_value = {
            'PERSON': [{'text': 'John', 'confidence': 0.97}],
            'ORG': [{'text': 'Company', 'confidence': 0.95}]
        }

        # Initialize analyzer with mocks
        with patch('torch.cuda') as mock_cuda:
            mock_cuda.is_available.return_value = GPU_REQUIRED
            self._analyzer = ContextAnalyzer()
            self._analyzer._nlp_processor = self._mock_nlp_processor
            self._analyzer._text_analyzer = self._mock_text_analyzer

    @pytest.mark.asyncio
    @pytest.mark.benchmark
    async def test_analyze_email_with_gpu(self, benchmark):
        """
        Test GPU-accelerated email analysis with performance metrics.
        """
        # Configure test data
        test_data = {
            'email_id': TEST_EMAIL_ID,
            'content': TEST_CONTENT,
            'thread_id': TEST_THREAD_ID
        }

        # Measure GPU-accelerated analysis performance
        start_time = time.time()
        context = await benchmark(
            self._analyzer.analyze_email,
            test_data['email_id'],
            test_data['content'],
            test_data['thread_id']
        )
        processing_time = time.time() - start_time

        # Verify GPU acceleration was used
        self._mock_nlp_processor.process_email_content.assert_called_once()
        assert isinstance(context, Context)
        assert context.confidence_score >= ACCURACY_THRESHOLD

        # Validate context quality
        assert context.email_id == TEST_EMAIL_ID
        assert context.thread_id == TEST_THREAD_ID
        assert len(context.project_contexts) > 0
        assert len(context.relationship_contexts) > 0
        assert all(pc.relevance_score >= ACCURACY_THRESHOLD 
                  for pc in context.project_contexts)

        # Verify performance meets requirements
        assert processing_time < 2.0  # Maximum 2 seconds processing time
        assert context.metadata.get('device') == 'cuda' if GPU_REQUIRED else 'cpu'

    @pytest.mark.asyncio
    @pytest.mark.benchmark
    async def test_batch_processing_performance(self, benchmark):
        """
        Test batch processing performance with GPU optimization.
        """
        # Prepare batch test data
        batch_data = [
            (f"email_{i}", TEST_CONTENT, f"thread_{i}")
            for i in range(BATCH_SIZE)
        ]

        # Configure batch processing expectations
        self._mock_nlp_processor.batch_process_emails.return_value = [
            {
                'embedding': torch.randn(768),
                'semantic_analysis': {
                    'confidence_score': 0.96,
                    'main_topics': ['project', 'meeting'],
                    'sentiment': {'polarity': 0.8},
                    'relationships': [
                        {'source': 'John', 'confidence': 0.97, 'type': 'sender'}
                    ]
                },
                'confidence_score': 0.96,
                'timestamp': time.time()
            }
            for _ in range(BATCH_SIZE)
        ]

        # Measure batch processing performance
        start_time = time.time()
        contexts = await benchmark(self._analyzer.analyze_batch, batch_data)
        processing_time = time.time() - start_time

        # Verify batch processing results
        assert len(contexts) == BATCH_SIZE
        assert all(isinstance(ctx, Context) for ctx in contexts)
        assert all(ctx.confidence_score >= ACCURACY_THRESHOLD for ctx in contexts)

        # Validate batch processing efficiency
        avg_time_per_email = processing_time / BATCH_SIZE
        assert avg_time_per_email < 0.1  # Maximum 100ms per email in batch

        # Verify memory usage
        if GPU_REQUIRED:
            with patch('torch.cuda') as mock_cuda:
                assert mock_cuda.memory_allocated() < 4e9  # Max 4GB GPU memory

        # Verify batch processing quality
        for context in contexts:
            assert context.validate()
            assert len(context.project_contexts) > 0
            assert len(context.relationship_contexts) > 0
            assert context.metadata.get('source') == 'nlp_processor'

    @pytest.mark.asyncio
    async def test_context_update_accuracy(self):
        """
        Test context update accuracy and merge validation.
        """
        # Create initial context
        initial_context = await self._analyzer.analyze_email(
            TEST_EMAIL_ID,
            TEST_CONTENT,
            TEST_THREAD_ID
        )

        # Create new context with updated information
        new_content = "Updated test content with additional context"
        new_context = await self._analyzer.analyze_email(
            TEST_EMAIL_ID,
            new_content,
            TEST_THREAD_ID
        )

        # Update context
        updated_context = self._analyzer.update_context(initial_context, new_context)

        # Verify context merge accuracy
        assert updated_context.confidence_score >= ACCURACY_THRESHOLD
        assert len(updated_context.project_contexts) >= len(initial_context.project_contexts)
        assert updated_context.metadata.get('update_count') == '1'

        # Validate merged relationships
        assert all(rc.interaction_frequency > 0 
                  for rc in updated_context.relationship_contexts)
        assert all(pc.relevance_score >= ACCURACY_THRESHOLD 
                  for pc in updated_context.project_contexts)

    @pytest.mark.asyncio
    async def test_gpu_acceleration_fallback(self):
        """
        Test GPU acceleration fallback mechanism.
        """
        # Simulate GPU unavailability
        with patch('torch.cuda') as mock_cuda:
            mock_cuda.is_available.return_value = False
            
            # Initialize analyzer without GPU
            cpu_analyzer = ContextAnalyzer()
            
            # Process email
            context = await cpu_analyzer.analyze_email(
                TEST_EMAIL_ID,
                TEST_CONTENT,
                TEST_THREAD_ID
            )

            # Verify CPU fallback
            assert context.metadata.get('device') == 'cpu'
            assert context.confidence_score >= ACCURACY_THRESHOLD

    @pytest.mark.asyncio
    async def test_error_handling_and_retries(self):
        """
        Test error handling and retry mechanism.
        """
        # Configure mock to fail initially then succeed
        self._mock_nlp_processor.process_email_content.side_effect = [
            RuntimeError("Processing failed"),
            RuntimeError("Retry failed"),
            {  # Successful attempt
                'embedding': torch.randn(768),
                'semantic_analysis': {
                    'confidence_score': 0.96,
                    'main_topics': ['project'],
                    'sentiment': {'polarity': 0.8},
                    'relationships': []
                },
                'confidence_score': 0.96,
                'timestamp': time.time()
            }
        ]

        # Process email with retries
        context = await self._analyzer.analyze_email(
            TEST_EMAIL_ID,
            TEST_CONTENT,
            TEST_THREAD_ID
        )

        # Verify retry behavior
        assert self._mock_nlp_processor.process_email_content.call_count == 3
        assert context.confidence_score >= ACCURACY_THRESHOLD
        assert context.metadata.get('retry_count', '0') != '0'