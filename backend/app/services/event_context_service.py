import re
import html
from datetime import time, datetime
from typing import Dict, Any, Optional, List, Tuple

# Pre-compiled word boundary patterns for robust keyword matching
OCCASION_RULES: List[Tuple[str, List[str], float, str, str, str]] = [
    # (occasion, keywords, base_formality, dress_code, social_context, default_indoor_outdoor)
    (
        "Formal Event",
        [
            r"\bwedding\b", r"\bgala\b", r"\breception\b", r"\bceremony\b", r"\bbanquet\b",
            r"\bblack\s*tie\b", r"\bwhite\s*tie\b", r"\baward[s]?\b", r"\bformal\b",
            r"\bprom\b", r"\bcharity\s*ball\b", r"\bconvocation\b", r"\bcommencement\b",
            r"\bsangeet\b", r"\bmehendi\b", r"\bhaldi\b", r"\bshaadi\b", r"\bannaprashana\b"
        ],
        0.95,
        "Formal / Black Tie",
        "celebratory",
        "indoor",
    ),
    (
        "Work & Office",
        [
            r"\binterview\b", r"\bclient\b", r"\bconference\b", r"\bpresentation\b",
            r"\bboard\s*meeting\b", r"\boffice\b", r"\bmeeting\b", r"\bsync\b",
            r"\bstandup\b", r"\breview\b", r"\bpitch\b", r"\bwork\b", r"\bcorporate\b",
            r"\bbriefing\b", r"\bdemo\b", r"\bworkshop\b", r"\bseminar\b", r"\bkeynote\b",
            r"\bqbr\b", r"\bquarterly\b", r"\bplanning\b", r"\bteam\s*sync\b", r"\bone-on-one\b",
            r"\b1:1\b", r"\bwebinar\b", r"\bcommittee\b", r"\bsprint\b"
        ],
        0.75,
        "Business Casual",
        "professional",
        "indoor",
    ),
    (
        "Date Night",
        [
            r"\bdate\s*night\b", r"\banniversary\b", r"\bromantic\b", r"\bcandlelight\b",
            r"\bdate\b", r"\bcouples\b", r"\brooftop\s*dinner\b", r"\bfine\s*dining\b"
        ],
        0.65,
        "Smart Casual / Elegant",
        "social",
        "indoor",
    ),
    (
        "Party & Evening",
        [
            r"\bparty\b", r"\bbirthday\b", r"\bcelebration\b", r"\bclub\b", r"\bclubbing\b",
            r"\bnightclub\b", r"\bfestival\b", r"\bsoiree\b", r"\bconcert\b", r"\bnye\b",
            r"\bbash\b", r"\bfarewell\b", r"\bafterparty\b", r"\brave\b", r"\bpub\b"
        ],
        0.60,
        "Partywear / Evening Casual",
        "celebratory",
        "mixed",
    ),
    (
        "Fitness",
        [
            r"\bgym\b", r"\bworkout\b", r"\byoga\b", r"\bpilates\b", r"\bcrossfit\b",
            r"\brunning\b", r"\brun\b", r"\bmarathon\b", r"\b5k\b", r"\b10k\b",
            r"\bhike\b", r"\bhiking\b", r"\btrail\b", r"\btennis\b", r"\bswim\b",
            r"\bswimming\b", r"\bbadminton\b", r"\bcycling\b", r"\bbike\b", r"\bexercise\b",
            r"\bcalisthenics\b", r"\bclimbing\b", r"\bbouldering\b", r"\bboxing\b", r"\bsparring\b"
        ],
        0.15,
        "Athletic / Sportswear",
        "fitness",
        "mixed",
    ),
    (
        "Travel & Airport",
        [
            r"\bflight\b", r"\bairport\b", r"\btrain\b", r"\btravel\b", r"\broad\s*trip\b",
            r"\btransit\b", r"\bcommute\b", r"\bvacation\b", r"\btrip\b", r"\bhotel\s*check-in\b",
            r"\bpacking\b", r"\bdeparture\b", r"\barrival\b"
        ],
        0.35,
        "Casual Comfort / Transit",
        "leisure",
        "indoor",
    ),
    (
        "Weekend Outing",
        [
            r"\bbrunch\b", r"\bcoffee\b", r"\blunch\b", r"\bpicnic\b", r"\bmuseum\b",
            r"\bgallery\b", r"\bpark\b", r"\bbbq\b", r"\bhangout\b", r"\bfriends\b",
            r"\bshopping\b", r"\bfarmers\s*market\b", r"\bstroll\b", r"\bcinema\b",
            r"\bmovie[s]?\b", r"\btheatre\b", r"\btheater\b", r"\bplay\b", r"\bdinner\b"
        ],
        0.45,
        "Casual / Relaxed Chic",
        "social",
        "mixed",
    ),
]


def _clean_text(raw_text: Optional[str]) -> str:
    """Sanitizes untrusted text input, removes HTML tags and extra whitespace."""
    if not raw_text:
        return ""
    # Strip HTML tags
    clean = re.sub(r"<[^>]*>", " ", raw_text)
    # Unescape HTML entities
    clean = html.unescape(clean)
    # Strip non-alphanumeric noise except standard punctuation
    clean = re.sub(r"[^\w\s\-\.,:/]", " ", clean)
    return " ".join(clean.split()).lower()


class EventContextService:
    """
    Intelligent fashion-context interpretation layer for calendar events.
    Infers occasion, formality, dress code, and venue context safely without
    sending private calendar text to external AI services.
    """

    @classmethod
    def classify_event_context(
        cls,
        title: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
        start_time: Optional[time] = None,
        is_all_day: bool = False,
    ) -> Dict[str, Any]:
        """
        Classifies an event's styling requirements.
        Prioritizes Title > Location > Description (treated as untrusted background context).
        """
        clean_title = _clean_text(title)
        clean_loc = _clean_text(location)
        clean_desc = _clean_text(description)[:250]  # bounded to prevent injection

        combined_text = f"{clean_title} {clean_loc} {clean_desc}".strip()

        matched_occasion: Optional[str] = None
        matched_formality = 0.40
        matched_dress_code = "Casual Daily"
        matched_social = "social"
        matched_indoor_outdoor = "indoor"
        confidence = 0.35

        # 1. Match against known occasion rules (Title matches carry highest weight)
        for occasion, patterns, formality, dress_code, social, in_out in OCCASION_RULES:
            for pat in patterns:
                # Strong match in title
                if re.search(pat, clean_title, re.IGNORECASE):
                    matched_occasion = occasion
                    matched_formality = formality
                    matched_dress_code = dress_code
                    matched_social = social
                    matched_indoor_outdoor = in_out
                    confidence = 0.90
                    break
                # Secondary match in location or description
                elif re.search(pat, combined_text, re.IGNORECASE):
                    if not matched_occasion:
                        matched_occasion = occasion
                        matched_formality = formality
                        matched_dress_code = dress_code
                        matched_social = social
                        matched_indoor_outdoor = in_out
                        confidence = 0.65

            if confidence >= 0.85:
                break

        # 2. Heuristic fallbacks if no specific keywords matched
        if not matched_occasion:
            # Time-of-day heuristic
            if start_time and not is_all_day:
                hour = start_time.hour
                if 9 <= hour < 17:
                    matched_occasion = "Work & Office"
                    matched_formality = 0.70
                    matched_dress_code = "Business Casual"
                    matched_social = "professional"
                    confidence = 0.50
                elif hour >= 18:
                    matched_occasion = "Date Night"
                    matched_formality = 0.60
                    matched_dress_code = "Smart Casual"
                    matched_social = "social"
                    confidence = 0.45
                else:
                    matched_occasion = "Casual Daily"
                    matched_formality = 0.35
                    matched_dress_code = "Casual Daily"
                    confidence = 0.40
            else:
                matched_occasion = "Casual Daily"
                matched_formality = 0.40
                matched_dress_code = "Casual Daily"
                confidence = 0.35

        # 3. Detect outdoor venue context from location
        outdoor_keywords = [r"\bpark\b", r"\bbeach\b", r"\bgarden\b", r"\bstadium\b", r"\boutdoor\b", r"\blawn\b", r"\bhike\b", r"\btrail\b"]
        for pat in outdoor_keywords:
            if re.search(pat, clean_loc, re.IGNORECASE):
                matched_indoor_outdoor = "outdoor"
                break

        # 4. Contextual formality modifier for evening dining
        if start_time and start_time.hour >= 19 and matched_occasion in ("Date Night", "Weekend Outing", "Party & Evening"):
            matched_formality = min(1.0, matched_formality + 0.10)
            if "Smart Casual" in matched_dress_code or matched_dress_code == "Casual Daily":
                matched_dress_code = "Evening Smart Casual"

        return {
            "occasion": matched_occasion,
            "formality": round(matched_formality, 2),
            "dress_code": matched_dress_code,
            "indoor_outdoor": matched_indoor_outdoor,
            "social_context": matched_social,
            "confidence": round(confidence, 2),
            "is_user_overridden": False,
        }

    @classmethod
    def analyze_day_events(cls, events: List[Any]) -> Dict[str, Any]:
        """
        Analyzes all events scheduled on a single day.
        Identifies whether a single versatile outfit can transition across events,
        or whether an outfit change is recommended due to formality/occasion conflicts.
        """
        if not events:
            return {
                "event_count": 0,
                "is_outfit_change_recommended": False,
                "reason": "No events scheduled for this day.",
                "suggested_overall_occasion": "Casual Daily",
                "suggested_dress_code": "Casual Daily",
                "formality_range": [0.4, 0.4],
            }

        def _get_val(obj, key, default=None):
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)

        # Filter active events
        active_events = [e for e in events if _get_val(e, "status", "scheduled") != "cancelled"]
        if not active_events:
            return {
                "event_count": 0,
                "is_outfit_change_recommended": False,
                "reason": "All scheduled events are cancelled.",
                "suggested_overall_occasion": "Casual Daily",
                "suggested_dress_code": "Casual Daily",
                "formality_range": [0.4, 0.4],
            }

        if len(active_events) == 1:
            single = active_events[0]
            occ = _get_val(single, "inferred_occasion") or _get_val(single, "occasion") or "Casual Daily"
            form = _get_val(single, "inferred_formality", 0.4) or 0.4
            dc = _get_val(single, "inferred_dress_code") or "Smart Casual"
            return {
                "event_count": 1,
                "is_outfit_change_recommended": False,
                "reason": f"Single event scheduled: {_get_val(single, 'title', occ)}.",
                "suggested_overall_occasion": occ,
                "suggested_dress_code": dc,
                "formality_range": [form, form],
            }

        # Multiple events analysis
        formalities = []
        occasions = []
        has_fitness = False
        has_formal = False
        has_work = False

        for e in active_events:
            occ = _get_val(e, "inferred_occasion") or _get_val(e, "occasion") or "Casual Daily"
            dc = _get_val(e, "inferred_dress_code") or ""
            form = _get_val(e, "inferred_formality", 0.4) or 0.4
            formalities.append(form)
            occasions.append(occ)
            if occ == "Fitness" or "athletic" in dc.lower():
                has_fitness = True
            if occ == "Formal Event" or form >= 0.80:
                has_formal = True
            if occ == "Work & Office":
                has_work = True

        min_form = min(formalities)
        max_form = max(formalities)
        form_delta = round(max_form - min_form, 2)

        # Clash detection: Fitness combined with Work or Formal
        if has_fitness and (has_work or has_formal):
            return {
                "event_count": len(active_events),
                "is_outfit_change_recommended": True,
                "reason": "Outfit change recommended between athletic activity and professional/formal engagements.",
                "suggested_overall_occasion": "Work & Office" if has_work else "Formal Event",
                "suggested_dress_code": "Business Casual with dedicated athletic transition piece",
                "formality_range": [min_form, max_form],
            }

        # High formality spread >= 0.40
        if form_delta >= 0.40:
            return {
                "event_count": len(active_events),
                "is_outfit_change_recommended": True,
                "reason": f"Significant formality change ({round(min_form * 100)}% to {round(max_form * 100)}%) across events.",
                "suggested_overall_occasion": "Work & Office" if has_work else occasions[0],
                "suggested_dress_code": "Layered Day-to-Night styling (e.g. removable blazer/jacket)",
                "formality_range": [min_form, max_form],
            }

        # Compatible events: Recommend unified transitional outfit
        primary_occ = "Work & Office" if has_work else occasions[0]
        return {
            "event_count": len(active_events),
            "is_outfit_change_recommended": False,
            "reason": f"All {len(active_events)} events share compatible formality ({round(min_form * 100)}%–{round(max_form * 100)}%). A versatile unified outfit will transition effortlessly.",
            "suggested_overall_occasion": primary_occ,
            "suggested_dress_code": "Versatile Day-to-Evening Smart Casual",
            "formality_range": [min_form, max_form],
        }


# Convenience module-level aliases
infer_event_context = EventContextService.classify_event_context
analyze_day_events = EventContextService.analyze_day_events
