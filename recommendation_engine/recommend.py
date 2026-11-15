
"""Inference utilities for TailorBird preference model v2."""
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

def load_model(path="tailorbird_preference_model_v2.joblib"):
    bundle=joblib.load(path)
    return bundle

def score_outfits(user_profile: dict, outfit_candidates: list[dict], model_bundle: dict,
                  top_k: int=10) -> pd.DataFrame:
    """Score candidates. Apply occasion/ownership/availability hard filters BEFORE this call."""
    rows=[]
    for outfit in outfit_candidates:
        row={**user_profile,**outfit}
        rows.append(row)
    frame=pd.DataFrame(rows)
    features=model_bundle["features"]
    for col in features:
        if col not in frame.columns: frame[col]=np.nan
    scores=np.clip(model_bundle["model"].predict(frame[features]),0,1)
    result=pd.DataFrame(outfit_candidates).copy()
    result["preference_score"]=scores
    return result.sort_values("preference_score",ascending=False).head(top_k).reset_index(drop=True)

if __name__=="__main__":
    print("Import score_outfits(), load your .joblib bundle, and pass decoded user/outfit feature dictionaries.")
