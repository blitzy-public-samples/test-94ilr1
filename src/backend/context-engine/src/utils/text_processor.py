"""
Advanced text processing utility module for Context Engine service.
Provides high-accuracy text analysis capabilities with performance optimizations.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

import logging
import re
from typing import Dict, List, Set, Any, Tuple, Optional
from collections import OrderedDict
import spacy  # version: 3.7.0
import nltk  # version: 3.8.1
import numpy as np  # version: 1.24.0
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

from ..models.context import Context, ProjectContext

# Global constants
STOP_WORDS: Set[str] = spacy.load('en_core_web_sm').Defaults.stop_words
EMAIL_PATTERN = re.compile(r'[\w\.-]+@[\w\.-]+')
URL_PATTERN = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
MIN_WORD_LENGTH = 3
CONFIDENCE_THRESHOLD = 0.85
CACHE_MAX_SIZE = 1000
CACHE_TTL = 3600  # 1 hour in seconds

class TextAnalyzer:
    """
    Advanced text analysis class implementing high-accuracy text processing capabilities
    with caching and performance optimizations.
    """
    
    def __init__(self, model_name: str = 'en_core_web_lg', enable_cache: bool = True):
        """
        Initialize text analyzer with required NLP models and components.
        
        Args:
            model_name: Name of the spaCy model to load
            enable_cache: Whether to enable result caching
        """
        # Configure logging
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)
        
        # Initialize NLP model
        try:
            self._nlp_model = spacy.load(model_name)
            self._logger.info(f"Loaded spaCy model: {model_name}")
        except OSError as e:
            self._logger.error(f"Failed to load spaCy model: {e}")
            raise
            
        # Initialize cache if enabled
        self._cache = OrderedDict() if enable_cache else None
        
        # Initialize NLTK resources
        try:
            nltk.download('punkt', quiet=True)
            nltk.download('stopwords', quiet=True)
            nltk.download('wordnet', quiet=True)
            nltk.download('averaged_perceptron_tagger', quiet=True)
        except Exception as e:
            self._logger.error(f"Failed to download NLTK resources: {e}")
            raise
            
        # Initialize performance metrics
        self._accuracy_metrics = {
            'entity_extraction': 0.0,
            'keyword_extraction': 0.0,
            'semantic_analysis': 0.0
        }

    def preprocess_text(self, text: str, preserve_case: bool = False) -> str:
        """
        Preprocess raw email text for analysis with enhanced validation.
        
        Args:
            text: Raw input text
            preserve_case: Whether to preserve original case
            
        Returns:
            Preprocessed text ready for analysis
        """
        if not text or len(text.strip()) == 0:
            raise ValueError("Input text cannot be empty")
            
        # Remove email addresses and URLs
        text = EMAIL_PATTERN.sub(' ', text)
        text = URL_PATTERN.sub(' ', text)
        
        # Convert to lowercase if not preserving case
        if not preserve_case:
            text = text.lower()
            
        # Remove special characters and normalize whitespace
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove stop words
        words = text.split()
        words = [w for w in words if w not in STOP_WORDS and len(w) >= MIN_WORD_LENGTH]
        
        # Apply text normalization
        lemmatizer = WordNetLemmatizer()
        words = [lemmatizer.lemmatize(word) for word in words]
        
        return ' '.join(words)

    def extract_entities(self, text: str, confidence_threshold: float = CONFIDENCE_THRESHOLD) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extract named entities with confidence scoring and relationship mapping.
        
        Args:
            text: Preprocessed text
            confidence_threshold: Minimum confidence score threshold
            
        Returns:
            Dictionary of entity types with confidence scores and relationships
        """
        # Check cache first
        cache_key = f"entities_{hash(text)}"
        if self._cache is not None and cache_key in self._cache:
            return self._cache[cache_key]
            
        # Process text with spaCy
        doc = self._nlp_model(text)
        
        entities = {}
        for ent in doc.ents:
            if ent.label_ not in entities:
                entities[ent.label_] = []
                
            # Calculate confidence score
            confidence = self._calculate_entity_confidence(ent)
            
            if confidence >= confidence_threshold:
                entity_info = {
                    'text': ent.text,
                    'start': ent.start_char,
                    'end': ent.end_char,
                    'confidence': confidence,
                    'relationships': self._extract_entity_relationships(ent, doc)
                }
                entities[ent.label_].append(entity_info)
                
        # Update cache
        if self._cache is not None:
            self._cache[cache_key] = entities
            if len(self._cache) > CACHE_MAX_SIZE:
                self._cache.popitem(last=False)
                
        return entities

    def extract_keywords(self, text: str, top_n: int = 10, use_phrases: bool = True) -> List[Tuple[str, float]]:
        """
        Extract key terms and phrases using advanced TF-IDF and semantic analysis.
        
        Args:
            text: Preprocessed text
            top_n: Number of top keywords to return
            use_phrases: Whether to include multi-word phrases
            
        Returns:
            List of keywords/phrases with relevance scores
        """
        # Check cache
        cache_key = f"keywords_{hash(text)}_{top_n}_{use_phrases}"
        if self._cache is not None and cache_key in self._cache:
            return self._cache[cache_key]
            
        doc = self._nlp_model(text)
        
        # Extract candidate terms
        candidates = []
        for token in doc:
            if token.is_stop or token.is_punct or len(token.text) < MIN_WORD_LENGTH:
                continue
                
            # Calculate term importance
            importance = token.vector_norm * token.prob
            candidates.append((token.text, importance))
            
        if use_phrases:
            # Extract noun phrases
            for chunk in doc.noun_chunks:
                if len(chunk.text.split()) > 1:
                    importance = np.mean([t.vector_norm * t.prob for t in chunk])
                    candidates.append((chunk.text, importance))
                    
        # Sort and filter results
        keywords = sorted(candidates, key=lambda x: x[1], reverse=True)[:top_n]
        
        # Update cache
        if self._cache is not None:
            self._cache[cache_key] = keywords
            if len(self._cache) > CACHE_MAX_SIZE:
                self._cache.popitem(last=False)
                
        return keywords

    def analyze_semantic_structure(self, text: str, include_dependencies: bool = True) -> Dict[str, Any]:
        """
        Perform comprehensive semantic analysis with relationship extraction.
        
        Args:
            text: Preprocessed text
            include_dependencies: Whether to include dependency parsing
            
        Returns:
            Detailed semantic analysis results
        """
        # Check cache
        cache_key = f"semantic_{hash(text)}_{include_dependencies}"
        if self._cache is not None and cache_key in self._cache:
            return self._cache[cache_key]
            
        doc = self._nlp_model(text)
        
        analysis = {
            'main_topics': self._extract_main_topics(doc),
            'sentiment': self._analyze_sentiment(doc),
            'key_phrases': self._extract_key_phrases(doc),
            'relationships': self._extract_semantic_relationships(doc)
        }
        
        if include_dependencies:
            analysis['dependencies'] = self._extract_dependencies(doc)
            
        # Calculate overall confidence
        analysis['confidence_score'] = self._calculate_semantic_confidence(analysis)
        
        # Update cache
        if self._cache is not None:
            self._cache[cache_key] = analysis
            if len(self._cache) > CACHE_MAX_SIZE:
                self._cache.popitem(last=False)
                
        return analysis

    def _calculate_entity_confidence(self, entity) -> float:
        """Calculate confidence score for an extracted entity."""
        # Implement sophisticated confidence scoring
        base_score = 0.5
        modifiers = {
            'length': min(len(entity.text.split()) / 5, 0.2),
            'frequency': min(entity.root.prob * 2, 0.2),
            'context': min(len(list(entity.root.children)) / 10, 0.1)
        }
        return min(base_score + sum(modifiers.values()), 1.0)

    def _extract_entity_relationships(self, entity, doc) -> List[Dict[str, Any]]:
        """Extract relationships between entities."""
        relationships = []
        for token in entity.root.children:
            if token.dep_ in ('nsubj', 'dobj', 'pobj'):
                relationships.append({
                    'type': token.dep_,
                    'text': token.text,
                    'confidence': self._calculate_entity_confidence(token)
                })
        return relationships

    def _extract_main_topics(self, doc) -> List[Dict[str, Any]]:
        """Extract main topics from document."""
        topics = []
        for sent in doc.sents:
            for token in sent:
                if token.pos_ in ('NOUN', 'PROPN') and not token.is_stop:
                    topics.append({
                        'text': token.text,
                        'importance': token.vector_norm * token.prob,
                        'sentence_position': token.i / len(doc)
                    })
        return sorted(topics, key=lambda x: x['importance'], reverse=True)

    def _analyze_sentiment(self, doc) -> Dict[str, float]:
        """Analyze sentiment of the document."""
        return {
            'polarity': doc.sentiment,
            'subjectivity': np.mean([t.prob for t in doc if t.pos_ == 'ADJ'])
        }

    def _extract_key_phrases(self, doc) -> List[Dict[str, Any]]:
        """Extract key phrases with context."""
        phrases = []
        for chunk in doc.noun_chunks:
            if len(chunk.text.split()) > 1:
                phrases.append({
                    'text': chunk.text,
                    'root': chunk.root.text,
                    'importance': chunk.root.vector_norm
                })
        return sorted(phrases, key=lambda x: x['importance'], reverse=True)

    def _extract_semantic_relationships(self, doc) -> List[Dict[str, Any]]:
        """Extract semantic relationships between elements."""
        relationships = []
        for token in doc:
            if token.dep_ not in ('punct', 'det'):
                relationships.append({
                    'source': token.text,
                    'target': token.head.text,
                    'type': token.dep_,
                    'confidence': token.prob
                })
        return relationships

    def _extract_dependencies(self, doc) -> List[Dict[str, Any]]:
        """Extract syntactic dependencies."""
        return [{
            'source': token.text,
            'target': token.head.text,
            'type': token.dep_,
            'pos': token.pos_
        } for token in doc if token.dep_ != 'punct']

    def _calculate_semantic_confidence(self, analysis: Dict[str, Any]) -> float:
        """Calculate overall confidence score for semantic analysis."""
        weights = {
            'topics': 0.3,
            'sentiment': 0.2,
            'phrases': 0.25,
            'relationships': 0.25
        }
        
        scores = {
            'topics': min(len(analysis['main_topics']) / 10, 1.0),
            'sentiment': abs(analysis['sentiment']['polarity']),
            'phrases': min(len(analysis['key_phrases']) / 15, 1.0),
            'relationships': min(len(analysis['relationships']) / 20, 1.0)
        }
        
        return sum(weights[k] * scores[k] for k in weights)