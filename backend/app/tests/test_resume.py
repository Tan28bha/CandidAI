import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.user import User
from app.models.interview import InterviewSession, InterviewTurn
from app.models.profile import CandidateProfile, ResumeChunk

from app.services.resume_service import (
    chunk_text,
    cosine_similarity,
    extract_text_from_pdf,
    save_resume_chunks,
    search_matching_chunks,
)

# SQLite In-memory setup for service testing
@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def test_chunk_text_splits_correctly():
    text = "This is a sentence. And here is another sentence. We want to check chunk size splits."
    chunks = chunk_text(text, chunk_size=20, overlap=5)
    assert len(chunks) > 1
    # Check overlapping segments
    for chunk in chunks:
        assert len(chunk) <= 20


def test_chunk_text_empty_input():
    assert chunk_text("") == []
    assert chunk_text(None) == []


def test_cosine_similarity_edge_cases():
    v1 = [1.0, 0.0, 1.0]
    v2 = [1.0, 0.0, 1.0]
    assert pytest.approx(cosine_similarity(v1, v2), 0.0001) == 1.0

    v3 = [0.0, 1.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v3), 0.0001) == 0.0

    # Zero vectors
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_extract_text_from_pdf_calls_pypdf():
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Extracted PDF resume page text details."
    
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]
    
    with patch("app.services.resume_service.PdfReader", return_value=mock_reader):
        text = extract_text_from_pdf(b"dummy_pdf_bytes")
        assert "Extracted PDF resume" in text
        mock_page.extract_text.assert_called_once()


def test_save_and_search_resume_chunks(db_session):
    # 1. Create a dummy CandidateProfile
    profile_id = uuid.uuid4()
    profile = CandidateProfile(
        id=profile_id,
        user_id=uuid.uuid4(),
        current_title="Software Engineer"
    )
    db_session.add(profile)
    db_session.commit()

    # 2. Define chunks and mock embeddings
    # Chunk A is React focused, Chunk B is Python focused
    chunks = [
        "React Frontend developer building UI components",
        "Python Backend engineer design databases APIs"
    ]
    # Simple mock embeddings (length 768)
    emb_a = [1.0] + [0.0] * 767
    emb_b = [0.0] + [1.0] * 767
    embeddings = [emb_a, emb_b]

    # Save to db
    save_resume_chunks(db_session, profile_id, chunks, embeddings)

    # Verify chunks are stored
    stored_chunks = db_session.query(ResumeChunk).filter(ResumeChunk.candidate_profile_id == profile_id).all()
    assert len(stored_chunks) == 2

    # 3. Search matching chunks
    # We mock get_embeddings_model or generate_single_embedding
    # For query "React component", we mock it to return emb_a like query vector
    with patch("app.services.resume_service.generate_single_embedding", return_value=emb_a):
        matched = search_matching_chunks(db_session, profile_id, "React components", limit=1)
        assert len(matched) == 1
        assert "React Frontend" in matched[0]

    # For query "Python API", we mock it to return emb_b like query vector
    with patch("app.services.resume_service.generate_single_embedding", return_value=emb_b):
        matched = search_matching_chunks(db_session, profile_id, "Python databases", limit=1)
        assert len(matched) == 1
        assert "Python Backend" in matched[0]
