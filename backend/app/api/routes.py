import json
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from langchain_core.messages import SystemMessage, HumanMessage

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.interview import InterviewSession, InterviewTurn
from app.models.profile import CandidateProfile
from app.models.user import User
from app.schemas.interview import AnswerCreate, AnswerResult, InterviewCreate, InterviewDetail, InterviewResponse
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.schemas.user import Token, UserLogin, UserRegister, UserResponse
from app.services.interview_engine import question_for
from app.services.interview_helpers import get_owned_interview, submit_turn
from app.services.resume_service import extract_text_from_pdf, chunk_text, generate_embeddings_for_chunks, save_resume_chunks
from app.llm.provider import get_chat_model, llm_available
from app.utils.security import create_access_token, hash_password, verify_password

logger = logging.getLogger("routes")


router = APIRouter()


@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.flush()
    db.add(CandidateProfile(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    token = create_access_token(user.id, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    return Token(access_token=token)


@router.get("/auth/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).one()


@router.put("/profile", response_model=ProfileResponse)
def update_profile(payload: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).one()
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/profile/resume", response_model=ProfileResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    filename = file.filename.lower()
    
    if filename.endswith(".pdf"):
        try:
            text = extract_text_from_pdf(contents)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    elif filename.endswith(".txt"):
        try:
            text = contents.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = contents.decode("latin-1")
            except Exception:
                raise HTTPException(status_code=400, detail="Unable to decode text file")
    else:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file contains no readable text")
        
    chunks = chunk_text(text)
    embeddings = generate_embeddings_for_chunks(chunks)
    
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).one()
    save_resume_chunks(db, profile.id, chunks, embeddings)
    
    if llm_available():
        try:
            llm = get_chat_model()
            system_prompt = (
                "You are an expert resume parser. Analyze the resume text and extract the candidate's professional profile.\n"
                "Provide the result as a raw JSON object containing these keys (use null or empty list if not found):\n"
                " - current_title: string (e.g. 'Senior Frontend Engineer')\n"
                " - years_of_experience: integer (e.g. 5)\n"
                " - skills: list of strings (e.g. ['React', 'TypeScript', 'Node.js'])\n"
                " - bio: string (a short professional summary, maximum 150 words)\n"
                "Return ONLY the raw JSON object, without markdown formatting or code blocks."
            )
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Resume Text:\n{text[:8000]}")
            ])
            raw_content = response.content.strip()
            if raw_content.startswith("```json"):
                raw_content = raw_content[7:]
            if raw_content.startswith("```"):
                raw_content = raw_content[3:]
            if raw_content.endswith("```"):
                raw_content = raw_content[:-3]
            raw_content = raw_content.strip()
            
            extracted = json.loads(raw_content)
            
            if isinstance(extracted, dict):
                if extracted.get("current_title"):
                    profile.current_title = extracted["current_title"]
                if isinstance(extracted.get("years_of_experience"), int):
                    profile.years_of_experience = extracted["years_of_experience"]
                if isinstance(extracted.get("skills"), list):
                    profile.skills = [str(s) for s in extracted["skills"]]
                if extracted.get("bio"):
                    profile.bio = extracted["bio"]
                    
                db.commit()
                db.refresh(profile)
        except Exception as exc:
            logger.warning("Failed to auto-enrich candidate profile from resume: %s", exc)
            
    return profile



@router.post("/interviews", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
def create_interview(payload: InterviewCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    interview = InterviewSession(user_id=current_user.id, **payload.model_dump())
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.get("/interviews", response_model=list[InterviewResponse])
def list_interviews(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )


@router.get("/interviews/{interview_id}", response_model=InterviewDetail)
def get_interview(interview_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return get_owned_interview(interview_id, current_user, db)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")


@router.post("/interviews/{interview_id}/start", response_model=InterviewDetail)
def start_interview(interview_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        interview = get_owned_interview(interview_id, current_user, db)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
    if interview.status == "COMPLETED":
        raise HTTPException(status_code=409, detail="This interview is already complete")
    if not interview.turns:
        interview.status = "ACTIVE"
        db.add(InterviewTurn(session_id=interview.id, turn_number=1, question=question_for(interview, 1)))
        db.commit()
    return get_owned_interview(interview_id, current_user, db)


@router.post("/interviews/{interview_id}/answers", response_model=AnswerResult)
def submit_answer(
    interview_id: str,
    payload: AnswerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        interview = get_owned_interview(interview_id, current_user, db)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    try:
        _, _, _, new_turn = submit_turn(interview, payload.answer)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    if new_turn:
        db.add(new_turn)
    db.commit()
    refreshed = get_owned_interview(interview_id, current_user, db)
    next_question = next((turn for turn in refreshed.turns if turn.answer is None), None)
    return AnswerResult(session=refreshed, next_question=next_question)
