import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

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
from app.services.experience_agent import design_interview_experience
from app.services.resume_service import extract_text_from_pdf, chunk_text, generate_embeddings_for_chunks, save_resume_chunks
from app.services.resume_agents import extract_resume_without_llm, run_resume_analysis_agents
from app.llm.provider import llm_available
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
            analysis = run_resume_analysis_agents(text)
            extracted = analysis["profile"]
            
            if extracted.get("current_title"):
                profile.current_title = extracted["current_title"]
            if isinstance(extracted.get("years_of_experience"), int):
                profile.years_of_experience = extracted["years_of_experience"]
            if isinstance(extracted.get("skills"), list):
                profile.skills = [str(s) for s in extracted["skills"]]
            if extracted.get("bio"):
                profile.bio = extracted["bio"]
                
            if analysis.get("interview_plan"):
                profile.interview_plan = analysis["interview_plan"]
                
            db.commit()
            db.refresh(profile)
        except Exception as exc:
            logger.warning("Failed to auto-enrich candidate profile from resume: %s", exc)
    else:
        heuristic = extract_resume_without_llm(text)
        if heuristic.get("skills"):
            profile.skills = heuristic["skills"]
        if heuristic.get("bio") and not profile.bio:
            profile.bio = heuristic["bio"]
        profile.interview_plan = {
            "suggested_role": profile.current_title or "Software Engineer",
            "suggested_difficulty": "mid",
            "recommended_focus_areas": heuristic.get("skills", [])[:4],
            "tailored_questions": [],
            "projects": [],
            "experience": design_interview_experience(
                interview_type="technical",
                target_role=profile.current_title or "Software Engineer",
                difficulty="mid",
                focus_areas=heuristic.get("skills") or [],
            ),
        }
        db.commit()
        db.refresh(profile)
            
    return profile




@router.post("/interviews", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
def create_interview(payload: InterviewCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    data = payload.model_dump()
    
    # Enrich session using Architect Agent suggestions if available
    if profile and profile.interview_plan and isinstance(profile.interview_plan, dict):
        plan = profile.interview_plan
        recommended_focus = plan.get("recommended_focus_areas") or []
        if recommended_focus:
            data["focus_areas"] = list(set(data.get("focus_areas", []) + recommended_focus))
            
        if plan.get("suggested_difficulty") and (data.get("difficulty") == "mid" or not data.get("difficulty")):
            data["difficulty"] = plan["suggested_difficulty"]
            
        if plan.get("suggested_role") and (data.get("target_role") == "Software Engineer" or not data.get("target_role")):
            data["target_role"] = plan["suggested_role"]

    interview = InterviewSession(user_id=current_user.id, **data)
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
