import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Clothing(Base):
    __tablename__ = "clothing"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True, index=True)
    subcategory = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True, index=True)
    secondary_color = Column(String(50), nullable=True)
    pattern = Column(String(50), default="Solid", nullable=True)
    material = Column(String(50), nullable=True)
    fit = Column(String(50), default="Regular", nullable=True)
    brand = Column(String(100), nullable=True)
    size = Column(String(30), nullable=True)
    season = Column(String(50), default="All-Season", nullable=True)
    occasion = Column(String(50), default="Casual Daily", nullable=True)
    image_url = Column(String(1024), nullable=True)
    description = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=False, nullable=False)
    wear_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def style_tags(self):
        if self.analysis and self.analysis.style_tags:
            return self.analysis.style_tags
        return [self.occasion] if self.occasion else []

    @property
    def last_worn(self):
        return self.last_worn_on.isoformat() if self.last_worn_on else None

    # Laundry & Wear Tracking properties (persisted via feature_vector["laundry"])
    @property
    def laundry_data(self) -> dict:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("laundry", {})
        return getattr(self, "_laundry_dict", {})

    def _update_laundry_data(self, key: str, val: Any):
        if not self.analysis:
            from app.models.clothing_analysis import ClothingAnalysis
            self.analysis = ClothingAnalysis(
                clothing_id=self.id,
                feature_vector={"laundry": {key: val}},
            )
        elif isinstance(self.analysis.feature_vector, dict):
            fv = dict(self.analysis.feature_vector)
            laundry = dict(fv.get("laundry", {}))
            laundry[key] = val
            fv["laundry"] = laundry
            self.analysis.feature_vector = fv
        else:
            self.analysis.feature_vector = {"laundry": {key: val}}

        if not hasattr(self, "_laundry_dict"):
            self._laundry_dict = {}
        self._laundry_dict[key] = val

    @property
    def wear_count_since_wash(self) -> int:
        return int(self.laundry_data.get("wear_count_since_wash", 0))

    @wear_count_since_wash.setter
    def wear_count_since_wash(self, val: int):
        self._update_laundry_data("wear_count_since_wash", int(val))

    @property
    def last_worn_on(self):
        raw = self.laundry_data.get("last_worn_on")
        if raw:
            from datetime import date
            return date.fromisoformat(raw) if isinstance(raw, str) else raw
        return None

    @last_worn_on.setter
    def last_worn_on(self, val):
        from datetime import date
        self._update_laundry_data("last_worn_on", val.isoformat() if isinstance(val, date) else val)

    @property
    def laundry_status(self) -> str:
        return self.laundry_data.get("laundry_status", "clean")

    @laundry_status.setter
    def laundry_status(self, val: str):
        self._update_laundry_data("laundry_status", str(val))

    @property
    def laundry_started_on(self):
        raw = self.laundry_data.get("laundry_started_on")
        if raw:
            from datetime import date
            return date.fromisoformat(raw) if isinstance(raw, str) else raw
        return None

    @laundry_started_on.setter
    def laundry_started_on(self, val):
        from datetime import date
        self._update_laundry_data("laundry_started_on", val.isoformat() if isinstance(val, date) else val)

    @property
    def available_from(self):
        raw = self.laundry_data.get("available_from")
        if raw:
            from datetime import date
            return date.fromisoformat(raw) if isinstance(raw, str) else raw
        return None

    @available_from.setter
    def available_from(self, val):
        from datetime import date
        self._update_laundry_data("available_from", val.isoformat() if isinstance(val, date) else val)

    @property
    def max_wears_override(self) -> Optional[int]:
        val = self.laundry_data.get("max_wears_override")
        return int(val) if val is not None else None

    @max_wears_override.setter
    def max_wears_override(self, val: Optional[int]):
        self._update_laundry_data("max_wears_override", int(val) if val is not None else None)

    @property
    def wash_days_override(self) -> Optional[int]:
        val = self.laundry_data.get("wash_days_override")
        return int(val) if val is not None else None

    @wash_days_override.setter
    def wash_days_override(self, val: Optional[int]):
        self._update_laundry_data("wash_days_override", int(val) if val is not None else None)

    @property
    def track_laundry(self) -> bool:
        if "track_laundry" in self.laundry_data:
            return bool(self.laundry_data["track_laundry"])
        cat = (self.category or "").lower().strip()
        non_launderable = {
            "footwear", "shoes", "shoe", "sneakers", "bag", "bags",
            "belt", "belts", "watch", "watches", "jewellery", "jewelry",
            "accessories", "sunglasses", "glasses"
        }
        return cat not in non_launderable

    @track_laundry.setter
    def track_laundry(self, val: bool):
        self._update_laundry_data("track_laundry", bool(val))

    # Processing metadata properties (backed by ClothingAnalysis or in-memory metadata)
    @property
    def processing_status(self) -> str:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("processing_status", "completed")
        if hasattr(self, "_laundry_dict") and "processing_status" in self._laundry_dict:
            return self._laundry_dict["processing_status"]
        return "completed" if self.image_url else "uploaded"

    @processing_status.setter
    def processing_status(self, val: str):
        self._update_laundry_data("processing_status", str(val))

    @property
    def processing_stage(self) -> str:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("processing_stage", "completed")
        if hasattr(self, "_laundry_dict") and "processing_stage" in self._laundry_dict:
            return self._laundry_dict["processing_stage"]
        return "completed" if self.image_url else "uploaded"

    @processing_stage.setter
    def processing_stage(self, val: str):
        self._update_laundry_data("processing_stage", str(val))

    @property
    def review_required(self) -> bool:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return bool(self.analysis.feature_vector.get("review_required", False))
        if hasattr(self, "_laundry_dict") and "review_required" in self._laundry_dict:
            return bool(self._laundry_dict["review_required"])
        return False

    @review_required.setter
    def review_required(self, val: bool):
        self._update_laundry_data("review_required", bool(val))

    @property
    def is_processed_available(self) -> bool:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return bool(self.analysis.feature_vector.get("has_processed", False))
        return False

    @property
    def processing_duration(self) -> float:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return float(self.analysis.feature_vector.get("processing_duration", 0.0))
        return 0.0

    @property
    def processing_error(self) -> str:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("error_message") or ""
        return ""

    @property
    def is_finalized(self) -> bool:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            fv = self.analysis.feature_vector
            if "is_finalized" in fv:
                return bool(fv["is_finalized"])
            if fv.get("review_required") or fv.get("processing_status") in ("predictions_ready", "ready_for_review", "queued", "processing", "failed"):
                return False
        if hasattr(self, "_laundry_dict") and "is_finalized" in self._laundry_dict:
            return bool(self._laundry_dict["is_finalized"])
        return True

    @is_finalized.setter
    def is_finalized(self, val: bool):
        self._update_laundry_data("is_finalized", bool(val))

    @property
    def style(self) -> str:
        if self.analysis and self.analysis.style_tags:
            return self.analysis.style_tags[0] if isinstance(self.analysis.style_tags, list) and self.analysis.style_tags else str(self.analysis.style_tags)
        return self.occasion or "Casual"

    @property
    def formality(self) -> Optional[float]:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            val = self.analysis.feature_vector.get("formality")
            if val is not None:
                return float(val)
        val = self.vault_data.get("formality_score")
        if val is not None:
            return float(val)
        return None

    @formality.setter
    def formality(self, val: Optional[float]):
        if val is not None:
            self._update_vault_data("formality_score", float(val))
            if self.analysis and isinstance(self.analysis.feature_vector, dict):
                fv = dict(self.analysis.feature_vector)
                fv["formality"] = float(val)
                self.analysis.feature_vector = fv

    # Occasion Vault & Wardrobe Group properties
    @property
    def vault_data(self) -> dict:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("vault", {})
        return getattr(self, "_vault_dict", {})

    def _update_vault_data(self, key: str, val: Any):
        if not self.analysis:
            from app.models.clothing_analysis import ClothingAnalysis
            self.analysis = ClothingAnalysis(
                clothing_id=self.id,
                feature_vector={"vault": {key: val}},
            )
        elif isinstance(self.analysis.feature_vector, dict):
            fv = dict(self.analysis.feature_vector)
            vault = dict(fv.get("vault", {}))
            vault[key] = val
            fv["vault"] = vault
            self.analysis.feature_vector = fv
        else:
            self.analysis.feature_vector = {"vault": {key: val}}

        if not hasattr(self, "_vault_dict"):
            self._vault_dict = {}
        self._vault_dict[key] = val

    @property
    def wear_tier(self) -> str:
        val = self.vault_data.get("wear_tier")
        if val:
            return str(val)
        name_l = (self.name or "").lower()
        sub_l = (self.subcategory or "").lower()
        cat_l = (self.category or "").lower()
        occ_l = (self.occasion or "").lower()
        if any(w in name_l or w in sub_l or w in cat_l for w in ["tuxedo", "ballgown", "sherwani", "lehenga", "saree", "bridal"]):
            return "luxury_special"
        if any(w in name_l or w in sub_l or w in cat_l for w in ["blazer", "suit", "oxford", "derby"]):
            return "elevated"
        if "formal" in occ_l or "wedding" in occ_l:
            return "elevated"
        return "daily"

    @wear_tier.setter
    def wear_tier(self, val: str):
        self._update_vault_data("wear_tier", str(val))

    @property
    def is_luxury(self) -> bool:
        if "is_luxury" in self.vault_data:
            return bool(self.vault_data["is_luxury"])
        return self.wear_tier == "luxury_special"

    @is_luxury.setter
    def is_luxury(self, val: bool):
        self._update_vault_data("is_luxury", bool(val))

    @property
    def wardrobe_groups(self) -> List[str]:
        val = self.vault_data.get("wardrobe_groups")
        if isinstance(val, list) and val:
            return val
        tier = self.wear_tier
        if tier == "luxury_special":
            return ["luxury_special"]
        occ_l = (self.occasion or "").lower()
        if "party" in occ_l or "date" in occ_l:
            return ["party_evening"]
        return ["daily_work"]

    @wardrobe_groups.setter
    def wardrobe_groups(self, val: List[str]):
        if isinstance(val, (list, set, tuple)):
            clean_groups = list({str(g).strip().lower() for g in val if str(g).strip()})
            self._update_vault_data("wardrobe_groups", clean_groups)

    @property
    def suitable_occasions(self) -> List[str]:
        val = self.vault_data.get("suitable_occasions")
        if isinstance(val, list):
            return val
        return []

    @suitable_occasions.setter
    def suitable_occasions(self, val: List[str]):
        if isinstance(val, (list, set, tuple)):
            clean = list({str(o).strip().lower() for o in val if str(o).strip()})
            self._update_vault_data("suitable_occasions", clean)

    @property
    def purchase_price(self) -> Optional[float]:
        val = self.vault_data.get("purchase_price")
        if val is not None:
            try:
                return float(val)
            except (ValueError, TypeError):
                return None
        return None

    @purchase_price.setter
    def purchase_price(self, val: Optional[float]):
        self._update_vault_data("purchase_price", float(val) if val is not None else None)

    @property
    def purchase_date(self) -> Optional[str]:
        return self.vault_data.get("purchase_date")

    @purchase_date.setter
    def purchase_date(self, val: Optional[Any]):
        if val is None:
            self._update_vault_data("purchase_date", None)
        else:
            self._update_vault_data("purchase_date", val.isoformat() if hasattr(val, "isoformat") else str(val))

    @property
    def care_type(self) -> str:
        val = self.vault_data.get("care_type")
        if val:
            return str(val)
        sub_l = (self.subcategory or "").lower()
        name_l = (self.name or "").lower()
        mat_l = (self.material or "").lower()
        if any(w in mat_l or w in sub_l or w in name_l for w in ["silk", "wool", "cashmere", "leather", "suede", "suit", "blazer", "tuxedo", "sherwani", "lehenga"]):
            return "dry_clean_only"
        return "machine_wash"

    @care_type.setter
    def care_type(self, val: str):
        self._update_vault_data("care_type", str(val))

    @property
    def special_use_restriction(self) -> str:
        val = self.vault_data.get("special_use_restriction")
        if val:
            return str(val)
        if self.wear_tier == "luxury_special":
            return "special_occasions_only"
        return "none"

    @special_use_restriction.setter
    def special_use_restriction(self, val: str):
        self._update_vault_data("special_use_restriction", str(val))

    @property
    def reserved_status(self) -> str:
        return self.vault_data.get("reserved_status", "available")

    @reserved_status.setter
    def reserved_status(self, val: str):
        self._update_vault_data("reserved_status", str(val))

    @property
    def notes(self) -> Optional[str]:
        return self.vault_data.get("notes")

    @notes.setter
    def notes(self, val: Optional[str]):
        self._update_vault_data("notes", str(val) if val else None)

    @property
    def provenance(self) -> Dict[str, str]:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("provenance", {})
        return getattr(self, "_provenance_dict", {})

    def set_provenance(self, attribute_name: str, source: str):
        """source: 'ai_predicted' | 'user_confirmed' | 'manually_entered' | 'system_derived'"""
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            fv = dict(self.analysis.feature_vector)
            prov = dict(fv.get("provenance", {}))
            prov[attribute_name] = source
            fv["provenance"] = prov
            self.analysis.feature_vector = fv
        else:
            if not hasattr(self, "_provenance_dict"):
                self._provenance_dict = {}
            self._provenance_dict[attribute_name] = source

    @property
    def cost_per_wear(self) -> Optional[float]:
        """Calculates cost per wear if purchase price is known."""
        price = self.purchase_price
        if price is not None and price > 0:
            count = max(1, self.wear_count)
            return round(price / count, 2)
        return None

    @property
    def verified_attributes(self) -> dict:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("verified_attributes") or {}
        return {}

    @property
    def last_worn_at(self) -> Optional[datetime]:
        dates = []
        if self.outfits:
            for o in self.outfits:
                if hasattr(o, "wear_history") and o.wear_history:
                    for w in o.wear_history:
                        if w.worn_at:
                            dates.append(w.worn_at)
        return max(dates) if dates else None

    @property
    def preferred_image_url(self) -> Optional[str]:
        if self.is_processed_available and self.processing_status != "rejected_original_kept":
            return f"/api/v1/clothing/{self.id}/image/processed"
        return self.image_url or (f"/api/v1/clothing/{self.id}/image/original" if self.id else None)

    @property
    def sleeve_type(self) -> Optional[str]:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            va = self.analysis.feature_vector.get("verified_attributes") or {}
            cs = va.get("category_specific") or {}
            return cs.get("sleeve_length") or cs.get("sleeve_type") or va.get("sleeve_length")
        return None

    @property
    def neckline(self) -> Optional[str]:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            va = self.analysis.feature_vector.get("verified_attributes") or {}
            cs = va.get("category_specific") or {}
            return cs.get("neckline") or cs.get("collar_style") or va.get("neckline")
        return None

    @property
    def category_group(self) -> Optional[str]:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            va = self.analysis.feature_vector.get("verified_attributes") or {}
            if "category_group" in va:
                return va["category_group"]
            ai_pred = self.analysis.feature_vector.get("ai_predictions") or {}
            if "category_group" in ai_pred:
                return ai_pred["category_group"]
        from app.ai.fashion_taxonomy import CATEGORY_TO_GROUP
        cat = (self.category or "").lower()
        return CATEGORY_TO_GROUP.get(cat, "western")

    # Relationships
    user = relationship("User", back_populates="clothing_items")
    analysis = relationship("ClothingAnalysis", back_populates="clothing", uselist=False, cascade="all, delete-orphan")
    outfits = relationship("Outfit", secondary="outfit_clothing", back_populates="clothing_items")
    images = relationship(
        "ClothingImage",
        back_populates="clothing",
        cascade="all, delete-orphan",
        lazy="raise",
        passive_deletes=True,
    )
    predictions = relationship(
        "ClothingPrediction",
        back_populates="clothing",
        cascade="all, delete-orphan",
        lazy="raise",
        passive_deletes=True,
    )
    corrections = relationship(
        "ClothingCorrection",
        back_populates="clothing",
        cascade="all, delete-orphan",
        lazy="raise",
        passive_deletes=True,
    )
