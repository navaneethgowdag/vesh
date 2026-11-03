import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import inspect, or_

from app.models.user import User
from app.models.user_identity import UserIdentity
from app.models.learned_preference import LearnedPreference

logger = logging.getLogger(__name__)

IDENTITIES_KEY = "_oauth_identities"


class UserIdentityService:
    """
    Manages OAuth provider identities (Google, etc.) and accounts linking.
    Supports physical user_identities table, with seamless JSONB fallback
    in LearnedPreference for restricted database permission environments.
    """

    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_table_exists()

    def _check_table_exists(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            return "user_identities" in insp.get_table_names()
        except Exception:
            return False

    def find_user_by_provider_sub(self, provider: str, provider_user_id: str) -> Optional[User]:
        """Look up user by OAuth provider and stable subject ID."""
        pid_str = str(provider_user_id).strip()
        provider_clean = provider.strip().lower()

        if self._has_table:
            try:
                ident = (
                    self.db.query(UserIdentity)
                    .filter(
                        UserIdentity.provider == provider_clean,
                        or_(
                            UserIdentity.provider_subject == pid_str,
                            UserIdentity.provider_user_id == pid_str,
                        ),
                    )
                    .first()
                )
                if ident:
                    return self.db.query(User).filter(User.id == ident.user_id).first()
            except Exception as e:
                logger.warning(f"[UserIdentityService] Query table failed: {e}. Falling back.")

        # Fallback to JSONB storage in learned_preferences
        try:
            records = (
                self.db.query(LearnedPreference)
                .filter(LearnedPreference.weather_scores[IDENTITIES_KEY].isnot(None))
                .all()
            )
            for rec in records:
                ws = rec.weather_scores or {}
                identities = ws.get(IDENTITIES_KEY, [])
                for item in identities:
                    item_prov = (item.get("provider") or "").strip().lower()
                    item_sub = str(item.get("provider_subject") or item.get("provider_user_id") or "").strip()
                    if item_prov == provider_clean and item_sub == pid_str:
                        return self.db.query(User).filter(User.id == rec.user_id).first()
        except Exception as e:
            logger.error(f"[UserIdentityService] Query JSONB fallback failed: {e}")

        return None

    def is_identity_taken(self, provider: str, provider_user_id: str) -> bool:
        """Check whether this Google sub is already associated with any user."""
        return self.find_user_by_provider_sub(provider, provider_user_id) is not None

    def link_identity(
        self,
        user_id: UUID,
        provider: str,
        provider_user_id: str,
        email: Optional[str] = None,
        provider_subject: Optional[str] = None,
    ) -> None:
        """Link an OAuth identity to an existing user."""
        pid_str = str(provider_subject or provider_user_id).strip()
        provider_clean = provider.strip().lower()
        email_clean = email.strip().lower() if email else None

        # Enforce uniqueness across all users
        existing_owner = self.find_user_by_provider_sub(provider_clean, pid_str)
        if existing_owner and existing_owner.id != user_id:
            raise ValueError(f"This {provider} account is already linked to another user.")

        if self._has_table:
            try:
                # Check if already linked to this user
                existing = (
                    self.db.query(UserIdentity)
                    .filter(
                        UserIdentity.user_id == user_id,
                        UserIdentity.provider == provider_clean,
                        or_(
                            UserIdentity.provider_subject == pid_str,
                            UserIdentity.provider_user_id == pid_str,
                        ),
                    )
                    .first()
                )
                if not existing:
                    ident = UserIdentity(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        provider=provider_clean,
                        provider_user_id=pid_str,
                        provider_subject=pid_str,
                        verified_email=email_clean,
                    )
                    self.db.add(ident)
                    self.db.commit()
                    logger.info(f"[UserIdentityService] Linked {provider_clean} sub {pid_str} to user {user_id}")
                    return
                else:
                    updated = False
                    if not existing.provider_subject:
                        existing.provider_subject = pid_str
                        updated = True
                    if email_clean and not existing.verified_email:
                        existing.verified_email = email_clean
                        updated = True
                    if updated:
                        self.db.commit()
                    return
            except Exception as e:
                self.db.rollback()
                logger.warning(f"[UserIdentityService] Insert into table failed: {e}. Storing in JSONB.")

        # Dual/fallback persistence in learned_preferences
        try:
            record = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
            if not record:
                record = LearnedPreference(
                    user_id=user_id,
                    style_scores={},
                    color_scores={},
                    category_scores={},
                    fit_scores={},
                    pattern_scores={},
                    material_scores={},
                    occasion_scores={},
                    season_scores={},
                    weather_scores={},
                    confidence_score=0.1,
                    interaction_count=0,
                )
                self.db.add(record)
                self.db.flush()

            ws = dict(record.weather_scores) if isinstance(record.weather_scores, dict) else {}
            identities = list(ws.get(IDENTITIES_KEY, []))

            # Deduplicate or update
            already_present = False
            for item in identities:
                item_sub = str(item.get("provider_subject") or item.get("provider_user_id") or "").strip()
                if item.get("provider") == provider_clean and item_sub == pid_str:
                    already_present = True
                    item["provider_subject"] = pid_str
                    item["provider_user_id"] = pid_str
                    if email_clean:
                        item["verified_email"] = email_clean
                        item["email"] = email_clean
                    break

            if not already_present:
                identities.append({
                    "id": str(uuid.uuid4()),
                    "provider": provider_clean,
                    "provider_subject": pid_str,
                    "provider_user_id": pid_str,
                    "verified_email": email_clean,
                    "email": email_clean,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            ws[IDENTITIES_KEY] = identities
            record.weather_scores = ws
            self.db.commit()
            logger.info(f"[UserIdentityService] Linked {provider_clean} sub {pid_str} to user {user_id} in JSONB")
        except Exception as e:
            self.db.rollback()
            logger.error(f"[UserIdentityService] Failed to link identity: {e}")
            raise

    def get_identities_for_user(self, user_id: UUID) -> List[Dict[str, Any]]:
        """List all linked OAuth providers for a given user."""
        results = []
        if self._has_table:
            try:
                rows = self.db.query(UserIdentity).filter(UserIdentity.user_id == user_id).all()
                for r in rows:
                    results.append({
                        "id": str(r.id),
                        "provider": r.provider,
                        "provider_subject": r.provider_subject or r.provider_user_id,
                        "provider_user_id": r.provider_user_id or r.provider_subject,
                        "verified_email": r.verified_email,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                    })
                if results:
                    return results
            except Exception:
                pass

        # Check JSONB fallback
        record = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
        if record and isinstance(record.weather_scores, dict):
            raw_identities = record.weather_scores.get(IDENTITIES_KEY, [])
            for item in raw_identities:
                sub = item.get("provider_subject") or item.get("provider_user_id")
                email = item.get("verified_email") or item.get("email")
                results.append({
                    "id": item.get("id"),
                    "provider": item.get("provider"),
                    "provider_subject": sub,
                    "provider_user_id": sub,
                    "verified_email": email,
                    "created_at": item.get("created_at"),
                })
            return results
        return []

    def unlink_identity(self, user_id: UUID, provider: str) -> bool:
        """Unlink an OAuth provider from a user."""
        provider_clean = provider.strip().lower()
        modified = False

        if self._has_table:
            try:
                deleted = (
                    self.db.query(UserIdentity)
                    .filter(
                        UserIdentity.user_id == user_id,
                        UserIdentity.provider == provider_clean,
                    )
                    .delete(synchronize_session=False)
                )
                if deleted > 0:
                    self.db.commit()
                    modified = True
            except Exception:
                self.db.rollback()

        # Also remove from JSONB
        record = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
        if record and isinstance(record.weather_scores, dict):
            ws = dict(record.weather_scores)
            identities = ws.get(IDENTITIES_KEY, [])
            filtered = [i for i in identities if i.get("provider") != provider_clean]
            if len(filtered) != len(identities):
                ws[IDENTITIES_KEY] = filtered
                record.weather_scores = ws
                self.db.commit()
                modified = True

        return modified
