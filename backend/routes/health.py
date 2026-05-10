import time
from fastapi import APIRouter
from services.face_service import face_service_status
from services.anti_spoofing import anti_spoofing_status

router = APIRouter()

@router.get("/healthz")
def healthz():
    return {
        "ok": True,
        "ts": int(time.time()),
        "face_service": face_service_status(),
        "anti_spoofing": anti_spoofing_status(),
    }
