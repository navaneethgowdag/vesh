
import argparse, json
from pathlib import Path
import numpy as np
import pandas as pd

TARGET="synthetic_preference_score"
GROUP="synthetic_user_id"
COLORS=["black","white","gray","navy","blue","light_blue","teal","dark_green","olive","beige","brown","mustard","yellow","orange","coral","red","burgundy","pink","purple"]

def tokens(v):
    return set(str(v).split("|")) if pd.notna(v) and str(v)!="nan" else set()

def color_family(c):
    return {
      "black":"Black","white":"White","gray":"Grey","navy":"Navy","blue":"Jewel Tones",
      "light_blue":"Pastels","teal":"Jewel Tones","dark_green":"Olive Green","olive":"Olive Green",
      "beige":"Beige / Khaki","brown":"Brown","mustard":"Vibrant / Bright","yellow":"Vibrant / Bright",
      "orange":"Vibrant / Bright","coral":"Vibrant / Bright","red":"Jewel Tones",
      "burgundy":"Jewel Tones","pink":"Pastels","purple":"Jewel Tones"
    }.get(c,"")

def preference_affinity(row):
    preferred=tokens(row.get("preferred_colors"))
    disliked=tokens(row.get("disliked_colors"))
    outfit={row.get("top_color"),row.get("bottom_color"),row.get("shoes_color")}
    fam={color_family(c) for c in outfit if c in COLORS}
    good=len(fam & preferred); bad=len(fam & disliked)
    return float(np.clip(0.5 + 0.12*good - 0.16*bad,0,1))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",required=True); ap.add_argument("--output",required=True)
    ap.add_argument("--copies",type=int,default=2); ap.add_argument("--seed",type=int,default=2026)
    a=ap.parse_args()
    src=pd.read_csv(a.input)
    rng=np.random.default_rng(a.seed)
    color_path=Path(a.input).with_name("color_pair_features.csv")
    if not color_path.exists():
        color_path=Path(a.input).with_name("color_pair_features(1).csv")
    color_df=pd.read_csv(color_path)
    cmap={(r.color_a,r.color_b):float(r.harmony_score_heuristic) for r in color_df.itertuples()}
    rows=[]
    for i,base in src.iterrows():
        for j in range(a.copies):
            r=base.copy()
            # Keep the same synthetic user so user-grouped evaluation prevents
            # variants of one profile leaking across train/test.
            edits=[]
            if rng.random()<0.55:
                col=rng.choice(COLORS); r["top_color"]=col; edits.append("top_color")
            if rng.random()<0.45:
                col=rng.choice(COLORS); r["bottom_color"]=col; edits.append("bottom_color")
            if rng.random()<0.30:
                col=rng.choice(COLORS); r["shoes_color"]=col; edits.append("shoes_color")
            if rng.random()<0.35:
                r["top_pattern"]=rng.choice(["Solid","Striped","Checked","Printed","Graphic"]); edits.append("top_pattern")
            if rng.random()<0.30:
                r["outfit_fit"]=rng.choice(["Slim","Regular","Relaxed","Oversized","Tailored"]); edits.append("outfit_fit")
            if rng.random()<0.25:
                r["outfit_style"]=rng.choice(["Casual","Smart casual","Formal","Chic","Streetwear","Minimalist","Traditional Indian","Sporty"]); edits.append("outfit_style")
            if not edits: continue
            # Recompute available colour-derived fields from the supplied heuristic table.
            t,b,s=str(r["top_color"]),str(r["bottom_color"]),str(r["shoes_color"])
            r["color_pair_top_bottom"]=cmap.get((t,b),cmap.get((b,t),0.82))
            r["color_pair_bottom_shoes"]=cmap.get((b,s),cmap.get((s,b),0.82))
            r["color_pair_top_shoes"]=cmap.get((t,s),cmap.get((s,t),0.82))
            r["color_harmony_score"]=float(np.mean([r["color_pair_top_bottom"],r["color_pair_bottom_shoes"],r["color_pair_top_shoes"]]))
            r["color_combination"]=f"{t}+{b}+{s}"
            non_neutral={"black","white","gray","navy"}
            r["distinct_non_neutral_colors"]=len({x for x in (t,b,s) if x not in non_neutral})
            r["rule_of_three_penalty"]=max(0.0,(r["distinct_non_neutral_colors"]-3)*0.1)
            # Recompute preference affinity and apply a small transparent heuristic
            # delta relative to the source example; these remain synthetic labels.
            old_aff=float(base.get("color_preference_affinity",0.5) or 0.5)
            new_aff=preference_affinity(r)
            r["color_preference_affinity"]=new_aff
            old_h=float(base.get("color_harmony_score",0.82) or 0.82)
            fit_delta=0.0
            if "outfit_fit" in edits and pd.notna(r.get("fit_match")):
                fit_delta=float(r["fit_match"])*0.025 if r["outfit_fit"] in tokens(r.get("selected_fits")) else -0.015
            style_delta=0.0
            if "outfit_style" in edits:
                chosen=tokens(r.get("selected_styles"))
                style_delta=0.025 if r["outfit_style"] in chosen else -0.012
            score=float(base[TARGET]) + 0.18*(new_aff-old_aff) + 0.10*(float(r["color_harmony_score"])-old_h) + fit_delta + style_delta
            r[TARGET]=float(np.clip(score+rng.normal(0,0.008),0,1))
            r["label_source"]="synthetic_augmentation_heuristic_v2"
            rows.append(r)
    aug=pd.DataFrame(rows,columns=src.columns)
    combined=pd.concat([src,aug],ignore_index=True)
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    combined.to_csv(a.output,index=False)
    report={"source_rows":len(src),"augmented_rows":len(aug),"total_rows":len(combined),
            "source_users":int(src[GROUP].nunique()),"copies_requested":a.copies,
            "label_type":"synthetic heuristic; not human feedback",
            "augmentation":"bounded outfit attribute perturbations; recomputed pairwise colour features and adjusted heuristic score"}
    Path(a.output).with_suffix(".report.json").write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
if __name__=="__main__": main()
