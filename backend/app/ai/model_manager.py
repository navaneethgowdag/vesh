import os
import joblib
from typing import Optional
from app.core.config import settings
from app.ai.recommendation_model import recommendation_model


class ModelManager:
    def __init__(self, model_dir: str = settings.AI_MODEL_PATH):
        self.model_dir = model_dir
        os.makedirs(self.model_dir, exist_ok=True)
        self.recommendation_model = recommendation_model

    def get_model(self):
        """Return the recommendation model instance.
        If a trained ML model artifact is loaded, it executes ML inference.
        Otherwise, it provides deterministic compatibility scoring fallback.
        """
        return self.recommendation_model

    def load_recommendation_model(self) -> None:
        model_path = os.path.join(self.model_dir, "recommendation_rf.joblib")
        if os.path.exists(model_path):
            try:
                clf = joblib.load(model_path)
                recommendation_model.model = clf
                recommendation_model.is_trained = True
                print("Loaded recommendation model artifact.")
            except Exception as e:
                print(f"Could not load recommendation model: {e}")
        else:
            recommendation_model.is_trained = False

    def save_recommendation_model(self, model_obj: object) -> None:
        model_path = os.path.join(self.model_dir, "recommendation_rf.joblib")
        try:
            joblib.dump(model_obj, model_path)
            print(f"Saved recommendation model artifact to {model_path}")
        except Exception as e:
            print(f"Failed to save recommendation model: {e}")


model_manager = ModelManager()

