from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
from app.api import library, notebook
from app.core.logger import logger

app = FastAPI(title="Grimoire ICPC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception during {request.method} {request.url}:\n{str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check backend logs for details."},
    )

app.include_router(library.router)
app.include_router(notebook.router)

@app.get("/")
def health_check():
    logger.info("Health check endpoint accessed.")
    return {"status": "ok", "message": "Grimoire Backend is running!"}