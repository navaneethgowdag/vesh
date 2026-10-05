from enum import Enum


class ClothingCategory(str, Enum):
    TOPS = "Tops"
    BOTTOMS = "Bottoms"
    DRESSES = "Dresses"
    OUTERWEAR = "Outerwear"
    SHOES = "Shoes"
    ACCESSORIES = "Accessories"
    BAGS = "Bags"


class StyleVibe(str, Enum):
    MINIMAL = "Minimal"
    CASUAL = "Casual"
    STREETWEAR = "Streetwear"
    FORMAL = "Formal"
    VINTAGE = "Vintage"
    SPORTY = "Sporty"
    SMART_CASUAL = "Smart Casual"
    TRENDY = "Trendy"
    BOHO = "Boho"
    OLD_MONEY = "Old Money"
    CLASSIC = "Classic"
    QUIET_LUXURY = "Quiet Luxury"


class Occasion(str, Enum):
    CASUAL_DAILY = "Casual Daily"
    WORK_OFFICE = "Work & Office"
    DATE_NIGHT = "Date Night"
    WEEKEND_OUTING = "Weekend Outing"
    PARTY_EVENING = "Party & Evening"
    TRAVEL_AIRPORT = "Travel & Airport"
    GYM_ACTIVE = "Gym & Active"
    FORMAL_EVENT = "Formal Event"
    # Alternative common names
    CASUAL = "Casual"
    COLLEGE = "College"
    WORK = "Work"
    OFFICE = "Office"
    PARTY = "Party"
    DATE = "Date"
    TRAVEL = "Travel"
    GYM = "Gym"
    WEDDING = "Wedding"
    FESTIVAL = "Festival"
    FORMAL = "Formal"
    EVERYDAY = "Everyday"


class Season(str, Enum):
    SPRING = "Spring"
    SUMMER = "Summer"
    AUTUMN = "Autumn"
    WINTER = "Winter"
    MONSOON = "Monsoon"
    ALL_SEASON = "All-Season"


class FeedbackAction(str, Enum):
    VIEW = "view"
    LIKE = "like"
    SAVE = "save"
    WEAR = "wear"
    REJECT = "reject"
    SKIP = "skip"


# Centralized feedback weights per section 12
FEEDBACK_WEIGHTS: dict[str, float] = {
    FeedbackAction.VIEW.value: 0.02,
    FeedbackAction.LIKE.value: 0.10,
    FeedbackAction.SAVE.value: 0.15,
    FeedbackAction.WEAR.value: 0.25,
    FeedbackAction.REJECT.value: -0.12,
    FeedbackAction.SKIP.value: -0.03,
}


class NotificationType(str, Enum):
    LIKE = "like"
    COMMENT = "comment"
    FOLLOW = "follow"
    DAILY_FIT = "daily_fit"
    MILESTONE = "milestone"
    COLLECTION_SAVE = "collection_save"

