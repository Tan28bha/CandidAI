from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import TokenPayload

# Setup OAuth2 token scheme bearer reader
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


def _decode_token(token: str) -> TokenPayload:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        if token_data.sub is None:
            raise credentials_exception
        return token_data
    except (JWTError, ValidationError):
        raise credentials_exception


def get_user_from_token(token: str, db: Session) -> User:
    token_data = _decode_token(token)
    user = db.query(User).filter(User.id == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return user


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Decodes the JWT access token and fetches the authenticated user from the database.
    Raises 401 HTTP exception if token is invalid or expired.
    """
    return get_user_from_token(token, db)
