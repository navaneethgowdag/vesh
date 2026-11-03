from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: Optional[str] = None
    username: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    display_name: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    location: Optional[str] = None


class GoogleAuthUrlResponse(BaseModel):
    authorization_url: str
    state: str


class GoogleExchangeRequest(BaseModel):
    ticket: str


class GoogleExchangeResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    destination: Optional[str] = "/home"
    is_new_user: Optional[bool] = False


class GoogleLinkRequest(BaseModel):
    username_or_email: str
    password: str
    id_token: Optional[str] = None
    code: Optional[str] = None


class GoogleStatusResponse(BaseModel):
    is_google_linked: bool
    identities: list = Field(default_factory=list)

