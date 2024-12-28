"""
Template Manager Service Module

Provides comprehensive template management functionality with CRUD operations,
validation, analytics tracking, and async support for the Response Generator service.

Version: 1.0.0
License: MIT
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import redis  # ^4.5.0

from ..models.response import ResponseTemplate
from ..utils.ai_processor import AIProcessor
from ....shared.proto.response_pb2 import ResponseTone, TemplateCategory

# Configure module logger
logger = logging.getLogger(__name__)

# Constants for template management
TEMPLATE_CACHE_TTL = 3600  # Cache TTL in seconds
MAX_TEMPLATES_PER_CATEGORY = 100
MIN_CONFIDENCE_SCORE = 0.75
MAX_TEMPLATE_SIZE = 50000
ANALYTICS_RETENTION_DAYS = 90

class TemplateManager:
    """
    Enhanced service class for managing email response templates with caching,
    validation, analytics, and async support.
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        ai_processor: AIProcessor,
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize template manager with Redis cluster connection and AI processor.

        Args:
            redis_client: Redis cluster client for template storage
            ai_processor: AI processor instance for template validation
            config: Optional configuration parameters
        """
        self._redis_client = redis_client
        self._ai_processor = ai_processor
        self._template_cache: Dict[str, List[ResponseTemplate]] = {}
        self._usage_analytics: Dict[str, Dict[str, Any]] = {}
        
        # Initialize configuration
        self._config = {
            'cache_ttl': TEMPLATE_CACHE_TTL,
            'max_templates': MAX_TEMPLATES_PER_CATEGORY,
            'min_confidence': MIN_CONFIDENCE_SCORE,
            'max_size': MAX_TEMPLATE_SIZE,
            'analytics_retention': ANALYTICS_RETENTION_DAYS
        }
        if config:
            self._config.update(config)

        logger.info("Template Manager initialized with Redis cluster connection")

    async def create_template(
        self,
        name: str,
        content: str,
        tone: ResponseTone,
        category: TemplateCategory,
        tags: List[str],
        metadata: Optional[Dict[str, Any]] = None
    ) -> ResponseTemplate:
        """
        Create and store a new response template with validation and versioning.

        Args:
            name: Template name
            content: Template content with placeholders
            tone: Response tone enum value
            category: Template category enum value
            tags: List of template tags
            metadata: Optional template metadata

        Returns:
            ResponseTemplate: Newly created template

        Raises:
            ValueError: If template validation fails
            RuntimeError: If storage operation fails
        """
        try:
            # Validate template size
            if len(content) > self._config['max_size']:
                raise ValueError(f"Template content exceeds maximum size of {self._config['max_size']} characters")

            # Create template instance
            template = ResponseTemplate(
                name=name,
                content=content,
                tone=tone,
                tags=tags,
                metadata=metadata or {},
                version=1
            )

            # Validate template content and structure
            validation_results = template.validate_template()
            if not all(result == 'passed' for result in validation_results.values()):
                logger.error(f"Template validation failed: {validation_results}")
                raise ValueError("Template validation failed")

            # Calculate AI confidence score
            confidence_metrics = await self._ai_processor.calculate_confidence_score(
                content,
                {"tone": tone.name, "category": category.name},
                tone.name.lower()
            )

            if confidence_metrics['aggregate_score'] < self._config['min_confidence']:
                raise ValueError(f"Template confidence score {confidence_metrics['aggregate_score']} below threshold")

            # Store template in Redis
            template_key = f"template:{template.template_id}"
            template_data = template.model_dump_json()
            
            async with self._redis_client.pipeline() as pipe:
                # Store template data
                await pipe.set(template_key, template_data)
                # Add to category set
                await pipe.sadd(f"category:{category.name}", template.template_id)
                # Initialize analytics
                await pipe.hset(
                    f"analytics:{template.template_id}",
                    mapping={
                        "usage_count": 0,
                        "success_rate": 0.0,
                        "created_at": datetime.utcnow().isoformat()
                    }
                )
                await pipe.execute()

            # Update cache
            category_key = f"category:{category.name}"
            if category_key in self._template_cache:
                self._template_cache[category_key].append(template)

            logger.info(f"Created template {template.template_id} with confidence score {confidence_metrics['aggregate_score']}")
            return template

        except Exception as e:
            logger.error(f"Error creating template: {str(e)}")
            raise

    async def track_template_usage(
        self,
        template_id: str,
        usage_data: Dict[str, Any]
    ) -> bool:
        """
        Track template usage metrics and analytics.

        Args:
            template_id: Template identifier
            usage_data: Usage metrics and feedback data

        Returns:
            bool: Success status
        """
        try:
            analytics_key = f"analytics:{template_id}"
            current_time = datetime.utcnow()

            # Update usage metrics
            usage_metrics = {
                "last_used": current_time.isoformat(),
                "usage_count": await self._redis_client.hincrby(analytics_key, "usage_count", 1)
            }

            # Calculate success rate
            if "success" in usage_data:
                total_uses = usage_metrics["usage_count"]
                current_success = float(await self._redis_client.hget(analytics_key, "success_rate") or 0)
                new_success = (current_success * (total_uses - 1) + int(usage_data["success"])) / total_uses
                usage_metrics["success_rate"] = new_success

            # Store analytics data
            await self._redis_client.hmset(analytics_key, usage_metrics)

            # Update template metadata
            template_key = f"template:{template_id}"
            template_data = await self._redis_client.get(template_key)
            if template_data:
                template = ResponseTemplate.parse_raw(template_data)
                template.metadata.update({
                    "last_used": current_time.isoformat(),
                    "usage_count": usage_metrics["usage_count"]
                })
                await self._redis_client.set(template_key, template.model_dump_json())

            # Cleanup old analytics data
            retention_date = current_time - timedelta(days=self._config['analytics_retention'])
            await self._cleanup_old_analytics(template_id, retention_date)

            logger.info(f"Updated usage analytics for template {template_id}")
            return True

        except Exception as e:
            logger.error(f"Error tracking template usage: {str(e)}")
            return False

    async def _cleanup_old_analytics(
        self,
        template_id: str,
        retention_date: datetime
    ) -> None:
        """
        Clean up analytics data older than retention period.

        Args:
            template_id: Template identifier
            retention_date: Cutoff date for retention
        """
        try:
            analytics_key = f"analytics:{template_id}"
            old_data = await self._redis_client.hgetall(analytics_key)
            
            for key, value in old_data.items():
                if key.startswith("daily_") and datetime.fromisoformat(key.split("_")[1]) < retention_date:
                    await self._redis_client.hdel(analytics_key, key)

        except Exception as e:
            logger.warning(f"Error cleaning up analytics data: {str(e)}")