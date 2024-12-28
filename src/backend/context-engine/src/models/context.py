"""
Context data models with comprehensive validation and protocol buffer compatibility.
Implements the context.proto definitions with enhanced business logic and type safety.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

from dataclasses import dataclass, field
from datetime import datetime
import enum
from typing import Dict, List, Optional, Any, Union
import uuid
import re
from pydantic import BaseModel, EmailStr, validator, Field
from pydantic.dataclasses import dataclass as pydantic_dataclass

from ..shared.proto import context_pb2
from google.protobuf.timestamp_pb2 import Timestamp

# Constants for validation
MIN_CONFIDENCE_SCORE = 0.0
MAX_CONFIDENCE_SCORE = 1.0
MAX_TOPICS = 10
REQUIRED_METADATA_FIELDS = ['source', 'version', 'timestamp']
EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")

@enum.unique
class ProjectStatus(enum.Enum):
    """Project status states with validation."""
    ACTIVE = enum.auto()
    COMPLETED = enum.auto()
    ON_HOLD = enum.auto()
    ARCHIVED = enum.auto()

    @classmethod
    def from_proto(cls, status: context_pb2.ProjectStatus) -> 'ProjectStatus':
        """Convert proto enum to ProjectStatus."""
        status_map = {
            context_pb2.PROJECT_STATUS_ACTIVE: cls.ACTIVE,
            context_pb2.PROJECT_STATUS_COMPLETED: cls.COMPLETED,
            context_pb2.PROJECT_STATUS_ON_HOLD: cls.ON_HOLD,
            context_pb2.PROJECT_STATUS_ARCHIVED: cls.ARCHIVED
        }
        return status_map.get(status, cls.ACTIVE)

    def to_proto(self) -> context_pb2.ProjectStatus:
        """Convert to proto enum."""
        status_map = {
            self.ACTIVE: context_pb2.PROJECT_STATUS_ACTIVE,
            self.COMPLETED: context_pb2.PROJECT_STATUS_COMPLETED,
            self.ON_HOLD: context_pb2.PROJECT_STATUS_ON_HOLD,
            self.ARCHIVED: context_pb2.PROJECT_STATUS_ARCHIVED
        }
        return status_map[self]

@enum.unique
class RelationshipType(enum.Enum):
    """Types of relationships between communicating parties."""
    TEAM_MEMBER = enum.auto()
    STAKEHOLDER = enum.auto()
    CLIENT = enum.auto()
    VENDOR = enum.auto()

    @classmethod
    def from_proto(cls, type_: context_pb2.RelationshipType) -> 'RelationshipType':
        """Convert proto enum to RelationshipType."""
        type_map = {
            context_pb2.RELATIONSHIP_TYPE_TEAM_MEMBER: cls.TEAM_MEMBER,
            context_pb2.RELATIONSHIP_TYPE_STAKEHOLDER: cls.STAKEHOLDER,
            context_pb2.RELATIONSHIP_TYPE_CLIENT: cls.CLIENT,
            context_pb2.RELATIONSHIP_TYPE_VENDOR: cls.VENDOR
        }
        return type_map.get(type_, cls.TEAM_MEMBER)

    def to_proto(self) -> context_pb2.RelationshipType:
        """Convert to proto enum."""
        type_map = {
            self.TEAM_MEMBER: context_pb2.RELATIONSHIP_TYPE_TEAM_MEMBER,
            self.STAKEHOLDER: context_pb2.RELATIONSHIP_TYPE_STAKEHOLDER,
            self.CLIENT: context_pb2.RELATIONSHIP_TYPE_CLIENT,
            self.VENDOR: context_pb2.RELATIONSHIP_TYPE_VENDOR
        }
        return type_map[self]

@pydantic_dataclass
class ProjectContext:
    """Project context information with comprehensive validation."""
    project_id: str
    project_name: str
    status: ProjectStatus
    relevance_score: float = Field(ge=MIN_CONFIDENCE_SCORE, le=MAX_CONFIDENCE_SCORE)
    key_terms: List[str]
    attributes: Dict[str, str] = field(default_factory=dict)
    last_updated: Optional[datetime] = None

    def validate(self) -> bool:
        """Validate project context according to business rules."""
        if not self.project_id or not uuid.UUID(self.project_id, version=4):
            raise ValueError("Invalid project_id format")
        
        if not self.project_name or len(self.project_name.strip()) == 0:
            raise ValueError("Project name cannot be empty")
            
        if not self.key_terms or len(self.key_terms) == 0:
            raise ValueError("At least one key term is required")
            
        if self.last_updated and self.last_updated > datetime.utcnow():
            raise ValueError("Last updated timestamp cannot be in the future")
            
        return True

    def to_proto(self) -> context_pb2.ProjectContext:
        """Convert to protocol buffer message."""
        proto = context_pb2.ProjectContext()
        proto.project_id = self.project_id
        proto.project_name = self.project_name
        proto.status = self.status.to_proto()
        proto.relevance_score = self.relevance_score
        proto.key_terms.extend(self.key_terms)
        proto.attributes.update(self.attributes)
        
        if self.last_updated:
            timestamp = Timestamp()
            timestamp.FromDatetime(self.last_updated)
            proto.deadline.CopyFrom(timestamp)
            
        return proto

    @classmethod
    def from_proto(cls, proto: context_pb2.ProjectContext) -> 'ProjectContext':
        """Create instance from protocol buffer message."""
        last_updated = None
        if proto.HasField('deadline'):
            last_updated = proto.deadline.ToDatetime()
            
        return cls(
            project_id=proto.project_id,
            project_name=proto.project_name,
            status=ProjectStatus.from_proto(proto.status),
            relevance_score=proto.relevance_score,
            key_terms=list(proto.key_terms),
            attributes=dict(proto.attributes),
            last_updated=last_updated
        )

@pydantic_dataclass
class RelationshipContext:
    """Relationship mapping context with validation."""
    person_id: str
    email_address: str
    name: str
    type: RelationshipType
    interaction_frequency: float = Field(ge=0.0, le=1.0)
    last_interaction: datetime
    sentiment_metrics: Dict[str, float]
    additional_attributes: Optional[Dict[str, str]] = None

    def validate(self) -> bool:
        """Validate relationship context data."""
        if not EMAIL_REGEX.match(self.email_address):
            raise ValueError("Invalid email address format")
            
        if self.interaction_frequency < 0.0 or self.interaction_frequency > 1.0:
            raise ValueError("Interaction frequency must be between 0 and 1")
            
        if self.last_interaction > datetime.utcnow():
            raise ValueError("Last interaction cannot be in the future")
            
        for metric, value in self.sentiment_metrics.items():
            if value < -1.0 or value > 1.0:
                raise ValueError(f"Invalid sentiment value for metric {metric}")
                
        return True

    def to_proto(self) -> context_pb2.RelationshipContext:
        """Convert to protocol buffer message."""
        proto = context_pb2.RelationshipContext()
        proto.person_id = self.person_id
        proto.email_address = self.email_address
        proto.name = self.name
        proto.type = self.type.to_proto()
        proto.interaction_frequency = self.interaction_frequency
        
        timestamp = Timestamp()
        timestamp.FromDatetime(self.last_interaction)
        proto.last_interaction.CopyFrom(timestamp)
        
        proto.sentiment_metrics.update(self.sentiment_metrics)
        if self.additional_attributes:
            proto.communication_preferences.update(self.additional_attributes)
            
        return proto

    @classmethod
    def from_proto(cls, proto: context_pb2.RelationshipContext) -> 'RelationshipContext':
        """Create instance from protocol buffer message."""
        return cls(
            person_id=proto.person_id,
            email_address=proto.email_address,
            name=proto.name,
            type=RelationshipType.from_proto(proto.type),
            interaction_frequency=proto.interaction_frequency,
            last_interaction=proto.last_interaction.ToDatetime(),
            sentiment_metrics=dict(proto.sentiment_metrics),
            additional_attributes=dict(proto.communication_preferences)
        )

@pydantic_dataclass
class Context:
    """Main context class with comprehensive validation."""
    context_id: str
    email_id: str
    thread_id: str
    project_contexts: List[ProjectContext]
    relationship_contexts: List[RelationshipContext]
    topics: List[str]
    confidence_score: float = Field(ge=MIN_CONFIDENCE_SCORE, le=MAX_CONFIDENCE_SCORE)
    analyzed_at: datetime
    metadata: Dict[str, str]
    extended_attributes: Optional[Dict[str, Any]] = None

    def validate(self) -> bool:
        """Validate context object according to business rules."""
        # Validate IDs
        if not uuid.UUID(self.context_id, version=4):
            raise ValueError("Invalid context_id format")
            
        if not uuid.UUID(self.email_id, version=4):
            raise ValueError("Invalid email_id format")
            
        # Validate topics
        if len(self.topics) > MAX_TOPICS:
            raise ValueError(f"Maximum of {MAX_TOPICS} topics allowed")
            
        # Validate metadata
        for field in REQUIRED_METADATA_FIELDS:
            if field not in self.metadata:
                raise ValueError(f"Required metadata field {field} missing")
                
        # Validate nested contexts
        for project_context in self.project_contexts:
            project_context.validate()
            
        for relationship_context in self.relationship_contexts:
            relationship_context.validate()
            
        # Validate timestamp
        if self.analyzed_at > datetime.utcnow():
            raise ValueError("Analysis timestamp cannot be in the future")
            
        return True

    def to_proto(self) -> context_pb2.Context:
        """Convert to protocol buffer message."""
        proto = context_pb2.Context()
        proto.context_id = self.context_id
        proto.email_id = self.email_id
        proto.thread_id = self.thread_id
        
        # Convert nested contexts
        proto.project_contexts.extend([pc.to_proto() for pc in self.project_contexts])
        proto.relationship_contexts.extend([rc.to_proto() for rc in self.relationship_contexts])
        
        proto.topics.extend(self.topics)
        proto.confidence_score = self.confidence_score
        
        timestamp = Timestamp()
        timestamp.FromDatetime(self.analyzed_at)
        proto.analyzed_at.CopyFrom(timestamp)
        
        proto.metadata.update(self.metadata)
        
        if self.extended_attributes:
            for key, value in self.extended_attributes.items():
                if isinstance(value, (str, int, float, bool)):
                    proto.metadata[f"ext_{key}"] = str(value)
                    
        return proto

    @classmethod
    def from_proto(cls, proto: context_pb2.Context) -> 'Context':
        """Create instance from protocol buffer message."""
        # Extract extended attributes
        extended_attributes = {}
        metadata = dict(proto.metadata)
        ext_keys = [k for k in metadata.keys() if k.startswith("ext_")]
        
        for key in ext_keys:
            extended_attributes[key[4:]] = metadata[key]
            del metadata[key]
            
        return cls(
            context_id=proto.context_id,
            email_id=proto.email_id,
            thread_id=proto.thread_id,
            project_contexts=[ProjectContext.from_proto(pc) for pc in proto.project_contexts],
            relationship_contexts=[RelationshipContext.from_proto(rc) for rc in proto.relationship_contexts],
            topics=list(proto.topics),
            confidence_score=proto.confidence_score,
            analyzed_at=proto.analyzed_at.ToDatetime(),
            metadata=metadata,
            extended_attributes=extended_attributes
        )