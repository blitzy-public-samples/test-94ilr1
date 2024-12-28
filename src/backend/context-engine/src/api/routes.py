"""
FastAPI route definitions for the Context Engine service.
Implements RESTful endpoints for context analysis with comprehensive monitoring and validation.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

# External imports
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator  # version: 2.0.0
from opentelemetry import trace  # version: 1.19+
from prometheus_client import Counter, Histogram  # version: 0.17+
from fastapi_cache import FastAPICache  # version: 0.1.0
from fastapi_cache.decorator import cache
from slowapi import Limiter  # version: 0.1.8
from slowapi.util import get_remote_address

# Internal imports
from ..services.analyzer import ContextAnalyzer
from ..models.context import Context

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1/context", tags=["context"])

# Initialize core services
context_analyzer = ContextAnalyzer()

# Constants
BATCH_SIZE = 32
CONFIDENCE_THRESHOLD = 0.95

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Initialize metrics
CONTEXT_REQUESTS = Counter('context_requests_total', 'Total context analysis requests')
CONTEXT_LATENCY = Histogram('context_analysis_latency_seconds', 'Context analysis latency')
CONTEXT_ERRORS = Counter('context_errors_total', 'Total context analysis errors')

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Request/Response Models
class EmailContextRequest(BaseModel):
    """Request model for single email context analysis."""
    email_id: str = Field(..., description="Unique identifier for the email")
    content: str = Field(..., description="Email content to analyze")
    thread_id: str = Field(..., description="Thread identifier for context grouping")
    metadata: Optional[Dict[str, str]] = Field(default=None, description="Additional metadata")

    @validator('content')
    def content_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Email content cannot be empty")
        return v

class BatchContextRequest(BaseModel):
    """Request model for batch email context analysis."""
    emails: List[EmailContextRequest] = Field(..., description="List of emails to analyze")
    
    @validator('emails')
    def validate_batch_size(cls, v):
        if len(v) > BATCH_SIZE:
            raise ValueError(f"Batch size cannot exceed {BATCH_SIZE}")
        return v

class UpdateContextRequest(BaseModel):
    """Request model for context updates."""
    new_content: str = Field(..., description="New content to update context")
    metadata: Optional[Dict[str, str]] = Field(default=None, description="Update metadata")

@router.post('/analyze')
@trace.span("analyze_email_context")
@limiter.limit("100/minute")
@cache(expire=300)
async def analyze_email_context(
    request: EmailContextRequest,
    response: Response,
    req: Request
) -> Context:
    """
    Analyze context for a single email with enhanced validation and monitoring.
    
    Args:
        request: Email context analysis request
        response: FastAPI response object
        req: FastAPI request object
        
    Returns:
        Context: Analyzed context with confidence score
        
    Raises:
        HTTPException: If analysis fails or validation errors occur
    """
    try:
        CONTEXT_REQUESTS.inc()
        with CONTEXT_LATENCY.time():
            # Extract request data
            email_id = request.email_id
            content = request.content
            thread_id = request.thread_id
            
            logger.info(f"Processing context analysis for email {email_id}")
            
            # Analyze context
            context = await context_analyzer.analyze_email(
                email_id=email_id,
                content=content,
                thread_id=thread_id
            )
            
            # Validate confidence threshold
            if context.confidence_score < CONFIDENCE_THRESHOLD:
                logger.warning(
                    f"Low confidence score for email {email_id}: {context.confidence_score}"
                )
                raise HTTPException(
                    status_code=422,
                    detail="Analysis confidence below threshold"
                )
            
            # Set cache control headers
            response.headers["Cache-Control"] = "public, max-age=300"
            
            logger.info(f"Successfully analyzed context for email {email_id}")
            return context
            
    except ValueError as e:
        CONTEXT_ERRORS.inc()
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        CONTEXT_ERRORS.inc()
        logger.error(f"Error analyzing context: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post('/analyze/batch')
@trace.span("analyze_batch_context")
@limiter.limit("20/minute")
@cache(expire=600)
async def analyze_batch_context(
    request: BatchContextRequest,
    response: Response,
    req: Request
) -> List[Context]:
    """
    Analyze context for multiple emails in optimized batches.
    
    Args:
        request: Batch context analysis request
        response: FastAPI response object
        req: FastAPI request object
        
    Returns:
        List[Context]: List of analyzed contexts
        
    Raises:
        HTTPException: If batch processing fails
    """
    try:
        CONTEXT_REQUESTS.inc()
        with CONTEXT_LATENCY.time():
            logger.info(f"Processing batch context analysis for {len(request.emails)} emails")
            
            # Prepare batch data
            email_batch = [
                (email.email_id, email.content, email.thread_id)
                for email in request.emails
            ]
            
            # Process batch
            contexts = await context_analyzer.analyze_batch(email_batch)
            
            # Validate results
            valid_contexts = [
                ctx for ctx in contexts 
                if ctx.confidence_score >= CONFIDENCE_THRESHOLD
            ]
            
            if len(valid_contexts) < len(contexts):
                logger.warning(
                    f"Some contexts ({len(contexts) - len(valid_contexts)}) "
                    "did not meet confidence threshold"
                )
            
            # Set cache headers
            response.headers["Cache-Control"] = "public, max-age=600"
            
            logger.info(f"Successfully processed {len(valid_contexts)} contexts")
            return valid_contexts
            
    except ValueError as e:
        CONTEXT_ERRORS.inc()
        logger.error(f"Batch validation error: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        CONTEXT_ERRORS.inc()
        logger.error(f"Error in batch processing: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get('/{context_id}')
@trace.span("get_context")
@limiter.limit("200/minute")
@cache(expire=3600)
async def get_context(
    context_id: str,
    response: Response,
    req: Request
) -> Context:
    """
    Retrieve existing context by ID with caching.
    
    Args:
        context_id: Unique context identifier
        response: FastAPI response object
        req: FastAPI request object
        
    Returns:
        Context: Retrieved context with metadata
        
    Raises:
        HTTPException: If context not found or invalid
    """
    try:
        logger.info(f"Retrieving context {context_id}")
        
        # Validate context ID format
        if not context_id:
            raise ValueError("Context ID cannot be empty")
            
        # Retrieve context
        context = await context_analyzer.get_context(context_id)
        
        if not context:
            raise HTTPException(status_code=404, detail="Context not found")
            
        # Set cache headers
        response.headers["Cache-Control"] = "public, max-age=3600"
        
        logger.info(f"Successfully retrieved context {context_id}")
        return context
        
    except ValueError as e:
        logger.error(f"Invalid context ID: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving context: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put('/{context_id}')
@trace.span("update_context")
@limiter.limit("50/minute")
async def update_context(
    context_id: str,
    request: UpdateContextRequest,
    req: Request
) -> Context:
    """
    Update existing context with new information and validation.
    
    Args:
        context_id: Context identifier to update
        request: Update context request
        req: FastAPI request object
        
    Returns:
        Context: Updated context with confidence score
        
    Raises:
        HTTPException: If update fails or validation errors occur
    """
    try:
        logger.info(f"Updating context {context_id}")
        
        # Validate context ID and request
        if not context_id:
            raise ValueError("Context ID cannot be empty")
            
        # Get existing context
        existing_context = await context_analyzer.get_context(context_id)
        
        if not existing_context:
            raise HTTPException(status_code=404, detail="Context not found")
            
        # Process update
        updated_context = await context_analyzer.update_context(
            existing_context=existing_context,
            new_content=request.new_content
        )
        
        # Validate update result
        if updated_context.confidence_score < CONFIDENCE_THRESHOLD:
            raise HTTPException(
                status_code=422,
                detail="Updated context confidence below threshold"
            )
            
        # Invalidate cache for this context
        await FastAPICache.clear(f"context_{context_id}")
        
        logger.info(f"Successfully updated context {context_id}")
        return updated_context
        
    except ValueError as e:
        logger.error(f"Update validation error: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating context: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")