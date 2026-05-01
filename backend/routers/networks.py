"""
Networks OSINT router.

POST /api/networks/scan     — full scan (all sources concurrently)
POST /api/networks/whois
POST /api/networks/dns
POST /api/networks/geoip
POST /api/networks/subdomains
POST /api/networks/shodan
POST /api/networks/virustotal
"""
from fastapi import APIRouter
from pydantic import BaseModel

from services.network_intel import (
    full_network_scan,
    get_dns_records,
    get_geoip,
    get_shodan,
    get_subdomains,
    get_virustotal,
    get_whois,
    is_ip,
)

router = APIRouter(prefix="/api/networks", tags=["networks"])


class TargetRequest(BaseModel):
    target: str  # IP or domain


# ---------------------------------------------------------------------------
# Full scan
# ---------------------------------------------------------------------------

@router.post("/scan")
async def scan(req: TargetRequest):
    target = req.target.strip().lower().removeprefix("http://").removeprefix("https://").rstrip("/")
    result = await full_network_scan(target)
    result["target"] = target
    result["target_type"] = "ip" if is_ip(target) else "domain"
    return result


# ---------------------------------------------------------------------------
# Individual endpoints (useful for partial / on-demand refreshes)
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
