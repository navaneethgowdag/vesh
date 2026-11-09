import re
import html
from datetime import time
from typing import Dict, Any, Optional, List, Tuple


# Word boundary regex patterns for 14 event categories
CATEGORY_DEFINITIONS: List[Tuple[str, List[str], float, str, str]] = [
    # (category, regex_patterns, base_formality, default_dress_code, default_tone)
    (
        "job_interview",
        [
            r"\binterview\b", r"\bmock\s*interview\b", r"\bhiring\b",
            r"\btechnical\s*interview\b", r"\bhr\s*interview\b", r"\bjob\s*interview\b",
        ],
        0.90,
        "formal",
        "professional",
    ),
    (
        "wedding",
        [
            r"\bwedding\b", r"\breception\b", r"\bsangeet\b", r"\bmehendi\b",
            r"\bhaldi\b", r"\bshaadi\b", r"\bnikah\b", r"\bnuptials\b",
            r"\bbridal\b", r"\bbride\b", r"\bgroom\b",
        ],
        0.95,
        "festive",
        "celebratory",
    ),
    (
        "solemn_memorial",
        [
            r"\bfuneral\b", r"\bmemorial\b", r"\bcondolence\b", r"\bwake\b",
            r"\bburial\b", r"\btribute\b", r"\bremembrance\b", r"\bobituary\b",
        ],
        0.85,
        "formal",
        "solemn",
    ),
    (
        "cultural_religious",
        [
            r"\bpuja\b", r"\bpooja\b", r"\btemple\b", r"\bchurch\b", r"\bmosque\b",
            r"\bmass\b", r"\bfestival\b", r"\bdiwali\b", r"\beid\b", r"\bchristmas\b",
            r"\bhanukkah\b", r"\bprayer\b", r"\bceremony\b", r"\bpilgrimage\b",
            r"\bsatsang\b", r"\bnavratri\b", r"\bhavan\b",
        ],
        0.80,
        "festive",
        "celebratory",
    ),
    (
        "business_meeting",
        [
            r"\bclient\b", r"\bboard\s*meeting\b", r"\bqbr\b", r"\bquarterly\b",
            r"\bpitch\b", r"\bpresentation\b", r"\bexecutive\b", r"\bcontract\b",
            r"\bnegotiation\b", r"\bpartner\s*sync\b", r"\bconference\b",
            r"\bkeynote\b", r"\bbriefing\b", r"\bseminar\b", r"\bcommittee\b",
        ],
        0.85,
        "formal",
        "professional",
    ),
    (
        "office_work",
        [
            r"\boffice\b", r"\bwork\b", r"\bstandup\b", r"\bsprint\b",
            r"\bteam\s*sync\b", r"\b1:1\b", r"\bone-on-one\b", r"\bplanning\b",
            r"\bshift\b", r"\bcoworking\b", r"\bdesk\b", r"\bworkshop\b",
            r"\bwebinar\b", r"\bcorporate\b",
        ],
        0.70,
        "smart_casual",
        "professional",
    ),
    (
        "dinner",
        [
            r"\bdinner\b", r"\bfine\s*dining\b", r"\brooftop\s*dinner\b",
            r"\bcandlelight\b", r"\bsupper\b", r"\btasting\s*menu\b",
            r"\brestaurant\b", r"\bdate\s*night\b",
        ],
        0.65,
        "smart_casual",
        "neutral",
    ),
    (
        "party",
        [
            r"\bparty\b", r"\bclub\b", r"\bclubbing\b", r"\bnightclub\b",
            r"\brave\b", r"\bsoiree\b", r"\bmixer\b", r"\bcocktail\b",
            r"\bhousewarming\b", r"\bafterparty\b", r"\bbash\b", r"\bconcert\b",
        ],
        0.65,
        "festive",
        "celebratory",
    ),
    (
        "birthday",
        [
            r"\bbirthday\b", r"\bbday\b", r"\bcake\s*cutting\b",
            r"\bbirthday\s*party\b", r"\bbirthday\s*bash\b",
        ],
        0.55,
        "casual",
        "celebratory",
    ),
    (
        "academic",
        [
            r"\blecture\b", r"\bclass\b", r"\buniversity\b", r"\bcollege\b",
            r"\bthesis\b", r"\bdefense\b", r"\blab\b", r"\blibrary\b",
            r"\bexam\b", r"\bstudy\b", r"\bsymposium\b", r"\bcolloquium\b",
        ],
        0.50,
        "smart_casual",
        "neutral",
    ),
    (
        "casual_outing",
        [
            r"\bbrunch\b", r"\bcoffee\b", r"\blunch\b", r"\bpicnic\b",
            r"\bpark\b", r"\bhangout\b", r"\bshopping\b", r"\bmovie\b",
            r"\bcinema\b", r"\bstroll\b", r"\bzoo\b", r"\bmuseum\b",
            r"\bgallery\b", r"\bfarmers\s*market\b", r"\bbbq\b",
        ],
        0.40,
        "casual",
        "casual",
    ),
    (
        "travel",
        [
            r"\bflight\b", r"\bairport\b", r"\btransit\b", r"\broad\s*trip\b",
            r"\bvacation\b", r"\btrain\b", r"\bterminal\b", r"\bcommute\b",
            r"\bboarding\b", r"\bhotel\b", r"\bdeparture\b", r"\barrival\b",
            r"\btrip\b",
        ],
        0.30,
        "casual",
        "casual",
    ),
    (
        "sports_fitness",
        [
            r"\bgym\b", r"\bworkout\b", r"\brunning\b", r"\brun\b", r"\bmarathon\b",
            r"\b5k\b", r"\b10k\b", r"\bfitness\b", r"\byoga\b", r"\bpilates\b",
            r"\bcrossfit\b", r"\bswimming\b", r"\bswim\b", r"\btennis\b",
            r"\bbadminton\b", r"\bcycling\b", r"\bbike\b", r"\bhike\b",
            r"\bhiking\b", r"\btrail\b", r"\bsoccer\b", r"\bbasketball\b",
            r"\bexercise\b", r"\bclimbing\b",
        ],
        0.15,
        "casual",
        "casual",
    ),
]

DRESS_CODE_HIERARCHY: Dict[str, int] = {
    "black_tie": 5,
    "formal": 4,
    "festive": 3,
    "smart_casual": 2,
    "casual": 1,
}

EXPLICIT_DRESS_CODES: List[Tuple[str, List[str]]] = [
    ("black_tie", [r"\bblack\s*tie\b", r"\bwhite\s*tie\b", r"\btuxedo\b", r"\bgala\b"]),
    ("formal", [r"\bformal\b", r"\bbusiness\s*formal\b", r"\bcocktail\s*attire\b"]),
    ("festive", [r"\bfestive\b", r"\btraditional\b", r"\bethnic\b", r"\bindian\s*ethnic\b"]),
    ("smart_casual", [r"\bsmart\s*casual\b", r"\bbusiness\s*casual\b", r"\bdress\s*casual\b"]),
    ("casual", [r"\bcasual\b", r"\brelaxed\b", r"\binformal\b", r"\beveryday\b"]),
]


def clean_text(text: Optional[str]) -> str:
    """Sanitizes raw text, removes HTML and excess punctuation while keeping words."""
    if not text:
        return ""
    stripped = re.sub(r"<[^>]*>", " ", text)
    unescaped = html.unescape(stripped)
    cleaned = re.sub(r"[^\w\s\-\.,:/]", " ", unescaped)
    return " ".join(cleaned.split()).lower()


def get_item_formality(item: Any) -> float:
    """Derives a normalized formality score (0.0 to 1.0) for an item."""
    if hasattr(item, "formality") and item.formality is not None:
        try:
            return float(item.formality)
        except (ValueError, TypeError):
            pass
    cat = (getattr(item, "category", "") or "").lower()
    style = (getattr(item, "style", "") or "").lower()
    if "formal" in style or "evening" in style:
        return 0.85
    if "smart" in style or "work" in style or "office" in style:
        return 0.70
    if "suit" in cat or "blazer" in cat:
        return 0.85
    if "dress" in cat or "kurt" in cat or "saree" in cat:
        return 0.70
    if "athletic" in style or "gym" in style or "sport" in style:
        return 0.15
    return 0.40


class EventClassifierService:
    """
    Lightweight, strictly rule-based fashion event classifier.
    Preserves user privacy by running 100% locally with zero external API calls.
    Classifies:
    1. Category (14 categories)
    2. Tone/Sentiment (5 tones)
    3. Formality & Dress Code (5 dress codes)
    4. Multi-event priority resolution
    """

    @classmethod
    def classify_event(
        cls,
        title: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
        notes: Optional[str] = None,
        start_time: Optional[time] = None,
    ) -> Dict[str, Any]:
        """
        Classifies an individual calendar event.
        Priority: Title > Notes > Location > Description.
        """
        c_title = clean_text(title)
        c_notes = clean_text(notes)
        c_loc = clean_text(location)
        c_desc = clean_text(description)[:300]

        combined_text = f"{c_title} {c_notes} {c_loc} {c_desc}".strip()

        # 1. Detect explicit dress code first (user notes or title carry priority)
        detected_dress_code: Optional[str] = None
        for code, patterns in EXPLICIT_DRESS_CODES:
            for pat in patterns:
                if re.search(pat, c_notes, re.IGNORECASE) or re.search(pat, c_title, re.IGNORECASE):
                    detected_dress_code = code
                    break
                elif re.search(pat, combined_text, re.IGNORECASE) and not detected_dress_code:
                    detected_dress_code = code
            if detected_dress_code:
                break

        # 2. Match category from rules
        matched_category = "other"
        formality = 0.40
        default_dress_code = "casual"
        tone = "neutral"
        confidence = 0.30

        for cat, patterns, base_form, def_code, def_tone in CATEGORY_DEFINITIONS:
            for pat in patterns:
                if re.search(pat, c_title, re.IGNORECASE):
                    matched_category = cat
                    formality = base_form
                    default_dress_code = def_code
                    tone = def_tone
                    confidence = 0.90
                    break
                elif re.search(pat, combined_text, re.IGNORECASE):
                    if matched_category == "other":
                        matched_category = cat
                        formality = base_form
                        default_dress_code = def_code
                        tone = def_tone
                        confidence = 0.65
            if confidence >= 0.85:
                break

        # 3. Time-of-day heuristic adjustments if category remained 'other'
        if matched_category == "other" and start_time:
            hour = start_time.hour
            if 9 <= hour < 17:
                matched_category = "office_work"
                formality = 0.65
                default_dress_code = "smart_casual"
                tone = "professional"
                confidence = 0.45
            elif hour >= 18:
                matched_category = "dinner"
                formality = 0.60
                default_dress_code = "smart_casual"
                tone = "neutral"
                confidence = 0.40

        final_dress_code = detected_dress_code or default_dress_code

        # If dress code is black_tie or formal, ensure formality reflects it
        if final_dress_code == "black_tie":
            formality = max(formality, 0.98)
        elif final_dress_code == "formal":
            formality = max(formality, 0.85)

        return {
            "title": title,
            "category": matched_category,
            "tone": tone,
            "dress_code": final_dress_code,
            "formality": round(formality, 2),
            "confidence": round(confidence, 2),
            "has_explicit_dress_code": bool(detected_dress_code),
        }

    @classmethod
    def resolve_day_events(cls, events: List[Any]) -> Dict[str, Any]:
        """
        Handles multiple events occurring on the same date:
        Prioritizes explicit dress code, or the most restrictive/formal engagement.
        """
        if not events:
            return {
                "primary_event": None,
                "category": "casual_outing",
                "tone": "casual",
                "dress_code": "casual",
                "formality": 0.40,
                "event_count": 0,
                "all_events": [],
                "rationale": "No calendar events scheduled for today. Recommending a versatile casual daily outfit.",
            }

        classified_list: List[Dict[str, Any]] = []
        for e in events:
            if isinstance(e, dict):
                title = e.get("title") or e.get("name") or "Event"
                desc = e.get("description")
                loc = e.get("location")
                notes = e.get("notes")
                st = e.get("start_time")
            else:
                title = getattr(e, "title", None) or getattr(e, "name", None) or str(e)
                desc = getattr(e, "description", None)
                loc = getattr(e, "location", None)
                notes = getattr(e, "notes", None)
                st = getattr(e, "start_time", None)
            classified_list.append(cls.classify_event(title, desc, loc, notes, st))

        # Filter out cancelled
        active_list = [c for c in classified_list if getattr(c, "status", None) != "cancelled"]
        if not active_list:
            active_list = classified_list

        if len(active_list) == 1:
            primary = active_list[0]
            cat_display = primary["category"].replace("_", " ").title()
            dc_display = primary["dress_code"].replace("_", " ").title()
            return {
                "primary_event": primary,
                "category": primary["category"],
                "tone": primary["tone"],
                "dress_code": primary["dress_code"],
                "formality": primary["formality"],
                "event_count": 1,
                "all_events": active_list,
                "rationale": f"Curated for your {cat_display} with a {dc_display} dress code.",
            }

        # Multi-event resolution:
        # 1. Any event with explicit dress code?
        with_explicit = [e for e in active_list if e.get("has_explicit_dress_code")]
        if with_explicit:
            # Pick the most restrictive explicit dress code
            with_explicit.sort(
                key=lambda x: (
                    DRESS_CODE_HIERARCHY.get(x["dress_code"], 0),
                    x["formality"],
                ),
                reverse=True,
            )
            primary = with_explicit[0]
        else:
            # Pick highest formality / most restrictive dress code
            active_list.sort(
                key=lambda x: (
                    DRESS_CODE_HIERARCHY.get(x["dress_code"], 0),
                    x["formality"],
                ),
                reverse=True,
            )
            primary = active_list[0]

        cat_display = primary["category"].replace("_", " ").title()
        dc_display = primary["dress_code"].replace("_", " ").title()
        other_cats = [
            e["category"].replace("_", " ").title()
            for e in active_list
            if e != primary
        ]
        other_summary = f" (also accommodating {', '.join(set(other_cats))})" if other_cats else ""

        rationale = f"Curated for your primary event: {cat_display} ({dc_display} dress code){other_summary}."

        return {
            "primary_event": primary,
            "category": primary["category"],
            "tone": primary["tone"],
            "dress_code": primary["dress_code"],
            "formality": primary["formality"],
            "event_count": len(active_list),
            "all_events": active_list,
            "rationale": rationale,
        }

    @classmethod
    def compute_event_suitability(
        cls,
        items: List[Any],
        target_category: str,
        target_dress_code: str,
        target_formality: float,
    ) -> float:
        """
        Computes a normalized score (0.0 to 1.0) of how well the clothing items
        match the event category and dress code requirements.
        """
        if not items:
            return 0.50

        item_formalities = [get_item_formality(i) for i in items]
        avg_formality = sum(item_formalities) / len(item_formalities)
        formality_diff = abs(avg_formality - target_formality)
        formality_score = max(0.2, 1.0 - (formality_diff * 1.2))

        # Category/dress code alignment checks
        categories = [getattr(i, "category", "") or "" for i in items]
        styles = [getattr(i, "style", "") or "" for i in items]

        alignment_bonus = 0.0
        if target_dress_code in ("formal", "black_tie"):
            if any("Blazer" in c or "Suit" in c or "Formal" in s for c, s in zip(categories, styles)):
                alignment_bonus += 0.15
        elif target_dress_code == "festive":
            if any("Ethnic" in c or "Kurta" in c or "Traditional" in s for c, s in zip(categories, styles)):
                alignment_bonus += 0.20
        elif target_category == "sports_fitness":
            if any("Athletic" in s or "Sport" in s for s in styles):
                alignment_bonus += 0.20
        elif target_dress_code == "casual":
            if any("Casual" in s or "Tops" in c or "Bottoms" in c for c, s in zip(categories, styles)):
                alignment_bonus += 0.10

        return min(1.0, max(0.1, round(formality_score * 0.8 + alignment_bonus, 2)))
