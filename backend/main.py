"""
ReconKit — OSINT web tool backend
Run with: uvicorn main:app --reload --port 8000
"""
from dotenv import load_dotenv
load_dotenv()

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pathlib import Path

from routers.people import router as people_router
from routers.networks import router as networks_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reconkit")

app = FastAPI(title="ReconKit", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(people_router)
app.include_router(networks_router)


# ---------------------------------------------------------------------------
# Health check (registered before SPA catch-all)
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    from services.username_checker import SITES
    return {"status": "ok", "tool": "ReconKit", "sites_loaded": len(SITES)}


# ---------------------------------------------------------------------------
# Startup: fetch + cache Sherlock site list, then reload username checker
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    try:
        from services.sherlock_sites_loader import fetch_and_cache_sherlock_sites
        from services import username_checker
        from services.sherlock_sites_loader import load_cached_sites
        await fetch_and_cache_sherlock_sites()
        username_checker.SITES = load_cached_sites()
        logger.info("Username checker loaded %d sites", len(username_checker.SITES))
    except Exception as exc:
        logger.warning("Sherlock fetch failed on startup: %s", exc)


# ---------------------------------------------------------------------------
# Serve frontend (React build in production, legacy HTML in dev fallback)
# ---------------------------------------------------------------------------

_dist   = Path(__file__).parent.parent / "frontend" / "dist"
_legacy = Path(__file__).parent.parent / "frontend"

if _dist.exists():
    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="assets")

    @app.get("/", response_class=HTMLResponse)
    async def root():
        return FileResponse(str(_dist / "index.html"))

    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def spa_fallback(full_path: str):
        index = _dist / "index.html"
        return FileResponse(str(index))

elif _legacy.exists():
    app.mount("/static", StaticFiles(directory=str(_legacy)), name="static")

    @app.get("/")
    async def root_legacy():
        return FileResponse(str(_legacy / "index.html"))
