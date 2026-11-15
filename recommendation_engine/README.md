# TailorBird recommendation model v2 — development package

## What was built
- `synthetic_outfit_preferences_v2.csv`: 36,749 total source + augmented rows (see report).
- `augment_dataset.py`: reproducible, seeded augmentation script.
- `train_recommendation_v2.py`: group-aware training and evaluation.
- `tailorbird_preference_model_v2.joblib`: trained scikit-learn pipeline + metadata.
- `tailorbird_preference_model_v2.json`: model metadata and evaluation metrics.
- `recommend.py`: minimal inference helper.
- `image_model_integration.md`: image model integration notes.

## Training result
The model was evaluated with a user-disjoint holdout split (400 train users / 100 test users).
- MAE: 0.04479
- RMSE: 0.05649
- R²: 0.87622

These metrics measure fit to the generated synthetic heuristic labels. They are **not** evidence of equivalent performance on real users. Augmented examples are related to their source users and remain in the same group during splitting.

## Run
Install compatible dependencies:
`pip install pandas numpy scikit-learn joblib`

Regenerate augmented data (from the folder containing original CSVs):
`python augment_dataset.py --input synthetic_outfit_preferences.csv --output synthetic_outfit_preferences_v2.csv --copies 2`

Train:
`python train_recommendation_v2.py --csv synthetic_outfit_preferences_v2.csv --out tailorbird_preference_model_v2.joblib`

Use:
```python
import joblib
from recommend import score_outfits
bundle = joblib.load("tailorbird_preference_model_v2.joblib")
ranked = score_outfits(user_profile, candidate_outfits, bundle, top_k=10)
```
`user_profile` and each candidate outfit must use the same column names/representations as the training CSV. Missing model inputs are imputed by the pipeline.

## Recommendation architecture
1. Decode garment images into garment attributes.
2. Normalize those attributes to the TailorBird canonical taxonomy.
3. Build candidate outfit feature rows using the production colour coordination service and user preference features.
4. Apply hard eligibility filters (occasion, dress code, ownership, availability, laundry, safety/product constraints).
5. Score eligible candidates with the `.joblib` model.
6. Add diversity/reranking after scoring so the feed does not contain near-duplicate outfits.
7. Collect explicit feedback and retrain/calibrate against real feedback.

Budget/shopping philosophy should affect shopping candidates, not preference ranking for garments already owned.
