"""
StyleSphere Fashion Taxonomy Definition.
Centralized categories, attributes, and zero-shot prompt templates for Western, Indian,
Footwear, and Accessories.
"""

from typing import Dict, List, Any, Optional

# Major taxonomy groups
TAXONOMY_GROUPS = {
    "western": [
        "shirt",
        "t_shirt",
        "jeans",
        "pants",
        "skirt",
        "western_dress",
        "jacket",
        "blazer",
    ],
    "indian": [
        "saree",
        "blouse",
        "kurta",
        "kurti",
        "salwar",
        "churidar",
        "lehenga",
        "sherwani",
        "dupatta",
    ],
    "footwear": [
        "sneakers",
        "sandals",
        "heels",
        "flats",
        "formal_shoes",
        "boots",
    ],
    "accessories": [
        "handbag",
        "backpack",
        "belt",
        "watch",
        "scarf",
        "other_accessory",
    ],
}

# Inverted mapping: category -> group
CATEGORY_TO_GROUP: Dict[str, str] = {}
for grp, cats in TAXONOMY_GROUPS.items():
    for c in cats:
        CATEGORY_TO_GROUP[c] = grp

# Zero-shot prompt definitions for CLIP classification
CATEGORY_PROMPTS: Dict[str, List[str]] = {
    # Western
    "shirt": [
        "a collared button-down dress shirt or casual button-up shirt",
        "a formal buttoned shirt with collar and cuffs",
        "a men's or women's button-front collared shirt",
    ],
    "t_shirt": [
        "a casual t-shirt, tee, crewneck t-shirt, or polo shirt",
        "a casual short-sleeved cotton t-shirt",
        "a graphic tee or basic plain t-shirt",
    ],
    "jeans": [
        "a pair of blue denim jeans pants",
        "denim trousers, blue jeans, skinny or straight jeans",
        "a pair of washed denim jeans with pockets",
    ],
    "pants": [
        "a pair of trousers, slacks, chinos, or formal pants",
        "tailored trousers or casual trousers",
        "dress pants or khaki chinos",
    ],
    "skirt": [
        "a western skirt, mini skirt, midi skirt, or pleated skirt",
        "a women's fashion skirt",
        "an A-line or pencil skirt",
    ],
    "western_dress": [
        "a western dress, cocktail dress, sundress, or evening gown",
        "a one-piece women's dress or frock",
        "a formal or casual western dress",
    ],
    "jacket": [
        "a jacket, outerwear, bomber jacket, denim jacket, or leather jacket",
        "a casual zip-up jacket or coat",
        "a winter jacket or windbreaker",
    ],
    "blazer": [
        "a formal suit blazer or structured tailored suit jacket",
        "a smart formal blazer jacket with lapels",
        "a professional business blazer or sport coat",
    ],
    # Indian
    "saree": [
        "a traditional Indian saree with decorative border and pallu",
        "an elegant silk or cotton saree drape",
        "an Indian sari garment with ornate border work",
    ],
    "blouse": [
        "a saree blouse, Indian choli, cropped traditional blouse",
        "a fitted crop top worn with an Indian saree or lehenga",
        "an Indian ethnic blouse with sleeve and back design",
    ],
    "kurta": [
        "an Indian kurta, traditional long ethnic tunic",
        "a men's or women's ethnic kurta with side slits",
        "a traditional Indian tunic kurta top",
    ],
    "kurti": [
        "a women's ethnic kurti, short to medium length Indian tunic",
        "a casual Indian kurti top",
        "a stylish printed or embroidered women's kurti",
    ],
    "salwar": [
        "Indian salwar pants, loose pleated traditional trousers",
        "traditional salwar bottoms for salwar kameez",
        "loose gathered ethnic Indian salwar pants",
    ],
    "churidar": [
        "Indian churidar trousers, tight fitted ethnic bottoms with ankle gathers",
        "churidar leggings or gathered ethnic trousers",
        "fitted Indian churidar pyjama with gathered cuffs",
    ],
    "lehenga": [
        "an Indian lehenga skirt, flared ethnic bridal or festive skirt",
        "a heavy embroidered Indian lehenga choli skirt",
        "a traditional voluminous Indian ghagra or lehenga",
    ],
    "sherwani": [
        "an Indian men's royal sherwani, long buttoned wedding coat",
        "a traditional festive Indian sherwani with mandarin collar",
        "an ornate men's achkan or groom sherwani",
    ],
    "dupatta": [
        "an Indian dupatta, traditional ethnic scarf, stole, or chunni",
        "a lightweight sheer draped Indian dupatta with border",
        "an ornate festive dupatta or chunari",
    ],
    # Footwear
    "sneakers": [
        "a pair of sneakers, athletic trainers, running shoes, tennis shoes",
        "casual streetwear sneakers or sports shoes",
    ],
    "sandals": [
        "a pair of open-toe sandals, strappy flat sandals, or slides",
        "casual summer sandals or ethnic footwear",
    ],
    "heels": [
        "a pair of high heels, stiletto pumps, or heeled sandals",
        "women's high-heeled dress shoes or pumps",
    ],
    "flats": [
        "a pair of flat shoes, ballet flats, loafers, or slip-on flats",
        "casual flat dress shoes or moccasins",
    ],
    "formal_shoes": [
        "a pair of formal leather dress shoes, oxfords, brogues, derby shoes",
        "men's formal polished leather business shoes",
    ],
    "boots": [
        "a pair of boots, ankle boots, chelsea boots, or leather winter boots",
        "sturdy high-top boots or fashion booties",
    ],
    # Accessories
    "handbag": [
        "a women's handbag, purse, tote bag, shoulder bag, or clutch",
        "a leather handbag or designer purse",
    ],
    "backpack": [
        "a backpack, rucksack, school bag, or travel daypack",
        "a casual zippered backpack with shoulder straps",
    ],
    "belt": [
        "a waist belt, leather belt with metal buckle",
        "a dress belt or casual fashion belt",
    ],
    "watch": [
        "a wristwatch, luxury analog watch, or digital timepiece",
        "a wrist watch with strap and dial",
    ],
    "scarf": [
        "a fashion scarf, neckerchief, winter muffler, or wrap",
        "a soft woolen or silk fashion scarf",
    ],
    "other_accessory": [
        "a fashion accessory, sunglasses, hat, cap, tie, or jewelry piece",
        "a personal styling fashion accessory",
    ],
}

# Standard 27 fashion colors with RGB and CIELAB reference coordinates
# Used for perceptual Delta-E nearest neighbor color matching
COLOR_PALETTE: Dict[str, Dict[str, Any]] = {
    "Black": {"hex": "#111111", "rgb": (17, 17, 17), "family": "neutral"},
    "White": {"hex": "#F8F9FA", "rgb": (248, 249, 250), "family": "neutral"},
    "Grey": {"hex": "#808080", "rgb": (128, 128, 128), "family": "neutral"},
    "Navy Blue": {"hex": "#1B2A4A", "rgb": (27, 42, 74), "family": "blue"},
    "Royal Blue": {"hex": "#2B50AA", "rgb": (43, 80, 170), "family": "blue"},
    "Sky Blue": {"hex": "#87CEEB", "rgb": (135, 206, 235), "family": "blue"},
    "Teal": {"hex": "#008080", "rgb": (0, 128, 128), "family": "blue-green"},
    "Beige": {"hex": "#F5F0E1", "rgb": (245, 240, 225), "family": "neutral"},
    "Tan": {"hex": "#C19A6B", "rgb": (193, 154, 107), "family": "brown"},
    "Brown": {"hex": "#5D3A1A", "rgb": (93, 58, 26), "family": "brown"},
    "Cream": {"hex": "#FFFDD0", "rgb": (255, 253, 208), "family": "neutral"},
    "Red": {"hex": "#D32F2F", "rgb": (211, 47, 47), "family": "red"},
    "Maroon": {"hex": "#6D1A24", "rgb": (109, 26, 36), "family": "red"},
    "Pink": {"hex": "#E91E63", "rgb": (233, 30, 99), "family": "pink"},
    "Dusty Rose": {"hex": "#C98A8F", "rgb": (201, 138, 143), "family": "pink"},
    "Coral": {"hex": "#FF7F50", "rgb": (255, 127, 80), "family": "orange"},
    "Orange": {"hex": "#FF9800", "rgb": (255, 152, 0), "family": "orange"},
    "Rust": {"hex": "#A0441E", "rgb": (160, 68, 30), "family": "orange"},
    "Yellow": {"hex": "#FDD835", "rgb": (253, 216, 53), "family": "yellow"},
    "Mustard": {"hex": "#DDAA33", "rgb": (221, 170, 51), "family": "yellow"},
    "Olive Green": {"hex": "#556B2F", "rgb": (85, 107, 47), "family": "green"},
    "Emerald Green": {"hex": "#1B5E20", "rgb": (27, 94, 32), "family": "green"},
    "Mint Green": {"hex": "#A8E6CF", "rgb": (168, 230, 207), "family": "green"},
    "Purple": {"hex": "#6A1B9A", "rgb": (106, 27, 154), "family": "purple"},
    "Lavender": {"hex": "#B39DDB", "rgb": (179, 157, 219), "family": "purple"},
    "Gold": {"hex": "#D4AF37", "rgb": (212, 175, 55), "family": "metallic"},
    "Silver": {"hex": "#B0B3B8", "rgb": (176, 179, 184), "family": "metallic"},
}

# Patterns
PATTERNS = [
    "solid",
    "striped",
    "plaid_check",
    "floral",
    "printed",
    "abstract",
    "textured",
    "polka_dot",
    "geometric",
    "tie_dye",
    "embroidered",
]

PATTERN_PROMPTS: Dict[str, List[str]] = {
    "solid": ["a solid plain garment without any pattern or print"],
    "striped": ["striped clothing pattern with vertical or horizontal stripes"],
    "plaid_check": ["plaid, gingham, checkered or tartan pattern clothing"],
    "floral": ["clothing with floral print, flower motifs or floral pattern"],
    "printed": ["clothing with graphic print, text, or artistic print"],
    "abstract": ["clothing with abstract artistic pattern or swirl design"],
    "textured": ["clothing with textured fabric weave, cable knit, waffle, or ribbed texture"],
    "polka_dot": ["clothing with polka dot pattern, dotted circles"],
    "geometric": ["clothing with geometric pattern, chevron, zig-zag or diamonds"],
    "tie_dye": ["clothing with tie dye pattern, dip-dye or ombre wash"],
    "embroidered": ["clothing with detailed needle embroidery, threadwork, or embellishment"],
}

# Styles
STYLES = [
    "casual",
    "formal",
    "semi_formal",
    "ethnic",
    "streetwear",
    "party",
    "loungewear",
    "business_casual",
]

STYLE_PROMPTS: Dict[str, List[str]] = {
    "casual": ["casual everyday outfit, comfortable and relaxed clothing"],
    "formal": ["formal business or black-tie attire, elegant suit or formal wear"],
    "semi_formal": ["semi-formal smart casual clothing"],
    "ethnic": ["traditional ethnic Indian heritage attire"],
    "streetwear": ["trendy urban streetwear fashion outfit"],
    "party": ["party wear, nightlife glamour clothing, celebratory outfit"],
    "loungewear": ["cozy loungewear, sleepwear, relaxing home attire"],
    "business_casual": ["business casual workplace professional outfit"],
}

# Seasons
SEASONS = [
    "all_season",
    "summer",
    "winter",
    "monsoon",
    "spring",
    "autumn",
]

SEASON_PROMPTS: Dict[str, List[str]] = {
    "all_season": ["all-season year-round versatile clothing"],
    "summer": ["lightweight breathable summer clothing, cool weather wear"],
    "winter": ["warm winter clothing, heavy thermal knit or outerwear"],
    "monsoon": ["monsoon season rain-friendly clothing"],
    "spring": ["breezy cheerful spring seasonal clothing"],
    "autumn": ["fall autumn transitional layer clothing"],
}

# Occasions
OCCASIONS = [
    "casual",
    "work",
    "evening",
    "festive",
    "party",
    "wedding",
    "sports",
    "everyday",
]

OCCASION_PROMPTS: Dict[str, List[str]] = {
    "casual": ["casual everyday weekend wear"],
    "work": ["formal work office corporate wear"],
    "evening": ["elegant evening dinner or date night wear"],
    "festive": ["festive celebration Diwali Eid puja traditional wear"],
    "party": ["party club dance celebratory wear"],
    "wedding": ["wedding guest or wedding ceremony bridal wear"],
    "sports": ["athletic sportswear gym fitness workout clothing"],
    "everyday": ["everyday daily wear, basic daily clothing"],
}

# Fabrics (with explicit 'unknown' handled when visual confidence is low)
FABRICS = [
    "cotton",
    "silk",
    "denim",
    "linen",
    "wool",
    "polyester",
    "chiffon",
    "georgette",
    "velvet",
    "leather",
    "satin",
    "rayon",
    "lace",
    "unknown",
]

FABRIC_PROMPTS: Dict[str, List[str]] = {
    "cotton": ["natural cotton fabric, matte breathable cotton weave"],
    "silk": ["smooth shiny luxurious silk fabric with subtle sheen"],
    "denim": ["sturdy twill denim fabric with jean weave"],
    "linen": ["textured natural linen fabric with slight slub"],
    "wool": ["warm woolen knit, felted wool, or wool blend"],
    "polyester": ["synthetic polyester microfiber smooth fabric"],
    "chiffon": ["sheer lightweight floating airy chiffon fabric"],
    "georgette": ["translucent crinkled georgette ethnic fabric"],
    "velvet": ["plush soft velvet or velour with rich nap"],
    "leather": ["genuine leather or faux leather smooth surface"],
    "satin": ["glossy slippery lustrous satin fabric"],
    "rayon": ["flowing soft rayon or viscose fabric"],
    "lace": ["openwork delicate lace or eyelet embroidered fabric"],
}

# Base formality index per category [0.0 - 1.0]
BASE_FORMALITY: Dict[str, float] = {
    "t_shirt": 0.15,
    "jeans": 0.25,
    "sneakers": 0.20,
    "backpack": 0.20,
    "sandals": 0.30,
    "flats": 0.40,
    "kurti": 0.45,
    "pants": 0.55,
    "shirt": 0.60,
    "skirt": 0.55,
    "western_dress": 0.65,
    "boots": 0.50,
    "jacket": 0.50,
    "handbag": 0.50,
    "salwar": 0.55,
    "churidar": 0.60,
    "kurta": 0.65,
    "blazer": 0.85,
    "formal_shoes": 0.80,
    "saree": 0.80,
    "blouse": 0.70,
    "dupatta": 0.65,
    "sherwani": 0.90,
    "lehenga": 0.95,
    "belt": 0.50,
    "watch": 0.55,
    "scarf": 0.45,
    "other_accessory": 0.40,
}

# Category-specific attribute schemas
CATEGORY_SPECIFIC_SCHEMAS: Dict[str, Dict[str, List[str]]] = {
    "saree": {
        "border_type": ["zari", "contrast", "embroidered", "printed", "minimal", "none"],
        "pallu_design": ["heavy_zari", "printed", "striped", "embellished", "simple"],
        "weave_type": ["banarasi", "kanjeevaram", "chanderi", "tussar", "cotton", "georgette", "silk_blend", "plain"],
        "embroidery_work": ["zari", "threadwork", "sequins", "mirror_work", "gota_patti", "none"],
    },
    "lehenga": {
        "skirt_silhouette": ["flared", "a_line", "panelled", "mermaid", "ruffled"],
        "border_style": ["broad_zari", "embroidered", "scalloped", "patchwork", "minimal"],
        "embroidery_work": ["zardozi", "zari", "gota_patti", "mirror_work", "sequins", "threadwork", "printed"],
    },
    "kurta": {
        "length": ["short", "knee_length", "calf_length", "floor_length"],
        "neckline": ["mandarin_collar", "round_neck", "v_neck", "boat_neck", "keyhole", "angrakha"],
        "sleeve_length": ["full", "three_quarter", "short", "sleeveless"],
        "fit_type": ["straight", "anarkali", "a_line", "flared", "regular"],
    },
    "kurti": {
        "length": ["short", "knee_length", "calf_length"],
        "neckline": ["round_neck", "v_neck", "mandarin_collar", "boat_neck", "keyhole", "square_neck"],
        "sleeve_length": ["three_quarter", "short", "sleeveless", "full"],
        "fit_type": ["straight", "a_line", "flared", "asymmetric", "regular"],
    },
    "shirt": {
        "collar_style": ["classic_collar", "spread_collar", "mandarin_collar", "button_down", "cuban_collar"],
        "sleeve_length": ["long", "short", "rolled_up"],
        "fit_type": ["slim", "regular", "relaxed", "tailored"],
        "length": ["regular", "long", "tucked"],
    },
    "t_shirt": {
        "collar_style": ["crew_neck", "v_neck", "polo_collar", "henley", "scoop_neck"],
        "sleeve_length": ["short", "long", "sleeveless"],
        "fit_type": ["regular", "slim", "relaxed", "oversized"],
        "length": ["regular", "cropped", "long"],
    },
    "jeans": {
        "fit_type": ["slim", "skinny", "regular", "straight", "relaxed", "wide_leg", "bootcut"],
        "length": ["full_length", "ankle_length", "cropped"],
        "waist_style": ["mid_rise", "high_rise", "low_rise"],
    },
    "pants": {
        "fit_type": ["slim", "regular", "straight", "relaxed", "wide_leg", "tapered"],
        "length": ["full_length", "ankle_length", "cropped"],
        "waist_style": ["mid_rise", "high_rise", "low_rise"],
    },
    "skirt": {
        "silhouette": ["a_line", "pencil", "pleated", "flared", "wrap", "tiered"],
        "length": ["mini", "midi", "maxi", "knee_length"],
        "waist_style": ["high_rise", "mid_rise", "elastic"],
    },
    "western_dress": {
        "silhouette": ["a_line", "bodycon", "fit_and_flare", "shift", "wrap", "maxi", "slip"],
        "neckline": ["v_neck", "round_neck", "square_neck", "sweetheart", "off_shoulder", "halter"],
        "length": ["mini", "knee_length", "midi", "maxi"],
        "sleeve_length": ["sleeveless", "short", "three_quarter", "long", "spaghetti_strap"],
    },
}

# Display labels for readable UI presentation
CATEGORY_DISPLAY_NAMES = {
    "shirt": "Shirt",
    "t_shirt": "T-Shirt",
    "jeans": "Jeans",
    "pants": "Pants / Trousers",
    "skirt": "Skirt",
    "western_dress": "Western Dress",
    "jacket": "Jacket",
    "blazer": "Blazer",
    "saree": "Saree",
    "blouse": "Saree Blouse / Choli",
    "kurta": "Kurta",
    "kurti": "Kurti",
    "salwar": "Salwar",
    "churidar": "Churidar",
    "lehenga": "Lehenga",
    "sherwani": "Sherwani",
    "dupatta": "Dupatta",
    "sneakers": "Sneakers",
    "sandals": "Sandals",
    "heels": "Heels",
    "flats": "Flats",
    "formal_shoes": "Formal Shoes",
    "boots": "Boots",
    "handbag": "Handbag",
    "backpack": "Backpack",
    "belt": "Belt",
    "watch": "Watch",
    "scarf": "Scarf",
    "other_accessory": "Other Accessory",
}
