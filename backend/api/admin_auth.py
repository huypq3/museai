"""
Admin authentication endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sys
sys.path.append('..')
from auth.admin import ADMIN_USERNAME, ADMIN_PASSWORD_HASH, hash_password, create_token

router = APIRouter(prefix="/admin/auth", tags=["admin"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
async def login(body: LoginRequest):
    """Login với username/password, trả về JWT token"""
    if body.username != ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if hash_password(body.password) != ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(body.username)
    return {"token": token, "username": body.username}
