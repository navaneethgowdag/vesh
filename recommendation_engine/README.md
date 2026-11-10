# TailorBird recommendation model v2

Generated from uploaded TailorBird project audit and accompanying schema CSVs.

Files:
- synthetic_users.csv: 500 synthetic profile rows using audited onboarding fields/options.
- synthetic_outfit_preferences.csv: 12733 synthetic user/occasion/outfit examples.
- color_pair_features.csv: pairwise features for the audited 19 canonical clothing colours.
- train_recommendation.py: RandomForest preference-score baseline.

Important:
- Synthetic profile IDs are invented identifiers, not real accounts.
- No real user records or wardrobe records were exported into these CSVs.
- Onboarding feature names/options are drawn from the supplied audit.
- The 30 occasion IDs are drawn from the supplied occasion taxonomy CSV.
- Color taxonomy uses the 19 canonical colors in the audit report.
- Pairwise color scores are transparent approximations based on documented harmony examples and neutral rules; they are NOT the exact production HARMONY_MATRIX. In production, use ColorCoordinationService directly.
- Candidate outfit templates are illustrative training feature examples, not actual wardrobe items.
- Keep occasion/dress-code/ownership/availability/laundry/luxury rules as hard filters outside the ML model.
- Synthetic labels represent a heuristic preference simulator, not actual human preference.
- Evaluate and calibrate against real feedback before promoting this model.
- Budget fields should affect shopping recommendations, not preference ranking for garments already owned.
- The audit reports existing live DB rows (including 1,307 users and 69 feedback rows). Verify those figures and data provenance before using historical data; this package intentionally does not include personal rows.
