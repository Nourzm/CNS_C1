"""Pre-download InsightFace's buffalo_l model so the first /embed call
isn't 30+ seconds. Run once after pip install.

  cd backend
  python scripts/warmup.py

Downloads ~280 MB to ~/.insightface/models/buffalo_l/.
"""
import sys
import time
import traceback

print("[WARMUP] Starting InsightFace buffalo_l pre-download (~280 MB)...")
try:
    print("[WARMUP] Importing FaceAnalysis...")
    from insightface.app import FaceAnalysis
    
    print("[WARMUP] Creating FaceAnalysis instance (name=buffalo_l)...")
    t0 = time.time()
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    
    print("[WARMUP] Calling prepare(ctx_id=0, det_size=(640, 640))...")
    app.prepare(ctx_id=0, det_size=(640, 640))
    
    elapsed = time.time() - t0
    print(f"[WARMUP] SUCCESS in {elapsed:.1f}s")
    sys.exit(0)
except Exception as e:
    print(f"[WARMUP] FAILED: {type(e).__name__}: {e}")
    traceback.print_exc()
    sys.exit(1)
