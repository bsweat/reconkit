"""
ReconKit — OSINT web tool backend
Run with: uvicorn main:app --reload --port 8000
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from routers.people import router as people_router
from routers.networks import router as networks_router

app = FastAPI(title="ReconKit", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(people_router)
app.include_router(networks_router)

# Serve frontend
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")

    @app.get("/")
    async def root():
        return FileResponse(str(frontend_path / "index.html"))

@app.get("/health")
async def health():
    return {"status": "ok", "tool": "ReconKit"}
