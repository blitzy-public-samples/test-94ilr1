"""
Response Generator Models Module

This module defines the core data models for the Response Generator service with enhanced
learning capabilities and validation logic for email responses and templates.

@version: 1.0.0
@license: MIT
@author: AI Email Management Platform Team
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
from uuid import uuid4
import pydantic
from pydantic import Field, validator

from ....shared.proto.response_pb2 import ResponseTone, ResponseStatus

class Response(pydantic.BaseModel):
    """
    Enhanced data model representing an email response with content, metadata,
    learning metrics, and advanced validation logic.
    """
    
    response_id: str = Field(default_factory=lambda: str(uuid4()))
    email_id: str
    thread_id: Optional[str] = None
    content: str
    template_id: Optional[str] = None
    tone: ResponseTone
    status: ResponseStatus
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    context_match_score: float = Field(default=0.0, ge=0.0, le=1.0)
    learning_metrics: Dict[str, float] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    validation_results: Dict[str, str] = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            ResponseTone: lambda v: v.name,
            ResponseStatus: lambda v: v.name
        }

    @validator('content')
    def validate_content_length(cls, v: str) -> str:
        """Validates the content length meets minimum requirements."""
        if len(v.strip()) < 10:
            raise ValueError("Response content must be at least 10 characters long")
        return v

    def validate_content(self) -> Dict[str, Any]:
        """
        Enhanced content validation with NLP checks and learning feedback.
        
        Returns:
            Dict[str, Any]: Detailed validation results
        """
        validation_results = {
            'length_check': 'passed' if len(self.content) >= 10 else 'failed',
            'structure_check': 'passed' if self._validate_structure() else 'failed',
            'tone_consistency': 'passed' if self._validate_tone() else 'failed',
            'prohibited_content': 'passed' if self._check_prohibited_content() else 'failed'
        }
        
        # Update validation results
        self.validation_results = validation_results
        
        # Update learning metrics based on validation
        self._update_validation_metrics(validation_results)
        
        return validation_results

    def update_learning_metrics(self, new_metrics: Dict[str, float]) -> bool:
        """
        Update response learning metrics based on usage and feedback.
        
        Args:
            new_metrics (Dict[str, float]): New metrics to incorporate
            
        Returns:
            bool: Update success status
        """
        try:
            # Validate metrics format
            self._validate_metrics_format(new_metrics)
            
            # Merge with existing metrics
            self.learning_metrics.update(new_metrics)
            
            # Calculate aggregate scores
            self._calculate_aggregate_scores()
            
            # Update timestamp
            self.last_updated_at = datetime.utcnow()
            
            return True
        except Exception:
            return False

    def _validate_structure(self) -> bool:
        """Validates the structural integrity of the response content."""
        # Check for basic email structure components
        has_greeting = any(greeting in self.content.lower() 
                         for greeting in ['hello', 'hi', 'dear', 'greetings'])
        has_closing = any(closing in self.content.lower() 
                        for closing in ['regards', 'sincerely', 'best', 'thanks'])
        has_body = len(self.content.split('\n')) > 2
        
        return has_greeting and has_closing and has_body

    def _validate_tone(self) -> bool:
        """Validates tone consistency throughout the response."""
        # Implement tone analysis logic based on ResponseTone
        tone_markers = {
            ResponseTone.TONE_PROFESSIONAL: ['please', 'would', 'kindly'],
            ResponseTone.TONE_FRIENDLY: ['thanks', 'great', 'appreciate'],
            ResponseTone.TONE_FORMAL: ['accordingly', 'pursuant', 'hereby'],
            ResponseTone.TONE_CASUAL: ['hey', 'sure', 'okay']
        }
        
        expected_markers = tone_markers.get(self.tone, [])
        found_markers = sum(1 for marker in expected_markers 
                          if marker in self.content.lower())
        
        return found_markers >= len(expected_markers) * 0.3

    def _check_prohibited_content(self) -> bool:
        """Checks for prohibited content in the response."""
        prohibited_terms = [
            'confidential',
            'private',
            'secret',
            'classified'
        ]
        return not any(term in self.content.lower() for term in prohibited_terms)

    def _update_validation_metrics(self, validation_results: Dict[str, str]) -> None:
        """Updates learning metrics based on validation results."""
        passed_checks = sum(1 for result in validation_results.values() 
                          if result == 'passed')
        total_checks = len(validation_results)
        
        self.learning_metrics['validation_score'] = passed_checks / total_checks
        self.learning_metrics['last_validation'] = datetime.utcnow().isoformat()

    def _calculate_aggregate_scores(self) -> None:
        """Calculates aggregate scores from learning metrics."""
        if self.learning_metrics:
            # Update confidence score based on learning metrics
            self.confidence_score = sum(
                score for score in self.learning_metrics.values() 
                if isinstance(score, (int, float))
            ) / len(self.learning_metrics)

    @staticmethod
    def _validate_metrics_format(metrics: Dict[str, float]) -> None:
        """Validates the format of learning metrics."""
        if not all(isinstance(v, (int, float)) for v in metrics.values()):
            raise ValueError("All metric values must be numeric")


class ResponseTemplate(pydantic.BaseModel):
    """
    Enhanced template model with version control and usage analytics.
    """
    
    template_id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    content: str
    tone: ResponseTone
    placeholders: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True
    version: int = 1
    usage_metrics: Dict[str, float] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ResponseTone: lambda v: v.name
        }

    @validator('content')
    def extract_placeholders(cls, v: str) -> str:
        """Extracts and validates placeholders from content."""
        import re
        placeholders = re.findall(r'\{(\w+)\}', v)
        if not placeholders:
            raise ValueError("Template must contain at least one placeholder")
        return v

    def validate_template(self) -> Dict[str, Any]:
        """
        Comprehensive template validation with enhanced checks.
        
        Returns:
            Dict[str, Any]: Validation results
        """
        validation_results = {
            'format_check': self._validate_format(),
            'placeholder_check': self._validate_placeholders(),
            'tone_check': self._validate_template_tone(),
            'version_check': self._validate_version()
        }
        
        return validation_results

    def update_metrics(self, new_metrics: Dict[str, float]) -> bool:
        """
        Update template usage metrics and performance data.
        
        Args:
            new_metrics (Dict[str, float]): New metrics to incorporate
            
        Returns:
            bool: Update success status
        """
        try:
            # Validate metrics format
            if not all(isinstance(v, (int, float)) for v in new_metrics.values()):
                return False
            
            # Update usage metrics
            self.usage_metrics.update(new_metrics)
            
            # Update metadata
            self.metadata['last_used'] = datetime.utcnow().isoformat()
            self.metadata['total_uses'] = self.metadata.get('total_uses', 0) + 1
            
            return True
        except Exception:
            return False

    def _validate_format(self) -> str:
        """Validates the template format."""
        return 'passed' if len(self.content) >= 50 else 'failed'

    def _validate_placeholders(self) -> str:
        """Validates placeholder consistency."""
        import re
        content_placeholders = set(re.findall(r'\{(\w+)\}', self.content))
        declared_placeholders = set(self.placeholders)
        
        return 'passed' if content_placeholders == declared_placeholders else 'failed'

    def _validate_template_tone(self) -> str:
        """Validates template tone consistency."""
        tone_words = {
            ResponseTone.TONE_PROFESSIONAL: ['please', 'would', 'kindly'],
            ResponseTone.TONE_FRIENDLY: ['thanks', 'great', 'appreciate'],
            ResponseTone.TONE_FORMAL: ['accordingly', 'pursuant', 'hereby']
        }
        
        expected_words = tone_words.get(self.tone, [])
        found_words = sum(1 for word in expected_words 
                         if word in self.content.lower())
        
        return 'passed' if found_words >= len(expected_words) * 0.3 else 'failed'

    def _validate_version(self) -> str:
        """Validates version integrity."""
        return 'passed' if self.version > 0 else 'failed'