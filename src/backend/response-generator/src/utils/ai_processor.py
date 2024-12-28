"""
AI Processor Utility Module

Handles natural language processing and response generation using OpenAI's GPT models
with context awareness, tone control, and advanced learning capabilities.

Version: 1.0.0
License: MIT
"""

import asyncio
import logging
import numpy as np
import openai  # ^1.3.0
from tenacity import retry, stop_after_attempt, wait_exponential  # ^8.2.0
from typing import Dict, Any, Optional, List, Tuple

from ..models.response import Response
from ..config.settings import Settings

# Configure module logger
logger = logging.getLogger(__name__)

# System prompt for response generation
SYSTEM_PROMPT = """You are an AI assistant specialized in generating professional email responses 
while maintaining context awareness and appropriate tone."""

# Retry configuration
MAX_RETRIES = 3
RETRY_WAIT_SECONDS = 2

# Confidence scoring thresholds
CONFIDENCE_THRESHOLDS = {
    "high": 0.8,
    "medium": 0.6,
    "low": 0.4
}

class AIProcessor:
    """
    Advanced AI processor for email response generation with context awareness,
    learning capabilities, and sophisticated tone control.
    """

    def __init__(self, settings: Settings):
        """
        Initialize AI processor with enhanced configuration and monitoring.

        Args:
            settings (Settings): Configuration settings for the AI processor
        """
        self._settings = settings
        self._client = openai.Client(api_key=settings.OPENAI_API_KEY)
        
        # Configure model parameters
        self._model_config = {
            "model": settings.OPENAI_MODEL_NAME,
            "temperature": settings.OPENAI_TEMPERATURE,
            "max_tokens": settings.OPENAI_MAX_TOKENS,
            "top_p": 0.9,
            "frequency_penalty": 0.5,
            "presence_penalty": 0.5
        }

        # Initialize metrics tracking
        self._confidence_metrics = {
            "context_relevance": 0.0,
            "tone_consistency": 0.0,
            "response_coherence": 0.0,
            "professional_language": 0.0
        }

        logger.info(f"Initialized AI Processor with model: {settings.OPENAI_MODEL_NAME}")

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_WAIT_SECONDS)
    )
    async def generate_response(
        self,
        email_content: str,
        context_data: Dict[str, Any],
        tone: str,
        template_data: Optional[Dict[str, Any]] = None
    ) -> Response:
        """
        Generate context-aware email response with tone control and validation.

        Args:
            email_content (str): Original email content
            context_data (Dict[str, Any]): Contextual information for response
            tone (str): Desired tone for the response
            template_data (Optional[Dict[str, Any]]): Template customization data

        Returns:
            Response: Generated response with content, metadata, and confidence metrics

        Raises:
            ValueError: If input parameters are invalid
            openai.OpenAIError: If API call fails
        """
        try:
            # Validate inputs
            if not email_content or not context_data:
                raise ValueError("Email content and context data are required")

            # Prepare enhanced prompt
            prompt = await self.prepare_prompt(email_content, context_data, tone, template_data)

            # Generate response using OpenAI
            response = await self._client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                **self._model_config
            )

            # Extract generated content
            generated_content = response.choices[0].message.content

            # Calculate confidence metrics
            confidence_metrics = await self.calculate_confidence_score(
                generated_content, context_data, tone
            )

            # Validate response meets confidence threshold
            if confidence_metrics["aggregate_score"] < self._settings.MIN_CONFIDENCE_THRESHOLD:
                logger.warning(f"Response confidence below threshold: {confidence_metrics['aggregate_score']}")
                raise ValueError("Generated response did not meet confidence threshold")

            # Create response object
            response_obj = Response(
                content=generated_content,
                metadata={
                    "model": self._settings.OPENAI_MODEL_NAME,
                    "confidence_metrics": confidence_metrics,
                    "tone": tone,
                    "context_used": list(context_data.keys()),
                    "template_applied": bool(template_data)
                }
            )

            logger.info(f"Successfully generated response with confidence: {confidence_metrics['aggregate_score']}")
            return response_obj

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise

    async def calculate_confidence_score(
        self,
        response_content: str,
        context_data: Dict[str, Any],
        tone: str
    ) -> Dict[str, float]:
        """
        Calculate detailed confidence score with multiple metrics.

        Args:
            response_content (str): Generated response content
            context_data (Dict[str, Any]): Context used for generation
            tone (str): Intended tone of the response

        Returns:
            Dict[str, float]: Detailed confidence metrics
        """
        metrics = {}

        # Calculate context relevance
        context_terms = self._extract_key_terms(context_data)
        metrics["context_relevance"] = self._calculate_term_overlap(
            response_content, context_terms
        )

        # Evaluate tone consistency
        metrics["tone_consistency"] = self._evaluate_tone_match(
            response_content, tone
        )

        # Assess response coherence
        metrics["response_coherence"] = self._assess_coherence(response_content)

        # Check professional language
        metrics["professional_language"] = self._check_professional_language(
            response_content
        )

        # Calculate aggregate score
        metrics["aggregate_score"] = np.mean([
            metrics["context_relevance"],
            metrics["tone_consistency"],
            metrics["response_coherence"],
            metrics["professional_language"]
        ])

        # Update internal metrics
        self._confidence_metrics.update(metrics)

        return metrics

    async def prepare_prompt(
        self,
        email_content: str,
        context_data: Dict[str, Any],
        tone: str,
        template_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Prepare comprehensive prompt with context integration.

        Args:
            email_content (str): Original email content
            context_data (Dict[str, Any]): Context information
            tone (str): Desired response tone
            template_data (Optional[Dict[str, Any]]): Template parameters

        Returns:
            str: Formatted prompt with context and instructions
        """
        # Format context information
        context_str = "\n".join([
            f"- {key}: {value}" for key, value in context_data.items()
        ])

        # Build prompt with template if provided
        if template_data:
            prompt = f"""
            Original Email:
            {email_content}

            Context Information:
            {context_str}

            Template Parameters:
            {self._format_template_params(template_data)}

            Please generate a {tone} response using the provided template and context.
            Ensure the response maintains professional language and addresses all key points.
            """
        else:
            prompt = f"""
            Original Email:
            {email_content}

            Context Information:
            {context_str}

            Please generate a {tone} response that:
            1. Maintains professional language
            2. Addresses all key points from the original email
            3. Incorporates relevant context
            4. Uses appropriate tone and style
            """

        return prompt.strip()

    def _extract_key_terms(self, context_data: Dict[str, Any]) -> List[str]:
        """Extract key terms from context data for relevance calculation."""
        terms = []
        for value in context_data.values():
            if isinstance(value, str):
                terms.extend(value.lower().split())
        return list(set(terms))

    def _calculate_term_overlap(self, content: str, terms: List[str]) -> float:
        """Calculate overlap between response content and context terms."""
        content_words = set(content.lower().split())
        overlap = len(content_words.intersection(terms))
        return min(1.0, overlap / (len(terms) + 1e-6))

    def _evaluate_tone_match(self, content: str, tone: str) -> float:
        """Evaluate if the response matches the intended tone."""
        tone_indicators = {
            "professional": ["would", "please", "kindly", "regarding"],
            "friendly": ["thanks", "appreciate", "great", "looking forward"],
            "formal": ["hereby", "pursuant", "accordingly", "furthermore"]
        }
        
        target_indicators = tone_indicators.get(tone.lower(), [])
        if not target_indicators:
            return 0.8  # Default score for unknown tone
            
        matches = sum(1 for indicator in target_indicators 
                     if indicator in content.lower())
        return min(1.0, matches / len(target_indicators))

    def _assess_coherence(self, content: str) -> float:
        """Assess the coherence of the response content."""
        sentences = content.split('.')
        if len(sentences) < 2:
            return 0.5
            
        # Basic coherence checks
        has_greeting = any(greeting in content.lower() 
                         for greeting in ['hello', 'hi', 'dear'])
        has_closing = any(closing in content.lower() 
                         for closing in ['regards', 'sincerely', 'best'])
        has_body = len(sentences) >= 3
        
        coherence_score = sum([has_greeting, has_closing, has_body]) / 3
        return coherence_score

    def _check_professional_language(self, content: str) -> float:
        """Check if the response maintains professional language."""
        informal_terms = ['yeah', 'nah', 'gonna', 'wanna', 'hey']
        professional_terms = ['please', 'thank you', 'regards', 'sincerely']
        
        informal_count = sum(1 for term in informal_terms 
                           if term in content.lower())
        professional_count = sum(1 for term in professional_terms 
                               if term in content.lower())
        
        if informal_count == 0 and professional_count > 0:
            return 1.0
        elif informal_count > 0:
            return max(0.0, 1.0 - (informal_count * 0.2))
        return 0.8

    def _format_template_params(self, template_data: Dict[str, Any]) -> str:
        """Format template parameters for prompt inclusion."""
        return "\n".join([
            f"- {key}: {value}" for key, value in template_data.items()
        ])