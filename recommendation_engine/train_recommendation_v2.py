
import argparse, json
from pathlib import Path
from datetime import datetime, timezone
import joblib, numpy as np, pandas as pd, sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

TARGET="synthetic_preference_score"; GROUP="synthetic_user_id"
CAT=["occupation","student_campus_dress","professional_industry","professional_dress_code",
"professional_work_mode","freelancer_field","freelancer_meeting_frequency","general_routine_style",
"weekly_routine_profile","selected_styles","disliked_styles","preferred_colors","disliked_colors",
"selected_fits","comfort_vs_appearance","simple_vs_experimental","target_occasion","budget_tier",
"shopping_philosophy","familiar_vs_new","repeat_frequency","variety_preference","top_category",
"top_subcategory","top_color","top_pattern","bottom_category","bottom_subcategory","bottom_color",
"bottom_pattern","shoes_category","shoes_subcategory","shoes_color","color_combination",
"outfit_style","outfit_fit","relevance_label"]
NUM=["target_formality","comfort_priority","color_pair_top_bottom","color_pair_bottom_shoes",
"color_pair_top_shoes","color_harmony_score","distinct_non_neutral_colors","rule_of_three_penalty",
"fit_match","style_match_score","color_preference_affinity","outfit_formality","formality_delta",
"occasion_score","hard_occasion_eligible"]

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--csv",required=True); p.add_argument("--out",default="tailorbird_preference_model.joblib")
    p.add_argument("--trees",type=int,default=180); p.add_argument("--seed",type=int,default=42)
    a=p.parse_args()
    df=pd.read_csv(a.csv)
    missing={TARGET,GROUP}-set(df.columns)
    if missing: raise ValueError(f"Missing required columns: {sorted(missing)}")
    df[TARGET]=pd.to_numeric(df[TARGET],errors="coerce")
    df=df.dropna(subset=[TARGET,GROUP]).copy()
    high_cardinality_dropped=[c for c in CAT if c in df.columns and df[c].nunique(dropna=True)>255]
    cats=[c for c in CAT if c in df.columns and df[c].nunique(dropna=True)<=255]
    nums=[c for c in NUM if c in df.columns]
    features=cats+nums
    X=df[features].copy(); y=df[TARGET].astype(float); groups=df[GROUP].astype(str)
    for c in cats: X[c]=X[c].where(X[c].notna(),np.nan).astype(object)
    for c in nums: X[c]=pd.to_numeric(X[c],errors="coerce")
    split=GroupShuffleSplit(n_splits=1,test_size=.20,random_state=a.seed)
    tr,te=next(split.split(X,y,groups))
    assert set(groups.iloc[tr]).isdisjoint(set(groups.iloc[te]))
    prep=ColumnTransformer([
      ("cat",Pipeline([("impute",SimpleImputer(strategy="most_frequent")),
                       ("encode",OrdinalEncoder(handle_unknown="use_encoded_value",unknown_value=-1))]),cats),
      ("num",Pipeline([("impute",SimpleImputer(strategy="median"))]),nums)
    ],remainder="drop",sparse_threshold=0)
    estimator=HistGradientBoostingRegressor(max_iter=180,max_leaf_nodes=24,
        learning_rate=0.07,l2_regularization=1.5,random_state=a.seed,
        categorical_features=list(range(len(cats))))
    model=Pipeline([("preprocessor",prep),("model",estimator)])
    model.fit(X.iloc[tr],y.iloc[tr])
    pred=np.clip(model.predict(X.iloc[te]),0,1)
    metrics={"mae":float(mean_absolute_error(y.iloc[te],pred)),
             "rmse":float(np.sqrt(mean_squared_error(y.iloc[te],pred))),
             "r2":float(r2_score(y.iloc[te],pred))}
    bundle={"model":model,"model_name":"TailorBird Outfit Preference Ranker",
      "model_version":"2.0.0","target":TARGET,"group_column":GROUP,"features":features,
      "categorical_features":cats,"numerical_features":nums,"dropped_high_cardinality_features":high_cardinality_dropped,"metrics":metrics,
      "training_rows":int(len(tr)),"testing_rows":int(len(te)),
      "training_users":int(groups.iloc[tr].nunique()),"testing_users":int(groups.iloc[te].nunique()),
      "dataset":str(Path(a.csv).name),"trained_at":datetime.now(timezone.utc).isoformat(),
      "sklearn_version":sklearn.__version__,"data_type":"synthetic_augmented_heuristic",
      "evaluation_note":"User-disjoint holdout. Metrics measure agreement with synthetic labels, not real user preference.",
      "image_model_reference":{"file":"best_model(1).pt","backbone":"efficientnet_b0","image_size":224,
        "tasks":["articleType","masterCategory","subCategory","gender","baseColour","season","usage","pattern","ageGroup"],
        "integration":"Map image predictions into garment attributes before scoring. This .joblib does not load the PyTorch image model."}}
    out=Path(a.out); out.parent.mkdir(parents=True,exist_ok=True); joblib.dump(bundle,out,compress=3)
    meta={k:v for k,v in bundle.items() if k!="model"}
    out.with_suffix(".json").write_text(json.dumps(meta,indent=2))
    print(json.dumps({"model_path":str(out),"metadata_path":str(out.with_suffix('.json')),
      "metrics":metrics,"train_rows":len(tr),"test_rows":len(te),
      "train_users":int(groups.iloc[tr].nunique()),"test_users":int(groups.iloc[te].nunique()),
      "features":len(features)},indent=2))
if __name__=="__main__": main()
