# Image model integration notes

The supplied `best_model(1).pt` checkpoint identifies an EfficientNet-B0 multi-task image model:
- input image size: 224
- tasks: `articleType`, `masterCategory`, `subCategory`, `gender`, `baseColour`, `season`, `usage`, `pattern`, `ageGroup`
- output class counts: 142, 7, 45, 5, 47, 5, 9, 16, 6 respectively
- checkpoint validation score field: 0.8565210866

## Critical integration requirement
The checkpoint contains `model_state_dict`, `model_config`, and `val_score`; the inspected config does **not** contain the class-index-to-label vocabularies, preprocessing/normalization definition, or model-construction code. Do not interpret output index 12 as a specific colour/category until the exact class vocabulary and preprocessing used during image training are recovered.

The `.joblib` model in this package is a separate preference scorer. It does not load the PyTorch checkpoint. The application should:
1. Instantiate the exact EfficientNet-B0 multi-head architecture used to create the checkpoint.
2. Load `model_state_dict` strictly.
3. Apply the original 224px resize/crop, RGB conversion, tensor scaling and normalization.
4. Decode each head using the exact saved training vocabularies.
5. Map `articleType`/`masterCategory`/`subCategory`/`baseColour`/`pattern` to TailorBird's garment taxonomy.
6. Compute outfit-level features (colour harmony, formality, fit, occasion, preference affinity) in the backend.
7. Pass those normalized features to the preference `.joblib` pipeline.

Do not feed raw neural-network logits or class indices directly into the `.joblib` model. Its training columns are human-readable garment/profile attributes and engineered outfit features.
