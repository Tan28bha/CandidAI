from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.interview import InterviewSession, InterviewTurn
from app.models.profile import CandidateProfile
from app.models.user import User
from app.schemas.interview import AnswerCreate, AnswerResult, InterviewCreate, InterviewDetail, InterviewResponse
from app.services.interview_engine import evaluate_answer, question_for
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.schemas.user import Token, UserLogin, UserRegister, UserResponse
from app.utils.security import create_access_token, hash_password, verify_password

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


def get_owned_interview(interview_id: str, current_user: User, db: Session) -> InterviewSession:
    interview = (
        db.query(InterviewSession)
        .options(selectinload(InterviewSession.turns))
        .filter(InterviewSession.id == interview_id, InterviewSession.user_id == current_user.id)
        .first()
    )
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
    return interview


def question_limit(duration_minutes: int) -> int:
    return 3 if duration_minutes <= 30 else 4 if duration_minutes <= 60 else 5


@router.get("/interviews/{interview_id}", response_model=InterviewDetail)
def get_interview(interview_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_interview(interview_id, current_user, db)


@router.post("/interviews/{interview_id}/start", response_model=InterviewDetail)
def start_interview(interview_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    interview = get_owned_interview(interview_id, current_user, db)
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
    interview = get_owned_interview(interview_id, current_user, db)
    if interview.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Start this interview before submitting an answer")
    current_turn = next((turn for turn in sorted(interview.turns, key=lambda item: item.turn_number) if not turn.answer), None)
    if not current_turn:
        raise HTTPException(status_code=409, detail="There is no question awaiting an answer")

    current_turn.answer = payload.answer.strip()
    current_turn.score, current_turn.feedback = evaluate_answer(current_turn.answer)
    next_turn = None
    if current_turn.turn_number >= question_limit(interview.duration_minutes):
        interview.status = "COMPLETED"
    else:
        number = current_turn.turn_number + 1
        next_turn = InterviewTurn(session_id=interview.id, turn_number=number, question=question_for(interview, number))
        db.add(next_turn)
    db.commit()
    refreshed = get_owned_interview(interview_id, current_user, db)
    next_question = next((turn for turn in refreshed.turns if turn.answer is None), None)
    return AnswerResult(session=refreshed, next_question=next_question)
