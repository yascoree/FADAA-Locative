from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordVerifyRequest(BaseModel):
    password: str


class PasswordVerifyResponse(BaseModel):
    valid: bool
