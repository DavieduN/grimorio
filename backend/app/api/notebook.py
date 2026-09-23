from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
from app.models.schemas import BuildRequest
from app.services.builder import NotebookBuilder
from app.core.logger import logger

router = APIRouter(prefix="/notebook", tags=["Notebook"])

@router.post("/build")
def build_notebook(request: BuildRequest):
    logger.info("Starting notebook build request.")
    
    builder = NotebookBuilder(request)
    
    if not builder.modules:
        logger.warning("Build aborted: No valid modules provided in the request.")
        raise HTTPException(status_code=400, detail="No valid modules provided to build the notebook.")
        
    pdf_path = builder.generate()
    
    if not os.path.exists(pdf_path):
        logger.error(f"PDF not found at expected path: {pdf_path}")
        raise HTTPException(status_code=500, detail="PDF generation failed. File not found.")
        
    logger.info(f"Build successful. Returning {pdf_path}")
    return FileResponse(
        path=pdf_path, 
        media_type="application/pdf", 
        filename="grimoire.pdf"
    )