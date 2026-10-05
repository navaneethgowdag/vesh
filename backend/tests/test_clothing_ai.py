from PIL import Image
from app.ai.color_analysis import extract_dominant_colors, calculate_color_harmony, closest_color_name
from app.ai.clothing_classifier import clothing_classifier
from app.ai.outfit_compatibility import compatibility_engine


def test_color_naming():
    assert closest_color_name(20, 20, 20) == "Black"
    assert closest_color_name(250, 250, 250) == "White"
    assert closest_color_name(150, 80, 40) == "Cognac"


def test_color_harmony():
    # Neutrals together
    harmony_neutral = calculate_color_harmony(["Black", "White", "Cream"])
    assert harmony_neutral >= 0.90

    # Complementary pair
    harmony_pair = calculate_color_harmony(["Navy", "Cognac"])
    assert harmony_pair >= 0.90

    # Multiple clashing loud colors
    harmony_clash = calculate_color_harmony(["Red", "Yellow", "Purple", "Green"])
    assert harmony_clash < 0.80


def test_clothing_classifier_predict():
    img = Image.new("RGB", (100, 100), color=(30, 30, 30))
    result = clothing_classifier.predict(img)

    assert "detected_category" in result
    assert "dominant_colors" in result
    assert len(result["dominant_colors"]) > 0
    assert result["confidence"] > 0.0


def test_compatibility_engine():
    class MockItem:
        def __init__(self, cat, col, season="All-Season", occ="Casual Daily"):
            self.category = cat
            self.color = col
            self.season = season
            self.occasion = occ
            self.style_tags = ["Minimal"]

    top = MockItem("Tops", "White")
    bottom = MockItem("Bottoms", "Black")
    shoes = MockItem("Shoes", "Black")

    eval_result = compatibility_engine.evaluate_compatibility([top, bottom, shoes])
    assert eval_result["overall_score"] >= 0.80
    assert eval_result["category_score"] >= 0.80

