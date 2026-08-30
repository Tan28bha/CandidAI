import io
import math
import logging
from typing import List, Tuple
from uuid import UUID
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.profile import ResumeChunk, CandidateProfile

logger = logging.getLogger("resume_service")

# Initialize embeddings model lazily if key is available
_embeddings_model = None

def get_embeddings_model():
    global _embeddings_model
    if _embeddings_model is None:
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not configured. Embeddings will not be generated via LLM.")
            return None
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            _embeddings_model = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=settings.GEMINI_API_KEY
            )
        except Exception as exc:
            logger.error("Failed to initialize GoogleGenerativeAIEmbeddings: %s", exc)
            return None
    return _embeddings_model


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text content from raw PDF bytes."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return "\n".join(text_parts)
    except Exception as exc:
        logger.error("Error reading PDF: %s", exc)
        raise ValueError("Invalid PDF file structure or reading failed") from exc


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    """Split text into overlapping chunks of roughly chunk_size characters."""
    if not text:
        return []
    
    # Normalize whitespace
    text = " ".join(text.split())
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        # Try to find sentence end or space near the end to split cleanly
        if end < text_len:
            last_space = text.rfind(" ", start, end)
            if last_space != -1 and last_space > start + (chunk_size // 2):
                end = last_space
        
        chunks.append(text[start:end].strip())
        start = end - overlap if end < text_len else text_len
        if start >= text_len or end >= text_len:
            break
            
    return [c for c in chunks if c]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(a * b for a, b in zip(v1, v2))
    m1 = math.sqrt(sum(a * a for a in v1))
    m2 = math.sqrt(sum(b * b for b in v2))
    if m1 == 0 or m2 == 0:
        return 0.0
    return dot / (m1 * m2)


def generate_embeddings_for_chunks(chunks: List[str]) -> List[List[float]]:
    """Generate 768-dimension embeddings for list of text chunks using Gemini."""
    model = get_embeddings_model()
    if not model or not chunks:
        # Fallback to zero vectors if model/API key not available
        return [[0.0] * 768 for _ in chunks]
    try:
        return model.embed_documents(chunks)
    except Exception as exc:
        logger.error("Error generating embeddings from Gemini: %s", exc)
        # Return zero vectors to allow graceful degradation
        return [[0.0] * 768 for _ in chunks]


def generate_single_embedding(text: str) -> List[float]:
    """Generate 768-dimension embedding for a single query text."""
    model = get_embeddings_model()
    if not model or not text:
        return [0.0] * 768
    try:
        return model.embed_query(text)
    except Exception as exc:
        logger.error("Error generating single embedding: %s", exc)
        return [0.0] * 768


def save_resume_chunks(db: Session, profile_id: UUID, chunks: List[str], embeddings: List[List[float]]) -> None:
    """Clear old chunks and save new resume chunks with their embeddings to the DB."""
    # Delete existing resume chunks for this candidate
    db.query(ResumeChunk).filter(ResumeChunk.candidate_profile_id == profile_id).delete()
    db.commit()
    
    # Batch insert new chunks
    db_chunks = []
    for chunk, emb in zip(chunks, embeddings):
        db_chunk = ResumeChunk(
            candidate_profile_id=profile_id,
            chunk_text=chunk,
            embedding=emb
        )
        db.add(db_chunk)
    db.commit()


def search_matching_chunks(db: Session, profile_id: UUID, query_text: str, limit: int = 3) -> List[str]:
    """
    Search resume chunks matching the query text.
    Uses native pgvector distance sorting on Postgres and in-memory fallback on SQLite.
    """
    if not query_text:
        return []
        
    query_vector = generate_single_embedding(query_text)
    
    # Check DB dialect
    dialect_name = db.bind.dialect.name if db.bind else "sqlite"
    
    if dialect_name == "postgresql":
        try:
            # Query using pgvector cosine distance sorting
            # Note: cosine_distance is 1 - cosine_similarity
            results = (
                db.query(ResumeChunk)
                .filter(ResumeChunk.candidate_profile_id == profile_id)
                .order_by(ResumeChunk.embedding.cosine_distance(query_vector))
                .limit(limit)
                .all()
            )
            return [r.chunk_text for r in results]
        except Exception as exc:
            logger.error("PostgreSQL pgvector search failed, falling back to python search: %s", exc)
            # Fall back to Python sorting below

    # SQLite fallback (in-memory cosine similarity search)
    results = (
        db.query(ResumeChunk)
        .filter(ResumeChunk.candidate_profile_id == profile_id)
        .all()
    )
    if not results:
        return []
        
    # Calculate similarities in memory
    chunk_similarities: List[Tuple[float, str]] = []
    for chunk in results:
        sim = cosine_similarity(chunk.embedding, query_vector)
        chunk_similarities.append((sim, chunk.chunk_text))
        
    # Sort descending by similarity
    chunk_similarities.sort(key=lambda x: x[0], reverse=True)
    return [text for sim, text in chunk_similarities[:limit]]
