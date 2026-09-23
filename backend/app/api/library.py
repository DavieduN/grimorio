from fastapi import APIRouter
from typing import Dict
from app.models.schemas import Module
from app.services.scanner import scan_library

router = APIRouter(prefix="/library", tags=["Library"])

@router.get("/", response_model=Dict[str, Module])
def get_library():
    """
    Scans the DATA_PATH and returns a dictionary of all valid Modules.
    The key is the module ID.
    """
    return scan_library()