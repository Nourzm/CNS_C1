import os
import time
from fastapi import APIRouter

router = APIRouter()

_REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
_DEFAULT_MODEL = os.path.join(_REPO_ROOT, "ai", "anti_spoofing", "model.onnx")
_MODEL_PATH = os.getenv("SPOOF_MODEL_PATH", _DEFAULT_MODEL)
_MOCK_AI = os.getenv("MOCK_AI", "true").lower() == "true"
_FACE_THRESHOLD = float(os.getenv("FACE_THRESHOLD", "0.5"))
_SPOOF_THRESHOLD = float(os.getenv("SPOOF_THRESHOLD", "0.70"))

@router.get("/healthz")
def healthz():
    model_exists = os.path.exists(_MODEL_PATH)
    return {
        "ok": True,
        "ts": int(time.time()),
        "face_service": {
            "mock": _MOCK_AI,
            "loaded": False,
            "error": None,
            "threshold": _FACE_THRESHOLD,
        },
        "anti_spoofing": {
            "mock": _MOCK_AI,
            "mode": "mock" if _MOCK_AI else ("onnx" if model_exists else "heuristic"),
            "loaded": False,
            "error": None if (_MOCK_AI or model_exists) else f"no model at {_MODEL_PATH}",
            "threshold": _SPOOF_THRESHOLD,
        },
    }
