"""
Core analyzer service that orchestrates email context analysis with enhanced error handling,
validation, and performance optimizations.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

import asyncio
import logging
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass

# Internal imports
from ..models.context import Context, ProjectContext, RelationshipContext
from ..utils.text_processor import TextAnalyzer
from .nlp_processor import NLPProcessor

# Global constants for configuration
BATCH_SIZE = 32  # Optimal batch size for processing
MIN_CONFIDENCE_THRESHOLD = 0.75  # Minimum confidence threshold for analysis
MAX_RETRIES = 3  # Maximum retry attempts for processing

class ContextAnalyzer:
    """
    Enhanced core service class that orchestrates email context analysis with 
    improved error handling and validation.
    """

    def __init__(self):
        """Initialize the context analyzer with enhanced component validation."""
        # Configure logging
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self._logger.addHandler(handler)

        # Initialize core components with validation
        try:
            self._nlp_processor = NLPProcessor(
                confidence_threshold=MIN_CONFIDENCE_THRESHOLD
            )
            self._text_analyzer = TextAnalyzer()
            self._logger.info("Successfully initialized ContextAnalyzer components")
        except Exception as e:
            self._logger.error(f"Failed to initialize ContextAnalyzer: {e}")
            raise

    @asyncio.coroutine
    async def analyze_email(self, email_id: str, content: str, thread_id: str) -> Context:
        """
        Analyzes a single email with enhanced validation and error handling.

        Args:
            email_id: Unique identifier for the email
            content: Email content to analyze
            thread_id: Thread identifier for context grouping

        Returns:
            Context: Validated context object with confidence scores

        Raises:
            ValueError: If input parameters are invalid
            RuntimeError: If analysis fails after retries
        """
        # Validate input parameters
        if not all([email_id, content, thread_id]):
            raise ValueError("All input parameters must be provided")

        self._logger.info(f"Starting analysis for email {email_id}")
        retry_count = 0

        while retry_count < MAX_RETRIES:
            try:
                # Process email content with NLP
                processed_content = await self._nlp_processor.process_email_content(content)
                
                if processed_content['confidence_score'] < MIN_CONFIDENCE_THRESHOLD:
                    self._logger.warning(
                        f"Low confidence score: {processed_content['confidence_score']}"
                    )
                    retry_count += 1
                    continue

                # Extract semantic context
                context = self._nlp_processor.extract_semantic_context(processed_content)
                
                # Update context with email metadata
                context.email_id = email_id
                context.thread_id = thread_id
                
                # Validate context
                if context.validate():
                    self._logger.info(
                        f"Successfully analyzed email {email_id} with confidence "
                        f"score {context.confidence_score}"
                    )
                    return context

            except Exception as e:
                self._logger.error(f"Error analyzing email {email_id}: {e}")
                retry_count += 1
                if retry_count == MAX_RETRIES:
                    raise RuntimeError(f"Failed to analyze email after {MAX_RETRIES} attempts")
                await asyncio.sleep(1)  # Brief delay before retry

        raise RuntimeError("Failed to achieve minimum confidence threshold in analysis")

    @asyncio.coroutine
    async def analyze_batch(self, email_batch: List[Tuple[str, str, str]]) -> List[Context]:
        """
        Processes email batches concurrently with optimized performance.

        Args:
            email_batch: List of tuples containing (email_id, content, thread_id)

        Returns:
            List[Context]: List of validated context objects

        Raises:
            ValueError: If batch format is invalid
            RuntimeError: If batch processing fails
        """
        # Validate batch input
        if not email_batch:
            raise ValueError("Email batch cannot be empty")

        self._logger.info(f"Starting batch analysis for {len(email_batch)} emails")
        
        # Split into optimal batch sizes
        results = []
        for i in range(0, len(email_batch), BATCH_SIZE):
            batch_slice = email_batch[i:i + BATCH_SIZE]
            
            try:
                # Process batch concurrently
                batch_tasks = [
                    self.analyze_email(email_id, content, thread_id)
                    for email_id, content, thread_id in batch_slice
                ]
                
                batch_results = await asyncio.gather(
                    *batch_tasks,
                    return_exceptions=True
                )

                # Handle partial batch failures
                for j, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        self._logger.error(
                            f"Failed to process email {batch_slice[j][0]}: {result}"
                        )
                    else:
                        results.append(result)

            except Exception as e:
                self._logger.error(f"Batch processing error: {e}")
                raise RuntimeError("Failed to process email batch") from e

        self._logger.info(
            f"Completed batch analysis. Successful: {len(results)}, "
            f"Failed: {len(email_batch) - len(results)}"
        )
        return results

    def update_context(self, existing_context: Context, new_context: Context) -> Context:
        """
        Updates existing context with enhanced merge validation.

        Args:
            existing_context: Existing Context object
            new_context: New Context object to merge

        Returns:
            Context: Validated merged context

        Raises:
            ValueError: If input contexts are invalid
            RuntimeError: If merge operation fails
        """
        # Validate input contexts
        if not existing_context.validate() or not new_context.validate():
            raise ValueError("Invalid context objects provided for update")

        try:
            # Merge project contexts
            merged_projects = {pc.project_id: pc for pc in existing_context.project_contexts}
            for new_project in new_context.project_contexts:
                if new_project.project_id in merged_projects:
                    # Update existing project context
                    existing_project = merged_projects[new_project.project_id]
                    existing_project.relevance_score = max(
                        existing_project.relevance_score,
                        new_project.relevance_score
                    )
                    existing_project.key_terms = list(set(
                        existing_project.key_terms + new_project.key_terms
                    ))
                else:
                    merged_projects[new_project.project_id] = new_project

            # Merge relationship contexts
            merged_relationships = {
                rc.person_id: rc for rc in existing_context.relationship_contexts
            }
            for new_relation in new_context.relationship_contexts:
                if new_relation.person_id in merged_relationships:
                    # Update existing relationship
                    existing_relation = merged_relationships[new_relation.person_id]
                    existing_relation.interaction_frequency = (
                        existing_relation.interaction_frequency + 
                        new_relation.interaction_frequency
                    ) / 2
                    existing_relation.last_interaction = max(
                        existing_relation.last_interaction,
                        new_relation.last_interaction
                    )
                else:
                    merged_relationships[new_relation.person_id] = new_relation

            # Create updated context
            updated_context = Context(
                context_id=existing_context.context_id,
                email_id=existing_context.email_id,
                thread_id=existing_context.thread_id,
                project_contexts=list(merged_projects.values()),
                relationship_contexts=list(merged_relationships.values()),
                topics=list(set(existing_context.topics + new_context.topics)),
                confidence_score=max(
                    existing_context.confidence_score,
                    new_context.confidence_score
                ),
                analyzed_at=new_context.analyzed_at,
                metadata={
                    **existing_context.metadata,
                    **new_context.metadata,
                    'update_count': str(
                        int(existing_context.metadata.get('update_count', '0')) + 1
                    )
                }
            )

            # Validate merged context
            if not updated_context.validate():
                raise ValueError("Merged context validation failed")

            self._logger.info(
                f"Successfully updated context {existing_context.context_id}"
            )
            return updated_context

        except Exception as e:
            self._logger.error(f"Error updating context: {e}")
            raise RuntimeError("Failed to update context") from e