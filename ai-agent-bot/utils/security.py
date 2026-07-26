import hashlib
import hmac
import re
from datetime import datetime, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

from config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(user_id: str, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc).timestamp() + (
        (expires_minutes or settings.jwt_expire_minutes) * 60
    )
    payload = {"sub": user_id, "exp": expire, "iat": datetime.now(timezone.utc).timestamp()}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def mask_token(token: str) -> str:
    if not token or len(token) < 8:
        return "****"
    return f"{token[:4]}...{token[-4:]}"


def mask_api_key(key: str) -> str:
    if not key or len(key) < 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def sanitize_input(text: str, max_length: int = 4096) -> str:
    if not text:
        return ""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text[:max_length]


def is_admin(user_id: int) -> bool:
    return user_id in settings.admin_list


def is_owner(user_id: int) -> bool:
    return user_id == settings.owner
