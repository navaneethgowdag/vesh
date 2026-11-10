"""
TailorBird Canonical Occasion Taxonomy & Fashion Knowledge Engine.
Single source of truth for occasions across backend, recommendation engine, calendar, and frontend.

Features:
- Hierarchical grouping into 8 parent categories.
- Stable canonical identifiers.
- Comprehensive alias resolution for all legacy strings and UI labels.
- Occasion-specific formality bounds, preferred/disallowed garment archetypes.
- Hard constraint rules and footwear/accessory preferences.
- Zero silent fallbacks to Everyday: unsupported occasions raise clear errors.
"""

from typing import Dict, Any, List, Set, Optional
from pydantic import BaseModel, Field, ConfigDict


class OccasionDefinition(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str
    display_name: str
    parent_category: str
    description: str
    min_formality: float
    max_formality: float
    target_formality: float
    preferred_categories: Set[str] = Field(default_factory=set)
    disallowed_categories: Set[str] = Field(default_factory=set)
    compatible_usages: Set[str] = Field(default_factory=set)
    footwear_preferences: List[str] = Field(default_factory=list)
    prohibited_items: List[str] = Field(default_factory=list)
    preferred_items: List[str] = Field(default_factory=list)
    color_freedom: str = "moderate"
    weights: Dict[str, float] = Field(default_factory=dict)
    context_rules: Dict[str, Any] = Field(default_factory=dict)


# Parent categories
PARENT_CATEGORIES = [
    "Daily and Casual",
    "Professional and Academic",
    "Social and Evening",
    "Formal and Special",
    "Traditional and Festive",
    "Functional and Active",
    "Travel",
    "Other",
]


# Canonical Occasion Definitions
OCCASION_DEFINITIONS: Dict[str, OccasionDefinition] = {
    # -------------------------------------------------------------------------
    # 1. Daily and Casual
    # -------------------------------------------------------------------------
    "everyday": OccasionDefinition(
        id="everyday",
        display_name="Everyday",
        parent_category="Daily and Casual",
        description="Relaxed, casual comfort for day-to-day living and errands.",
        min_formality=0.10,
        max_formality=0.50,
        target_formality=0.30,
        preferred_categories={"western_top", "western_bottom", "western_dress", "indian_kurti", "footwear", "outerwear"},
        disallowed_categories={"formal_suit", "tuxedo", "sherwani", "bridal_lehenga", "heavy_lehenga"},
        compatible_usages={"Casual", "Home", "Smart Casual"},
        footwear_preferences=["sneakers", "casual sandals", "slip-ons", "flats", "loafers"],
        prohibited_items=["tuxedo", "ballgown", "sherwani", "bridal lehenga", "heavy silk saree"],
        preferred_items=["t-shirts", "polos", "casual shirts", "jeans", "chinos", "joggers", "sneakers"],
        color_freedom="high",
        weights={"comfort": 0.35, "preference": 0.25, "weather": 0.20, "color_harmony": 0.10, "formality_coherence": 0.10},
    ),
    "home": OccasionDefinition(
        id="home",
        display_name="Home & Loungewear",
        parent_category="Daily and Casual",
        description="Utmost comfort and relaxed loungewear for staying in.",
        min_formality=0.05,
        max_formality=0.30,
        target_formality=0.15,
        preferred_categories={"western_top", "western_bottom"},
        disallowed_categories={"formal_suit", "blazer", "tuxedo", "sherwani", "heels", "dress_shoes"},
        compatible_usages={"Home", "Casual"},
        footwear_preferences=["barefoot", "slides", "slippers"],
        prohibited_items=["blazer", "suit", "oxford shoes", "high heels", "stiff denim"],
        preferred_items=["loungewear", "sweatpants", "tees", "oversized hoodie", "shorts"],
        color_freedom="unrestricted",
        weights={"comfort": 0.60, "weather": 0.25, "preference": 0.15},
    ),
    "casual_outing": OccasionDefinition(
        id="casual_outing",
        display_name="Casual Outing",
        parent_category="Daily and Casual",
        description="Smart casual aesthetic for cafes, strolls, museum visits, and relaxed daytime catch-ups.",
        min_formality=0.25,
        max_formality=0.60,
        target_formality=0.40,
        preferred_categories={"western_top", "western_bottom", "western_dress", "indian_kurti", "outerwear", "footwear"},
        disallowed_categories={"formal_suit", "tuxedo", "sherwani", "gym_top", "activewear"},
        compatible_usages={"Casual", "Smart Casual"},
        footwear_preferences=["clean sneakers", "casual loafers", "mules", "boots", "flat sandals"],
        prohibited_items=["tuxedo", "gym tank", "running shorts", "flip-flops"],
        preferred_items=["casual shirts", "polos", "chinos", "clean jeans", "knit tops", "sneakers"],
        color_freedom="high",
        weights={"preference": 0.30, "comfort": 0.30, "weather": 0.20, "color_harmony": 0.20},
    ),
    "weekend_outing": OccasionDefinition(
        id="weekend_outing",
        display_name="Weekend Outing",
        parent_category="Daily and Casual",
        description="Laid-back, stylish weekend wear for daytime socializing and exploring.",
        min_formality=0.25,
        max_formality=0.60,
        target_formality=0.42,
        preferred_categories={"western_top", "western_bottom", "western_dress", "outerwear", "footwear"},
        disallowed_categories={"formal_suit", "tuxedo", "gym_top"},
        compatible_usages={"Casual", "Smart Casual"},
        footwear_preferences=["sneakers", "chelsea boots", "casual loafers"],
        prohibited_items=["stiff corporate suit", "gymwear", "athletic shorts"],
        preferred_items=["overshirt", "chinos", "stylish denim", "tees", "casual dresses"],
        color_freedom="high",
        weights={"preference": 0.30, "comfort": 0.30, "color_harmony": 0.20, "weather": 0.20},
    ),
    "college": OccasionDefinition(
        id="college",
        display_name="College & Campus",
        parent_category="Daily and Casual",
        description="Practical, expressive campus wear balancing comfort, daily routine, and style.",
        min_formality=0.15,
        max_formality=0.55,
        target_formality=0.32,
        preferred_categories={"western_top", "western_bottom", "indian_kurti", "outerwear", "footwear"},
        disallowed_categories={"formal_suit", "tuxedo", "party_dress", "sherwani", "bridal_lehenga"},
        compatible_usages={"Casual", "Smart Casual"},
        footwear_preferences=["casual sneakers", "canvas shoes", "flat boots", "comfortable slip-ons"],
        prohibited_items=["formal suit", "evening gown", "stiff high heels", "beachwear"],
        preferred_items=["t-shirts", "casual shirts", "overshirts", "sweatshirts", "jeans", "chinos", "cargo trousers", "sneakers"],
        color_freedom="high",
        weights={"comfort": 0.35, "weather": 0.25, "preference": 0.20, "color_harmony": 0.10, "formality_coherence": 0.10},
    ),
    "family_gathering": OccasionDefinition(
        id="family_gathering",
        display_name="Family Gathering",
        parent_category="Daily and Casual",
        description="Warm, respectful, smart-casual or traditional attire suited for family get-togethers.",
        min_formality=0.35,
        max_formality=0.75,
        target_formality=0.55,
        preferred_categories={"western_top", "western_bottom", "indian_kurta", "indian_kurti", "western_dress", "footwear"},
        disallowed_categories={"gym_top", "activewear", "distressed_jeans", "tuxedo"},
        compatible_usages={"Casual", "Smart Casual", "Ethnic"},
        footwear_preferences=["clean loafers", "mules", "smart sneakers", "sandals", "juttis"],
        prohibited_items=["gymwear", "distressed ripped denim", "sleepwear", "revealing party tops"],
        preferred_items=["collared shirts", "smart polos", "chinos", "neat kurtas", "kurtis", "modest dresses"],
        color_freedom="moderate_to_warm",
        weights={"formality_coherence": 0.30, "comfort": 0.25, "color_harmony": 0.25, "preference": 0.20},
    ),

    # -------------------------------------------------------------------------
    # 2. Professional and Academic
    # -------------------------------------------------------------------------
    "office": OccasionDefinition(
        id="office",
        display_name="Office & Work",
        parent_category="Professional and Academic",
        description="Polished professional attire with balanced colors and tailored silhouettes.",
        min_formality=0.55,
        max_formality=0.88,
        target_formality=0.72,
        preferred_categories={"western_top", "western_bottom", "outerwear", "indian_kurta", "footwear"},
        disallowed_categories={"activewear", "gym_top", "shorts", "flip_flops", "sweatpants", "tank_top"},
        compatible_usages={"Formal", "Smart Casual"},
        footwear_preferences=["oxfords", "derbies", "loafers", "monk straps", "block heels", "dress flats"],
        prohibited_items=["graphic t-shirts", "distressed jeans", "gym shorts", "athletic runners", "flip-flops"],
        preferred_items=["formal shirts", "button-downs", "blouses", "fine knitwear", "formal trousers", "chinos", "blazers"],
        color_freedom="moderate",
        weights={"formality_coherence": 0.35, "color_harmony": 0.30, "preference": 0.15, "weather": 0.10, "comfort": 0.10},
    ),
    "business_meeting": OccasionDefinition(
        id="business_meeting",
        display_name="Business Meeting",
        parent_category="Professional and Academic",
        description="Crisp executive attire projecting authority, focus, and corporate credibility.",
        min_formality=0.75,
        max_formality=0.98,
        target_formality=0.88,
        preferred_categories={"western_top", "western_bottom", "outerwear", "footwear"},
        disallowed_categories={"activewear", "gym_top", "shorts", "sandals", "sweatpants", "t_shirt", "jeans"},
        compatible_usages={"Formal"},
        footwear_preferences=["formal leather oxfords", "derbies", "closed-toe pumps", "tailored loafers"],
        prohibited_items=["t-shirts", "denim", "sneakers", "hoodies", "polo shirts", "open sandals"],
        preferred_items=["crisp dress shirts", "tailored blouses", "blazers", "suit jackets", "formal trousers"],
        color_freedom="conservative",
        weights={"formality_coherence": 0.45, "color_harmony": 0.30, "preference": 0.15, "weather": 0.10},
    ),
    "presentation": OccasionDefinition(
        id="presentation",
        display_name="Key Presentation",
        parent_category="Professional and Academic",
        description="Sharp, commanding stage attire focusing audience attention and building presence.",
        min_formality=0.70,
        max_formality=0.92,
        target_formality=0.80,
        preferred_categories={"western_top", "western_bottom", "outerwear", "footwear"},
        disallowed_categories={"activewear", "gym_top", "shorts", "distressed_jeans", "t_shirt"},
        compatible_usages={"Formal", "Smart Casual"},
        footwear_preferences=["polished oxfords", "clean loafers", "tailored pumps", "dress flats"],
        prohibited_items=["casual t-shirts", "distressed denim", "sweatshirts", "athletic shoes"],
        preferred_items=["crisp button-downs", "tailored blazers", "smart trousers", "solid dark chinos"],
        color_freedom="moderate",
        weights={"formality_coherence": 0.40, "color_harmony": 0.30, "preference": 0.15, "weather": 0.15},
    ),
    "interview": OccasionDefinition(
        id="interview",
        display_name="Job Interview",
        parent_category="Professional and Academic",
        description="Impeccably tailored, conservative interview outfit making an uncompromising first impression.",
        min_formality=0.80,
        max_formality=1.00,
        target_formality=0.90,
        preferred_categories={"western_top", "western_bottom", "outerwear", "footwear"},
        disallowed_categories={"activewear", "jeans", "shorts", "sandals", "t_shirt", "hoodie"},
        compatible_usages={"Formal"},
        footwear_preferences=["polished leather oxfords", "classic derbies", "conservative closed heels"],
        prohibited_items=["all casual wear", "t-shirts", "denim", "loud aggressive prints", "sneakers", "open-toe shoes"],
        preferred_items=["classic white/light blue dress shirt", "tailored blazer", "formal trousers", "conservative tie"],
        color_freedom="conservative",
        weights={"formality_coherence": 0.50, "color_harmony": 0.30, "preference": 0.10, "weather": 0.10},
    ),
    "conference": OccasionDefinition(
        id="conference",
        display_name="Conference & Summit",
        parent_category="Professional and Academic",
        description="Smart corporate networking wear that sustains long days of walking and sitting.",
        min_formality=0.60,
        max_formality=0.85,
        target_formality=0.72,
        preferred_categories={"western_top", "western_bottom", "outerwear", "footwear"},
        disallowed_categories={"activewear", "shorts", "flip_flops", "sweatpants"},
        compatible_usages={"Formal", "Smart Casual"},
        footwear_preferences=["supportive leather loafers", "cushioned dress shoes", "smart block heels"],
        prohibited_items=["beachwear", "gym shorts", "loud party wear"],
        preferred_items=["blazer", "button-down shirt", "tailored chinos", "comfortable formal trousers"],
        color_freedom="moderate",
        weights={"formality_coherence": 0.35, "comfort": 0.30, "color_harmony": 0.20, "weather": 0.15},
    ),
    "professional_event": OccasionDefinition(
        id="professional_event",
        display_name="Professional Event",
        parent_category="Professional and Academic",
        description="Elevated business attire for award dinners, panel sessions, and company milestone events.",
        min_formality=0.70,
        max_formality=0.95,
        target_formality=0.82,
        preferred_categories={"western_top", "western_bottom", "outerwear", "western_dress", "footwear"},
        disallowed_categories={"activewear", "casual_t_shirt", "jeans", "sneakers"},
        compatible_usages={"Formal", "Smart Casual"},
        footwear_preferences=["formal leather shoes", "heels", "dress flats"],
        prohibited_items=["denim", "t-shirts", "athletic footwear"],
        preferred_items=["tailored suit", "blazer set", "formal cocktail dress", "tailored trousers"],
        color_freedom="moderate",
        weights={"formality_coherence": 0.40, "color_harmony": 0.30, "preference": 0.20, "weather": 0.10},
    ),

    # -------------------------------------------------------------------------
    # 3. Social and Evening
    # -------------------------------------------------------------------------
    "date": OccasionDefinition(
        id="date",
        display_name="Date Night & Romantic",
        parent_category="Social and Evening",
        description="Intentionally styled romantic look balancing charm, flattering fits, and allure.",
        min_formality=0.45,
        max_formality=0.82,
        target_formality=0.65,
        preferred_categories={"western_top", "western_bottom", "western_dress", "outerwear", "footwear"},
        disallowed_categories={"activewear", "gym_top", "sweatpants", "flip_flops", "sloppy_t_shirt"},
        compatible_usages={"Smart Casual", "Party", "Casual"},
        footwear_preferences=["chelsea boots", "leather loafers", "dress sneakers", "elegant heels"],
        prohibited_items=["gym sweatpants", "baggy athletic shorts", "stiff executive suit", "distressed flip-flops"],
        preferred_items=["knit polo", "sharp button-down", "dark slim jeans", "chinos", "fitted jacket", "chic dress"],
        color_freedom="flattering",
        weights={"preference": 0.35, "color_harmony": 0.30, "formality_coherence": 0.20, "weather": 0.15},
    ),
    "dinner": OccasionDefinition(
        id="dinner",
        display_name="Dinner & Fine Dining",
        parent_category="Social and Evening",
        description="Elevated evening look fitting restaurant ambiance and culinary gatherings.",
        min_formality=0.50,
        max_formality=0.85,
        target_formality=0.70,
        preferred_categories={"western_top", "western_bottom", "western_dress", "outerwear", "footwear"},
        disallowed_categories={"activewear", "gym_top", "sweatpants", "shorts"},
        compatible_usages={"Smart Casual", "Formal", "Party"},
        footwear_preferences=["dress shoes", "loafers", "heels", "stylish boots"],
        prohibited_items=["shorts", "hoodies", "athletic trainers"],
        preferred_items=["blazer", "fine knit top", "tailored trousers", "dark jeans", "evening dress"],
        color_freedom="rich_subdued",
        weights={"color_harmony": 0.35, "formality_coherence": 0.30, "preference": 0.20, "weather": 0.15},
    ),
    "party": OccasionDefinition(
        id="party",
        display_name="Party & Night Out",
        parent_category="Social and Evening",
        description="Expressive evening style with statement silhouettes, textures, and bold accents.",
        min_formality=0.45,
        max_formality=0.88,
        target_formality=0.68,
        preferred_categories={"western_top", "western_bottom", "western_dress", "outerwear", "footwear"},
        disallowed_categories={"activewear", "gym_top", "sweatpants", "flip_flops", "formal_scrubs"},
        compatible_usages={"Party", "Smart Casual"},
        footwear_preferences=["statement sneakers", "chelsea boots", "fashion heels", "dress loafers"],
        prohibited_items=["gymwear", "athletic tracksuits", "stiff conservative office suits"],
        preferred_items=["party shirts", "statement tops", "satin/silk tops", "leather jackets", "dark jeans", "party dresses"],
        color_freedom="expressive",
        weights={"preference": 0.35, "color_harmony": 0.25, "comfort": 0.20, "weather": 0.10, "formality_coherence": 0.10},
    ),
    "birthday": OccasionDefinition(
        id="birthday",
        display_name="Birthday & Celebration",
        parent_category="Social and Evening",
        description="Festive personal celebration wear that feels special and photo-ready.",
        min_formality=0.40,
        max_formality=0.80,
        target_formality=0.60,
        preferred_categories={"western_top", "western_bottom", "western_dress", "indian_kurti", "footwear"},
        disallowed_categories={"gymwear", "sweatpants"},
        compatible_usages={"Party", "Smart Casual", "Casual"},
        footwear_preferences=["clean boots", "heels", "designer sneakers"],
        prohibited_items=["dull loungewear", "gym tanks"],
        preferred_items=["fun prints", "statement top", "well-fitted trousers", "festive dress"],
        color_freedom="celebratory",
        weights={"preference": 0.35, "color_harmony": 0.30, "comfort": 0.20, "weather": 0.15},
    ),

    # -------------------------------------------------------------------------
    # 4. Formal and Special
    # -------------------------------------------------------------------------
    "formal_event": OccasionDefinition(
        id="formal_event",
        display_name="Formal Event",
        parent_category="Formal and Special",
        description="High-formality gala, black tie, or ceremonial event requiring elevated dress.",
        min_formality=0.80,
        max_formality=1.00,
        target_formality=0.92,
        preferred_categories={"western_top", "western_bottom", "western_dress", "outerwear", "indian_saree", "indian_sherwani", "footwear"},
        disallowed_categories={"activewear", "jeans", "t_shirt", "shorts", "sneakers", "sweatpants", "hoodie"},
        compatible_usages={"Formal", "Ethnic"},
        footwear_preferences=["patent leather shoes", "polished oxfords", "formal evening heels", "luxury mojari"],
        prohibited_items=["denim", "t-shirts", "athletic runners", "casual sweaters"],
        preferred_items=["tuxedo", "tailored evening suit", "silk saree", "sherwani", "formal ballgown / evening dress"],
        color_freedom="conservative_or_luxurious",
        weights={"formality_coherence": 0.50, "color_harmony": 0.30, "preference": 0.10, "weather": 0.10},
    ),
    "gala": OccasionDefinition(
        id="gala",
        display_name="Gala & Black Tie",
        parent_category="Formal and Special",
        description="Black-tie and red-carpet ceremonial wear of the highest tier.",
        min_formality=0.85,
        max_formality=1.00,
        target_formality=0.96,
        preferred_categories={"western_dress", "outerwear", "western_top", "western_bottom", "indian_sherwani", "indian_saree", "footwear"},
        disallowed_categories={"activewear", "jeans", "shorts", "sneakers", "t_shirt"},
        compatible_usages={"Formal", "Ethnic"},
        footwear_preferences=["formal dress pumps", "patent leather oxfords"],
        prohibited_items=["all casual clothing", "sports shoes", "knit hoodies"],
        preferred_items=["tuxedo", "couture evening gown", "designer sherwani", "fine jewelry"],
        color_freedom="black_tie_luxurious",
        weights={"formality_coherence": 0.55, "color_harmony": 0.25, "preference": 0.20},
    ),
    "wedding": OccasionDefinition(
        id="wedding",
        display_name="Wedding Ceremony",
        parent_category="Formal and Special",
        description="Rich, celebratory ceremonial attire honoring vows and matrimonial grandeur.",
        min_formality=0.78,
        max_formality=1.00,
        target_formality=0.92,
        preferred_categories={"indian_saree", "indian_lehenga", "indian_kurta", "indian_sherwani", "western_dress", "outerwear", "footwear"},
        disallowed_categories={"activewear", "gym_top", "jeans", "t_shirt", "shorts", "sneakers", "hoodie"},
        compatible_usages={"Ethnic", "Formal"},
        footwear_preferences=["traditional juttis", "mojaris", "formal leather shoes", "embellished heels"],
        prohibited_items=["t-shirts", "denim", "casual sneakers", "athletic shorts"],
        preferred_items=["sherwanis", "silk kurtas", "sarees", "lehengas", "tailored formal suits", "fine blazers"],
        color_freedom="rich_celebratory",
        weights={"formality_coherence": 0.40, "preference": 0.30, "color_harmony": 0.20, "weather": 0.10},
    ),
    "wedding_reception": OccasionDefinition(
        id="wedding_reception",
        display_name="Wedding Reception",
        parent_category="Formal and Special",
        description="Glamorous post-ceremony evening celebration and banquet.",
        min_formality=0.75,
        max_formality=1.00,
        target_formality=0.90,
        preferred_categories={"western_dress", "outerwear", "indian_saree", "indian_lehenga", "indian_sherwani", "western_top", "western_bottom", "footwear"},
        disallowed_categories={"activewear", "jeans", "shorts", "sneakers", "t_shirt"},
        compatible_usages={"Ethnic", "Formal", "Party"},
        footwear_preferences=["heels", "formal oxfords", "mojaris"],
        prohibited_items=["casual wear", "sneakers"],
        preferred_items=["evening gowns", "designer blazers", "reception sarees", "indowestern kurtas"],
        color_freedom="glamorous",
        weights={"formality_coherence": 0.40, "color_harmony": 0.30, "preference": 0.20, "weather": 0.10},
    ),
    "engagement": OccasionDefinition(
        id="engagement",
        display_name="Engagement & Roka",
        parent_category="Formal and Special",
        description="Semi-formal to formal celebration wear for family milestone announcements.",
        min_formality=0.65,
        max_formality=0.92,
        target_formality=0.82,
        preferred_categories={"indian_kurta", "indian_kurti", "indian_saree", "western_dress", "outerwear", "footwear"},
        disallowed_categories={"activewear", "gymwear", "shorts", "distressed_jeans"},
        compatible_usages={"Ethnic", "Formal", "Smart Casual"},
        footwear_preferences=["ethnic sandals", "loafers", "heels"],
        prohibited_items=["gymwear", "athletic shoes"],
        preferred_items=["silk kurta sets", "designer kurtis", "pastel blazers", "elegant dresses"],
        color_freedom="pastel_festive",
        weights={"formality_coherence": 0.35, "color_harmony": 0.35, "preference": 0.20, "weather": 0.10},
    ),

    # -------------------------------------------------------------------------
    # 5. Traditional and Festive
    # -------------------------------------------------------------------------
    "festival": OccasionDefinition(
        id="festival",
        display_name="Festival & Cultural",
        parent_category="Traditional and Festive",
        description="Vibrant traditional or festive attire celebrating cultural and religious milestones.",
        min_formality=0.55,
        max_formality=0.95,
        target_formality=0.82,
        preferred_categories={"indian_kurta", "indian_kurti", "indian_saree", "indian_lehenga", "indian_bottom", "footwear"},
        disallowed_categories={"activewear", "gym_top", "sweatpants", "hoodie", "distressed_jeans"},
        compatible_usages={"Ethnic", "Party"},
        footwear_preferences=["traditional mojaris", "leather sandals", "kolhapuris", "ethnic flats"],
        prohibited_items=["western athleisure", "distressed denim", "gym shorts"],
        preferred_items=["kurtas", "nehru jackets", "traditional sets", "sarees", "lehengas"],
        color_freedom="rich_festive",
        weights={"preference": 0.35, "color_harmony": 0.30, "formality_coherence": 0.25, "weather": 0.10},
    ),
    "cultural_event": OccasionDefinition(
        id="cultural_event",
        display_name="Cultural Event",
        parent_category="Traditional and Festive",
        description="Respectful, culturally resonant ethnic or fusion wear for community heritage events.",
        min_formality=0.50,
        max_formality=0.90,
        target_formality=0.75,
        preferred_categories={"indian_kurta", "indian_kurti", "indian_saree", "western_top", "western_bottom", "footwear"},
        disallowed_categories={"gymwear", "shorts"},
        compatible_usages={"Ethnic", "Smart Casual"},
        footwear_preferences=["ethnic footwear", "clean loafers"],
        prohibited_items=["gym clothes", "beachwear"],
        preferred_items=["kurta with denim or trousers", "kurti sets", "ethnic jackets"],
        color_freedom="cultural_palette",
        weights={"preference": 0.35, "formality_coherence": 0.30, "color_harmony": 0.25, "weather": 0.10},
    ),

    # -------------------------------------------------------------------------
    # 6. Functional and Active
    # -------------------------------------------------------------------------
    "gym": OccasionDefinition(
        id="gym",
        display_name="Gym & Workout",
        parent_category="Functional and Active",
        description="High-mobility, breathable athletic wear built for peak performance and training.",
        min_formality=0.05,
        max_formality=0.32,
        target_formality=0.15,
        preferred_categories={"western_top", "western_bottom", "footwear"},
        disallowed_categories={
            "formal_suit", "blazer", "chinos", "dress_shirt", "leather_shoes",
            "heels", "saree", "kurta", "lehenga", "tie", "formal_trouser", "boots"
        },
        compatible_usages={"Sports"},
        footwear_preferences=["running shoes", "cross trainers", "workout sneakers", "athletic shoes"],
        prohibited_items=[
            "blazer", "suit", "oxford shoes", "leather loafers", "high heels",
            "dress shirt", "slacks", "formal trousers", "saree", "kurta", "lehenga", "tie"
        ],
        preferred_items=["sports t-shirts", "performance tank tops", "compression shorts", "track pants", "gym shorts", "running sneakers"],
        color_freedom="high",
        weights={"comfort": 0.50, "weather": 0.30, "preference": 0.20, "color_harmony": 0.00, "formality_coherence": 0.00},
    ),
    "running": OccasionDefinition(
        id="running",
        display_name="Running & Outdoor Fitness",
        parent_category="Functional and Active",
        description="Weather-resistant, moisture-wicking aerodynamic gear for running and cardio.",
        min_formality=0.05,
        max_formality=0.30,
        target_formality=0.15,
        preferred_categories={"western_top", "western_bottom", "footwear"},
        disallowed_categories={"formal_suit", "blazer", "chinos", "leather_shoes", "jeans"},
        compatible_usages={"Sports"},
        footwear_preferences=["cushioned running shoes", "trail runners"],
        prohibited_items=["formal wear", "denim", "heavy cotton sweaters"],
        preferred_items=["running singlet", "marathon shorts", "windbreaker", "running shoes"],
        color_freedom="high_visibility",
        weights={"comfort": 0.50, "weather": 0.35, "preference": 0.15},
    ),
    "sports": OccasionDefinition(
        id="sports",
        display_name="Sports & Games",
        parent_category="Functional and Active",
        description="Activity-specific athletic apparel for team sports, tennis, badminton, and outdoor games.",
        min_formality=0.05,
        max_formality=0.35,
        target_formality=0.18,
        preferred_categories={"western_top", "western_bottom", "footwear"},
        disallowed_categories={"formal_suit", "blazer", "chinos", "heels", "leather_shoes"},
        compatible_usages={"Sports"},
        footwear_preferences=["court shoes", "cleats", "athletic trainers"],
        prohibited_items=["dress clothes", "stiff denim"],
        preferred_items=["jersey", "sports shorts", "athletic socks", "training shoes"],
        color_freedom="sporty",
        weights={"comfort": 0.50, "weather": 0.30, "preference": 0.20},
    ),

    # -------------------------------------------------------------------------
    # 7. Travel
    # -------------------------------------------------------------------------
    "travel": OccasionDefinition(
        id="travel",
        display_name="Travel & Airport",
        parent_category="Travel",
        description="Wrinkle-resistant, layering-friendly travel outfit with closed, comfortable walking shoes.",
        min_formality=0.20,
        max_formality=0.55,
        target_formality=0.35,
        preferred_categories={"western_top", "western_bottom", "outerwear", "footwear"},
        disallowed_categories={"formal_suit", "heels", "delicate_silk", "heavy_lehenga", "stiff_tuxedo"},
        compatible_usages={"Travel", "Casual"},
        footwear_preferences=["slip-on sneakers", "comfortable trainers", "walking shoes", "flat boots"],
        prohibited_items=["stiff corporate suits", "high stiletto heels", "heavy traditional lehengas"],
        preferred_items=["comfortable t-shirts", "oversized overshirt", "stretch chinos", "joggers", "versatile layering jacket"],
        color_freedom="versatile_darker",
        weights={"comfort": 0.45, "weather": 0.30, "preference": 0.15, "color_harmony": 0.10},
    ),
    "vacation": OccasionDefinition(
        id="vacation",
        display_name="Vacation & Resort",
        parent_category="Travel",
        description="Breezy, vibrant holiday wear tuned for leisure, coastal walks, and sightseeing.",
        min_formality=0.15,
        max_formality=0.55,
        target_formality=0.35,
        preferred_categories={"western_top", "western_bottom", "western_dress", "footwear"},
        disallowed_categories={"formal_suit", "heavy_blazer", "stiff_tuxedo"},
        compatible_usages={"Casual", "Travel"},
        footwear_preferences=["espadrilles", "leather slide sandals", "canvas slip-ons"],
        prohibited_items=["heavy woolen coats", "formal business attire"],
        preferred_items=["linen shirts", "resort shorts", "floral shirts", "sundresses"],
        color_freedom="sunny_resort",
        weights={"comfort": 0.40, "weather": 0.35, "preference": 0.25},
    ),

    # -------------------------------------------------------------------------
    # 8. Other
    # -------------------------------------------------------------------------
    "solemn_memorial": OccasionDefinition(
        id="solemn_memorial",
        display_name="Solemn & Memorial",
        parent_category="Other",
        description="Somber, subdued, respectful attire in conservative cuts and muted palettes.",
        min_formality=0.68,
        max_formality=0.92,
        target_formality=0.80,
        preferred_categories={"western_top", "western_bottom", "outerwear", "western_dress", "indian_kurta", "footwear"},
        disallowed_categories={"activewear", "gym_top", "shorts", "flip_flops", "loud_prints"},
        compatible_usages={"Formal", "Smart Casual"},
        footwear_preferences=["dark formal shoes", "muted loafers", "subdued flats"],
        prohibited_items=["neon colors", "loud graphic tees", "party glitter", "distressed denim", "shorts"],
        preferred_items=["dark or white solid shirt", "dark trousers", "black or charcoal blazer", "simple white kurta"],
        color_freedom="subdued_dark_or_white",
        weights={"formality_coherence": 0.45, "color_harmony": 0.35, "preference": 0.10, "weather": 0.10},
    ),
    "custom": OccasionDefinition(
        id="custom",
        display_name="Custom Occasion",
        parent_category="Other",
        description="Tailored specifically to your custom scenario, venue, or personal theme.",
        min_formality=0.20,
        max_formality=0.85,
        target_formality=0.50,
        preferred_categories={"western_top", "western_bottom", "western_dress", "outerwear", "footwear"},
        disallowed_categories=set(),
        compatible_usages={"Casual", "Smart Casual", "Formal", "Party", "Ethnic"},
        footwear_preferences=["comfortable versatile footwear"],
        prohibited_items=[],
        preferred_items=[],
        color_freedom="open",
        weights={"preference": 0.40, "color_harmony": 0.25, "comfort": 0.20, "weather": 0.15},
    ),
}


# Comprehensive Aliases Dictionary: Maps any legacy or UI label to canonical ID
OCCASION_ALIASES: Dict[str, str] = {
    # Everyday / Casual
    "everyday": "everyday",
    "daily": "everyday",
    "casual daily": "everyday",
    "casual": "everyday",
    "errands": "everyday",
    "home": "home",
    "loungewear": "home",
    "sleepwear": "home",
    "casual outing": "casual_outing",
    "casual_outing": "casual_outing",
    "outing": "casual_outing",
    "weekend outing": "weekend_outing",
    "weekend_outing": "weekend_outing",
    "weekend": "weekend_outing",
    "college": "college",
    "campus": "college",
    "study": "college",
    "academic": "college",
    "college_campus": "college",
    "family gathering": "family_gathering",
    "family_gathering": "family_gathering",
    "family": "family_gathering",

    # Professional & Academic
    "office": "office",
    "work": "office",
    "work & office": "office",
    "work_office": "office",
    "office_work": "office",
    "business meeting": "business_meeting",
    "business_meeting": "business_meeting",
    "meeting": "business_meeting",
    "presentation": "presentation",
    "keynote": "presentation",
    "pitch": "presentation",
    "interview": "interview",
    "job interview": "interview",
    "job_interview": "interview",
    "conference": "conference",
    "summit": "conference",
    "professional event": "professional_event",
    "professional_event": "professional_event",

    # Social & Evening
    "date": "date",
    "date night": "date",
    "date_night": "date",
    "date_romantic": "date",
    "romantic": "date",
    "dinner": "dinner",
    "fine dining": "dinner",
    "party": "party",
    "party & evening": "party",
    "party_nightlife": "party",
    "night out": "party",
    "night_out": "party",
    "clubbing": "party",
    "birthday": "birthday",
    "celebration": "birthday",

    # Formal & Special
    "formal event": "formal_event",
    "formal_event": "formal_event",
    "formal": "formal_event",
    "black tie": "gala",
    "black_tie": "gala",
    "gala": "gala",
    "wedding": "wedding",
    "ceremony": "wedding",
    "wedding reception": "wedding_reception",
    "wedding_reception": "wedding_reception",
    "reception": "wedding_reception",
    "engagement": "engagement",
    "roka": "engagement",
    "award ceremony": "formal_event",

    # Traditional & Festive
    "festival": "festival",
    "festive": "festival",
    "cultural_religious": "festival",
    "traditional celebration": "festival",
    "religious celebration": "festival",
    "cultural event": "cultural_event",
    "cultural_event": "cultural_event",

    # Functional & Active
    "gym": "gym",
    "gym / sports": "gym",
    "gym & active": "gym",
    "sports_fitness": "gym",
    "fitness": "gym",
    "workout": "gym",
    "athletic": "gym",
    "running": "running",
    "cardio": "running",
    "sports": "sports",
    "outdoor activities": "sports",

    # Travel
    "travel": "travel",
    "travel & airport": "travel",
    "travel_trip": "travel",
    "airport": "travel",
    "vacation": "vacation",
    "holiday": "vacation",
    "business travel": "travel",

    # Other
    "solemn / memorial": "solemn_memorial",
    "solemn_memorial": "solemn_memorial",
    "memorial": "solemn_memorial",
    "funeral": "solemn_memorial",
    "custom occasion": "custom",
    "custom": "custom",
}


def normalize_occasion(raw_occasion: Optional[str]) -> Optional[OccasionDefinition]:
    """
    Normalizes any occasion string to its canonical OccasionDefinition.
    Returns None if raw_occasion is not recognized (no silent fallback).
    """
    if not raw_occasion or not str(raw_occasion).strip():
        return None

    cleaned = str(raw_occasion).strip().lower()

    # 0. Direct match against display names
    for occ_def in OCCASION_DEFINITIONS.values():
        if occ_def.display_name.lower() == cleaned:
            return occ_def

    # 1. Direct canonical lookup
    if cleaned in OCCASION_DEFINITIONS:
        return OCCASION_DEFINITIONS[cleaned]

    # 2. Alias dictionary lookup
    if cleaned in OCCASION_ALIASES:
        canon_id = OCCASION_ALIASES[cleaned]
        return OCCASION_DEFINITIONS[canon_id]

    # 3. Soft matching for compound strings (e.g., "gym / sports")
    cleaned_no_spaces = cleaned.replace(" ", "").replace("&", "").replace("/", "").replace("_", "").replace("-", "")
    for alias_key, canon_id in OCCASION_ALIASES.items():
        alias_clean = alias_key.replace(" ", "").replace("&", "").replace("/", "").replace("_", "").replace("-", "")
        if cleaned_no_spaces == alias_clean:
            return OCCASION_DEFINITIONS[canon_id]

    return None


def get_canonical_occasion_id(raw_occasion: Optional[str]) -> str:
    """
    Returns the canonical occasion string ID, or raises ValueError if invalid.
    Never silently defaults to everyday.
    """
    definition = normalize_occasion(raw_occasion)
    if definition:
        return definition.id
    raise ValueError(f"Unsupported occasion: '{raw_occasion}'. Please choose a recognized occasion.")


def get_occasion_profile_dict(raw_occasion: Optional[str]) -> Dict[str, Any]:
    """
    Backwards-compatible dict provider for legacy occasion_profiles callers.
    Returns complete profile dict or raises ValueError if completely unknown.
    """
    definition = normalize_occasion(raw_occasion)
    if not definition:
        # Check if caller supplied 'Everyday' or empty
        if not raw_occasion or str(raw_occasion).strip().lower() in ("general", "any"):
            definition = OCCASION_DEFINITIONS["everyday"]
        else:
            raise ValueError(f"Unknown or unsupported occasion: '{raw_occasion}'")

    return {
        "id": definition.id,
        "display_name": definition.display_name,
        "parent_category": definition.parent_category,
        "min_formality": definition.min_formality,
        "max_formality": definition.max_formality,
        "target_formality": definition.target_formality,
        "preferred_categories": definition.preferred_categories,
        "disallowed_categories": definition.disallowed_categories,
        "compatible_usages": definition.compatible_usages,
        "footwear_preferences": definition.footwear_preferences,
        "prohibited_items": definition.prohibited_items,
        "preferred_items": definition.preferred_items,
        "color_freedom": definition.color_freedom,
        "weights": definition.weights,
        "description": definition.description,
        "required_slots": ["top_or_one_piece", "bottom_if_two_piece"],
        "recommended_slots": ["footwear"],
    }


def list_grouped_occasions() -> Dict[str, List[Dict[str, Any]]]:
    """
    Returns all occasions grouped by parent category for UI consumption.
    """
    grouped: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in PARENT_CATEGORIES}
    for occ in OCCASION_DEFINITIONS.values():
        if occ.parent_category in grouped:
            grouped[occ.parent_category].append({
                "id": occ.id,
                "display_name": occ.display_name,
                "description": occ.description,
                "target_formality": occ.target_formality,
                "min_formality": occ.min_formality,
                "max_formality": occ.max_formality,
            })
    return grouped
