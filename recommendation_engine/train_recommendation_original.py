
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

TARGET = "synthetic_preference_score"
GROUP = "synthetic_user_id"

CAT = [
    "occupation",
    "industry",
    "dress_code",
    "work_mode",
    "field",
    "meeting_frequency",
    "general_routine_style",
    "weekly_routine",
    "selected_styles",
    "preferred_colors",
    "disliked_colors",
    "selected_fits",
    "comfort_vs_appearance",
    "simple_vs_experimental",
    "selected_occasions",
    "budget_tier",
    "shopping_philosophy",
    "preferred_categories",
    "preferred_platforms",
    "familiar_vs_new",
    "repeat_frequency",
    "variety_preference",
    "top_category",
    "top_subcategory",
    "top_color",
    "top_pattern",
    "bottom_category",
    "bottom_subcategory",
    "bottom_color",
    "bottom_pattern",
    "shoes_category",
    "shoes_subcategory",
    "shoes_color",
    "outfit_style",
    "outfit_fit",
    "color_combination",
]

NUM = [
    "target_formality",
    "comfort_priority",
    "color_pair_top_bottom",
    "color_pair_bottom_shoes",
    "color_pair_top_shoes",
    "color_harmony_score",
    "distinct_non_neutral_colors",
    "rule_of_three_penalty",
    "fit_match",
    "style_match_score",
    "color_preference_affinity",
    "outfit_formality",
    "formality_delta",
    "occasion_score",
    "hard_occasion_eligible",
]


# --------------------------------------------------
# TRAINING
# --------------------------------------------------

def main():

    parser = argparse.ArgumentParser(
        description="Train TailorBird outfit preference model"
    )

    parser.add_argument(
        "--csv",
        default="synthetic_outfit_preferences.csv",
        help="Input training CSV file",
    )

    parser.add_argument(
        "--out",
        default="tailorbird_preference_model.joblib",
        help="Output model file",
    )

    args = parser.parse_args()

    csv_path = Path(args.csv)
    output_path = Path(args.out)

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    print("\nLoading dataset...")

    df = pd.read_csv(csv_path)

    print(f"Dataset rows: {len(df)}")
    print(f"Dataset columns: {len(df.columns)}")

    # Validate required columns
    required = {TARGET, GROUP}
    missing = required - set(df.columns)

    if missing:
        raise ValueError(
            f"Missing required columns: {sorted(missing)}"
        )

    # Use only features available in the CSV
    cat_features = [c for c in CAT if c in df.columns]
    num_features = [c for c in NUM if c in df.columns]

    features = cat_features + num_features

    if not features:
        raise ValueError("No recognized training features found.")

    print(f"\nCategorical features: {len(cat_features)}")
    print(f"Numerical features: {len(num_features)}")

    # Remove invalid target and group rows
    df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")

    df = df.dropna(subset=[TARGET, GROUP]).copy()

    # Prevent identifiers from becoming model features
    X = df[features].copy()
    y = df[TARGET].astype(float)
    groups = df[GROUP]

    # Convert categorical values to strings
    for col in cat_features:
        X[col] = X[col].apply(
            lambda value: str(value) if pd.notna(value) else np.nan
        )

    # Convert numeric columns safely
    for col in num_features:
        X[col] = pd.to_numeric(X[col], errors="coerce")

    if groups.nunique() < 2:
        raise ValueError(
            "At least two distinct users are required for "
            "group-based train/test splitting."
        )

    # --------------------------------------------------
    # USER-LEVEL TRAIN / TEST SPLIT
    # --------------------------------------------------

    print("\nSplitting data by user...")

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.20,
        random_state=42,
    )

    train_idx, test_idx = next(
        splitter.split(X, y, groups=groups)
    )

    X_train = X.iloc[train_idx]
    X_test = X.iloc[test_idx]

    y_train = y.iloc[train_idx]
    y_test = y.iloc[test_idx]

    train_users = set(groups.iloc[train_idx])
    test_users = set(groups.iloc[test_idx])

    assert train_users.isdisjoint(test_users)

    print(f"Training rows: {len(X_train)}")
    print(f"Testing rows: {len(X_test)}")
    print(f"Training users: {len(train_users)}")
    print(f"Testing users: {len(test_users)}")

    # --------------------------------------------------
    # PREPROCESSING
    # --------------------------------------------------

    transformers = []

    if cat_features:
        categorical_pipeline = Pipeline([
            (
                "imputer",
                SimpleImputer(strategy="most_frequent"),
            ),
            (
                "encoder",
                OneHotEncoder(handle_unknown="ignore"),
            ),
        ])

        transformers.append(
            ("cat", categorical_pipeline, cat_features)
        )

    if num_features:
        numerical_pipeline = Pipeline([
            (
                "imputer",
                SimpleImputer(strategy="median"),
            ),
            (
                "scaler",
                StandardScaler(),
            ),
        ])

        transformers.append(
            ("num", numerical_pipeline, num_features)
        )

    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="drop",
    )

    # --------------------------------------------------
    # RANDOM FOREST MODEL
    # --------------------------------------------------

    model = RandomForestRegressor(
        n_estimators=350,
        max_depth=18,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", model),
    ])

    # --------------------------------------------------
    # TRAIN
    # --------------------------------------------------

    print("\nTraining TailorBird recommendation model...")

    pipeline.fit(X_train, y_train)

    print("Training completed.")

    # --------------------------------------------------
    # EVALUATION
    # --------------------------------------------------

    print("\nEvaluating model...")

    predictions = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)

    rmse = np.sqrt(
        mean_squared_error(y_test, predictions)
    )

    r2 = r2_score(y_test, predictions)

    print("\n========== MODEL RESULTS ==========")
    print(f"MAE:  {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"R2:   {r2:.4f}")
    print("===================================\n")

    # --------------------------------------------------
    # SAVE MODEL AND METADATA
    # --------------------------------------------------

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    model_bundle = {
        "model": pipeline,
        "model_name": "TailorBird Random Forest Regressor",
        "model_version": "1.0.0",
        "target": TARGET,
        "group_column": GROUP,
        "features": features,
        "categorical_features": cat_features,
        "numerical_features": num_features,
        "metrics": {
            "mae": float(mae),
            "rmse": float(rmse),
            "r2": float(r2),
        },
        "training_rows": len(X_train),
        "testing_rows": len(X_test),
        "training_users": len(train_users),
        "testing_users": len(test_users),
        "dataset": str(csv_path),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "sklearn_version": sklearn.__version__,
        "data_type": "synthetic",
    }

    joblib.dump(model_bundle, output_path)

    print(f"Model saved successfully: {output_path}")

    # Save separate metadata for inspection
    metadata_path = output_path.with_suffix(".json")

    metadata = {
        key: value
        for key, value in model_bundle.items()
        if key != "model"
    }

    metadata_path.write_text(
        json.dumps(metadata, indent=4),
        encoding="utf-8",
    )

    print(f"Metadata saved: {metadata_path}")

    print("\nTraining pipeline finished successfully.")


if __name__ == "__main__":
    main()
