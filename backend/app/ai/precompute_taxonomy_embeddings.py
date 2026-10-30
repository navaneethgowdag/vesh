"""
Script to precompute CLIP text embeddings for the fashion taxonomy and save them to a compact NPZ file.
This allows sub-millisecond zero-shot inference without running the text model at request time.
"""

import os
import sys
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

# Ensure backend path is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)

from app.ai.fashion_taxonomy import (
    CATEGORY_PROMPTS,
    PATTERN_PROMPTS,
    STYLE_PROMPTS,
    SEASON_PROMPTS,
    OCCASION_PROMPTS,
    FABRIC_PROMPTS,
)

MODELS_DIR = os.path.join(BASE_DIR, "ai_models")
TOKENIZER_PATH = os.path.join(MODELS_DIR, "tokenizer.json")
TEXT_MODEL_PATH = os.path.join(MODELS_DIR, "clip_text_quantized.onnx")
OUTPUT_NPZ_PATH = os.path.join(MODELS_DIR, "fashion_taxonomy_embeddings.npz")


def precompute():
    print(f"Loading tokenizer from {TOKENIZER_PATH}...")
    tokenizer = Tokenizer.from_file(TOKENIZER_PATH)
    tokenizer.enable_padding(length=77, pad_id=0)
    tokenizer.enable_truncation(max_length=77)

    print(f"Loading ONNX text model from {TEXT_MODEL_PATH}...")
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    session = ort.InferenceSession(TEXT_MODEL_PATH, opts)

    def embed_prompts(prompt_list: list) -> np.ndarray:
        encodings = [tokenizer.encode(p) for p in prompt_list]
        input_ids = np.array([e.ids for e in encodings], dtype=np.int64)
        out = session.run(None, {"input_ids": input_ids})[0]
        # L2-normalize each prompt embedding
        norms = np.linalg.norm(out, axis=-1, keepdims=True)
        norms[norms == 0] = 1e-12
        normalized = out / norms
        # Mean across prompts for this category/attribute and re-normalize
        mean_emb = np.mean(normalized, axis=0)
        mean_norm = np.linalg.norm(mean_emb)
        if mean_norm > 0:
            mean_emb = mean_emb / mean_norm
        return mean_emb.astype(np.float32)

    def process_group(dict_prompts: dict):
        keys = list(dict_prompts.keys())
        embeddings = []
        for k in keys:
            emb = embed_prompts(dict_prompts[k])
            embeddings.append(emb)
        return keys, np.array(embeddings, dtype=np.float32)

    print("Computing category embeddings...")
    cat_keys, cat_embs = process_group(CATEGORY_PROMPTS)

    print("Computing pattern embeddings...")
    pat_keys, pat_embs = process_group(PATTERN_PROMPTS)

    print("Computing style embeddings...")
    sty_keys, sty_embs = process_group(STYLE_PROMPTS)

    print("Computing season embeddings...")
    sea_keys, sea_embs = process_group(SEASON_PROMPTS)

    print("Computing occasion embeddings...")
    occ_keys, occ_embs = process_group(OCCASION_PROMPTS)

    print("Computing fabric embeddings...")
    fab_keys, fab_embs = process_group(FABRIC_PROMPTS)

    print(f"Saving precomputed embeddings to {OUTPUT_NPZ_PATH}...")
    np.savez_compressed(
        OUTPUT_NPZ_PATH,
        category_keys=np.array(cat_keys),
        category_embeddings=cat_embs,
        pattern_keys=np.array(pat_keys),
        pattern_embeddings=pat_embs,
        style_keys=np.array(sty_keys),
        style_embeddings=sty_embs,
        season_keys=np.array(sea_keys),
        season_embeddings=sea_embs,
        occasion_keys=np.array(occ_keys),
        occasion_embeddings=occ_embs,
        fabric_keys=np.array(fab_keys),
        fabric_embeddings=fab_embs,
    )

    print(f"Done! Successfully saved {os.path.getsize(OUTPUT_NPZ_PATH)} bytes.")
    print(f"Categories ({len(cat_keys)}): {cat_keys}")


if __name__ == "__main__":
    precompute()
