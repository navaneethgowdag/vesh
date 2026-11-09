from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class WardrobeGapItem(BaseModel):
    category: str
    title: str
    priority: str
    reason: str
    evidence: str
    occasions: List[str] = Field(default_factory=list)
    suggested_garments: List[str] = Field(default_factory=list)
    confidence: float = 1.0


class WardrobeGapResponse(BaseModel):
    total_items: int
    category_distribution: Dict[str, int] = Field(default_factory=dict)
    formality_distribution: Dict[str, int] = Field(default_factory=dict)
    color_distribution: Dict[str, Any] = Field(default_factory=dict)
    occasions_distribution: Dict[str, int] = Field(default_factory=dict)
    wear_stats: Dict[str, int] = Field(default_factory=dict)
    gaps: List[WardrobeGapItem] = Field(default_factory=list)
    last_analyzed_at: str
    is_balanced: bool = False
