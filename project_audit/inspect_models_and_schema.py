import sys
import os
import json

def inspect_classes():
    with open("artifacts/class_mappings.json", "r", encoding="utf-8") as f:
        cm = json.load(f)
    print("=== FASHION MODEL HEADS & CLASSES ===")
    for k, v in cm.items():
        classes = v.get("classes", [])
        print(f"Task: {k} (count: {len(classes)})")
        if len(classes) <= 20:
            print(f"  Classes: {classes}")
        else:
            print(f"  Sample classes: {classes[:5]} ... {classes[-5:]}")

def inspect_evaluation_report():
    if os.path.exists("artifacts/evaluation_report.json"):
        with open("artifacts/evaluation_report.json", "r", encoding="utf-8") as f:
            report = json.load(f)
        print("\n=== CLOTHING MODEL EVALUATION REPORT ===")
        print(f"Model: {report.get('model_name')}, version: {report.get('model_version')}")
        print("Metrics per task:")
        for task, m in report.get("task_metrics", {}).items():
            print(f"  {task}: acc={m.get('accuracy')}, f1_macro={m.get('macro_f1') or m.get('f1_macro')}")

def inspect_rec_model_details():
    if os.path.exists("recommendation_engine/tailorbird_preference_model.json"):
        with open("recommendation_engine/tailorbird_preference_model.json", "r", encoding="utf-8") as f:
            rec = json.load(f)
        print("\n=== RECOMMENDATION MODEL JSON ===")
        for k, v in rec.items():
            if isinstance(v, list) and len(v) > 10:
                print(f"{k}: list of {len(v)} items: {v[:5]} ...")
            else:
                print(f"{k}: {v}")

if __name__ == "__main__":
    inspect_classes()
    inspect_evaluation_report()
    inspect_rec_model_details()
