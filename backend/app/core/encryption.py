import base64
import hashlib
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    """
    Derives a 32-byte URL-safe base64 key from the application secret
    to instantiate a Fernet symmetric encryption cipher.
    """
    raw_key = getattr(settings, "CALENDAR_ENCRYPTION_KEY", None) or settings.JWT_SECRET_KEY
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    b64_key = base64.urlsafe_b64encode(digest)
    return Fernet(b64_key)


def encrypt_token(plain_token: Optional[str]) -> Optional[str]:
    """
    Encrypts a token (such as a Google OAuth refresh token) at rest.
    Returns None if input is empty.
    """
    if not plain_token:
        return None
    try:
        cipher = _get_fernet()
        return cipher.encrypt(plain_token.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error(f"[Encryption] Failed to encrypt token: {e}")
        raise ValueError("Failed to securely encrypt credential") from e


def decrypt_token(encrypted_token: Optional[str]) -> Optional[str]:
    """
    Decrypts an encrypted token at rest.
    Returns None if input is empty or decryption fails.
    """
    if not encrypted_token:
        return None
    try:
        cipher = _get_fernet()
        return cipher.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("[Encryption] Invalid ciphertext or mismatched encryption key.")
        return None
    except Exception as e:
        logger.error(f"[Encryption] Decryption error: {e}")
        return None
