"""
Admin authentication với hardcode credentials + JWT
"""
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
import os
import hashlib

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
JWT_SECRET = os.getenv("JWT_SECRET", "museai-secret-2026")

def hash_password(password: str) -> str:
    """Hash password bằng SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(username: str) -> str:
    """Tạo JWT token"""
    return jwt.encode({"sub": username}, JWT_SECRET, algorithm="HS256")

def verify_token(authorization: str = Header(...)):
    """Verify JWT token từ Authorization header"""
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
