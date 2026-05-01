"""
Networks OSINT router.

POST /api/networks/scan        — full scan (all sources concurrently)
POST /api/networks/whois
POST /api/networks/dns
POST /api/networks/geoip
POST /api/networks/subdomains
POST /api/networks/shodan
POST /api/networks/virustotal
POST /api/networks/hosting     — ASN + hosting provider
POST /api/networks/techstack   — HTTP header + HTML tech fingerprinting
POST /api/networks/wayback     — Wayback Machine availability
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.network_intel import (
    full_network_scan,
    get_dns_records,
    get_geoip,
    get_hosting_provider,
    get_shodan,
    get_subdomains,
    get_tech_stack,
    get_virustotal,
    get_wayback,
    get_whois,
    is_ip,
)

router = APIRouter(prefix="/api/networks", tags=["networks"])


class TargetRequest(BaseModel):
    target: str


class ScanRequest(BaseModel):
    target: str
    # Per-request API keys (from frontend localStorage — never stored server-side)
    shodan_key:      Optional[str] = None
    virustotal_key:  Optional[str] = None
    ipinfo_token:    Optional[str] = None


def _clean_target(target: str) -> str:
    return target.strip().lower().removeprefix("http://").removeprefix("https://").rstrip("/")


# ---------------------------------------------------------------------------
# Full scan
# ---------------------------------------------------------------------------

@router.post("/scan")
async def scan(req: ScanRequest):
    target = _clean_target(req.target)
    result = await full_network_scan(target)
    result["target"]      = target
    result["target_type"] = "ip" if is_ip(target) else "domain"
    return result


# ---------------------------------------------------------------------------
# Individual endpoints
# ---------------------------------------------------------------------------

@router.post("/whois")
async def whois_lookup(req: TargetRequest):
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_whois, req.target)


@router.post("/dns")
async def dns_lookup(req: TargetRequest):
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_dns_records, req.target)


@router.post("/geoip")
async def geoip_lookup(req: TargetRequest):
    return await get_geoip(req.target)


@router.post("/subdomains")
async def subdomain_enum(req: TargetRequest):
    return await get_subdomains(req.target)


@router.post("/shodan")
async def shodan_lookup(req: TargetRequest):
    return await get_shodan(req.target)


@router.post("/virustotal")
async def virustotal_lookup(req: TargetRequest):
    return await get_virustotal(req.target)


@router.post("/hosting")
async def hosting_lookup(req: TargetRequest):
    return await get_hosting_provider(_clean_target(req.target))


@router.post("/techstack")
async def techstack_lookup(req: TargetRequest):
    return await get_tech_stack(_clean_target(req.target))


@router.post("/wayback")
async def wayback_lookup(req: TargetRequest):
    return await get_wayback(_clean_target(req.target))
