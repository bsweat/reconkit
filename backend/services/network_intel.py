"""
Network intelligence — WHOIS, DNS, GeoIP, Shodan, VirusTotal, subdomains,
hosting provider, tech stack fingerprinting, Wayback Machine.
"""
import asyncio
import os
import re
import socket

import dns.resolver
import httpx
from bs4 import BeautifulSoup
import whois

SHODAN_KEY = os.getenv("SHODAN_API_KEY", "")
VT_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
IPINFO_TOKEN = os.getenv("IPINFO_TOKEN", "")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def is_ip(target: str) -> bool:
    return bool(_IP_RE.match(target))


# ---------------------------------------------------------------------------
# WHOIS
# ---------------------------------------------------------------------------

def get_whois(target: str) -> dict:
    try:
        w = whois.whois(target)
        raw = w.text if hasattr(w, "text") else ""

        def clean(val):
            if isinstance(val, list):
                return [str(v) for v in val]
            return str(val) if val else None

        return {
            "ok": True,
            "registrar": clean(w.registrar),
            "creation_date": clean(w.creation_date),
            "expiration_date": clean(w.expiration_date),
            "updated_date": clean(w.updated_date),
            "name_servers": clean(w.name_servers),
            "status": clean(w.status),
            "emails": clean(w.emails),
            "org": clean(w.org),
            "country": clean(w.country),
            "dnssec": clean(w.dnssec),
            "raw_snippet": raw[:600] if raw else None,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# DNS
# ---------------------------------------------------------------------------

RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]


def get_dns_records(domain: str) -> dict:
    records: dict = {}
    for rtype in RECORD_TYPES:
        try:
            answers = dns.resolver.resolve(domain, rtype, lifetime=5)
            records[rtype] = [r.to_text() for r in answers]
        except Exception:
            records[rtype] = []

    # Reverse DNS on each A record
    ptr_map: dict = {}
    for ip in records.get("A", []):
        try:
            ptr_map[ip] = socket.gethostbyaddr(ip)[0]
        except Exception:
            ptr_map[ip] = None
    records["PTR"] = ptr_map
    return {"ok": True, "records": records}


# ---------------------------------------------------------------------------
# GeoIP  (ip-api.com — no key needed, 45 req/min free)
# ---------------------------------------------------------------------------

async def get_geoip(target: str) -> dict:
    # Resolve domain to IP first if needed
    ip = target
    if not is_ip(target):
        try:
            ip = socket.gethostbyname(target)
        except Exception:
            ip = target

    url = f"http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,reverse,query"
    async with httpx.AsyncClient(headers=HEADERS) as client:
        try:
            resp = await client.get(url, timeout=6.0)
            data = resp.json()
            data["ok"] = data.get("status") == "success"
            data["resolved_ip"] = ip
            return data
        except Exception as exc:
            return {"ok": False, "error": str(exc), "resolved_ip": ip}


# ---------------------------------------------------------------------------
# Subdomain enumeration via crt.sh (no key needed)
# ---------------------------------------------------------------------------

async def get_subdomains(domain: str) -> dict:
    url = f"https://crt.sh/?q=%.{domain}&output=json"
    async with httpx.AsyncClient(headers=HEADERS) as client:
        try:
            resp = await client.get(url, timeout=15.0)
            data = resp.json()
            subs = sorted({
                entry["name_value"].lower()
                for entry in data
                if "*" not in entry["name_value"]
            })
            return {"ok": True, "subdomains": subs[:150], "total": len(subs)}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "subdomains": []}


# ---------------------------------------------------------------------------
# Shodan
# ---------------------------------------------------------------------------

async def get_shodan(target: str) -> dict:
    if not SHODAN_KEY:
        return {"ok": False, "error": "No SHODAN_API_KEY set in .env"}

    ip = target
    if not is_ip(target):
        try:
            ip = socket.gethostbyname(target)
        except Exception:
            return {"ok": False, "error": f"Could not resolve {target}"}

    url = f"https://api.shodan.io/shodan/host/{ip}?key={SHODAN_KEY}"
    async with httpx.AsyncClient(headers=HEADERS) as client:
        try:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 404:
                return {"ok": True, "ip": ip, "found": False, "message": "No Shodan data for this IP"}
            data = resp.json()
            ports = data.get("ports", [])
            vulns = list(data.get("vulns", {}).keys())
            services = []
            for item in data.get("data", [])[:20]:
                services.append({
                    "port": item.get("port"),
                    "transport": item.get("transport"),
                    "product": item.get("product"),
                    "version": item.get("version"),
                    "banner": (item.get("data") or "")[:120],
                })
            return {
                "ok": True,
                "found": True,
                "ip": ip,
                "org": data.get("org"),
                "isp": data.get("isp"),
                "country": data.get("country_name"),
                "city": data.get("city"),
                "os": data.get("os"),
                "ports": ports,
                "hostnames": data.get("hostnames", []),
                "domains": data.get("domains", []),
                "vulns": vulns,
                "services": services,
                "last_update": data.get("last_update"),
                "tags": data.get("tags", []),
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# VirusTotal
# ---------------------------------------------------------------------------

async def get_virustotal(target: str) -> dict:
    if not VT_KEY:
        return {"ok": False, "error": "No VIRUSTOTAL_API_KEY set in .env"}

    if is_ip(target):
        url = f"https://www.virustotal.com/api/v3/ip_addresses/{target}"
    else:
        import base64
        domain_id = base64.urlsafe_b64encode(target.encode()).decode().strip("=")
        url = f"https://www.virustotal.com/api/v3/domains/{domain_id}"

    async with httpx.AsyncClient(headers={**HEADERS, "x-apikey": VT_KEY}) as client:
        try:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 404:
                return {"ok": True, "found": False}
            data = resp.json().get("data", {}).get("attributes", {})
            stats = data.get("last_analysis_stats", {})
            return {
                "ok": True,
                "found": True,
                "reputation": data.get("reputation"),
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "undetected": stats.get("undetected", 0),
                "harmless": stats.get("harmless", 0),
                "categories": data.get("categories", {}),
                "tags": data.get("tags", []),
                "creation_date": data.get("creation_date"),
                "registrar": data.get("registrar"),
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Hosting provider
# ---------------------------------------------------------------------------

async def get_hosting_provider(target: str) -> dict:
    """ASN + hosting provider via ipinfo.io."""
    ip = target
    if not is_ip(target):
        try:
            ip = socket.gethostbyname(target)
        except Exception as exc:
            return {"ok": False, "error": f"Could not resolve {target}: {exc}"}

    token = IPINFO_TOKEN
    url   = f"https://ipinfo.io/{ip}/json" + (f"?token={token}" if token else "")

    async with httpx.AsyncClient(headers=HEADERS) as client:
        try:
            resp = await client.get(url, timeout=8.0)
            data = resp.json()
            return {
                "ok":       True,
                "ip":       ip,
                "org":      data.get("org"),       # e.g. "AS15169 Google LLC"
                "hostname": data.get("hostname"),
                "city":     data.get("city"),
                "region":   data.get("region"),
                "country":  data.get("country"),
                "hosting":  data.get("hosting", False),
                "anycast":  data.get("anycast", False),
                "asn":      data.get("org", "").split(" ")[0] if data.get("org") else None,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Tech stack fingerprinting
# ---------------------------------------------------------------------------

# Header → (technology, category)
HEADER_FINGERPRINTS: list[tuple[str, str, str]] = [
    ("server",              r"nginx",          "Nginx"),
    ("server",              r"apache",         "Apache"),
    ("server",              r"iis",            "IIS"),
    ("server",              r"cloudflare",     "Cloudflare"),
    ("server",              r"openresty",      "OpenResty"),
    ("server",              r"lighttpd",       "Lighttpd"),
    ("x-powered-by",        r"php",            "PHP"),
    ("x-powered-by",        r"asp\.net",       "ASP.NET"),
    ("x-powered-by",        r"express",        "Express.js"),
    ("x-powered-by",        r"next\.js",       "Next.js"),
    ("x-generator",         r"wordpress",      "WordPress"),
    ("x-generator",         r"drupal",         "Drupal"),
    ("x-generator",         r"joomla",         "Joomla"),
    ("x-drupal-cache",      r"",               "Drupal"),
    ("x-shopify-stage",     r"",               "Shopify"),
    ("x-wix-request-id",    r"",               "Wix"),
    ("x-squarespace-.*",    r"",               "Squarespace"),
]

# Script src / HTML patterns
HTML_FINGERPRINTS: list[tuple[str, str]] = [
    (r"wp-content|wp-includes", "WordPress"),
    (r"/_next/static",          "Next.js"),
    (r"/__nuxt",                "Nuxt.js"),
    (r"/ember\b",               "Ember.js"),
    (r"angular\.min\.js|ng-version", "Angular"),
    (r"react\.development|react\.production", "React"),
    (r"vue\.js|vue\.min\.js",   "Vue.js"),
    (r"jquery\.min\.js|jquery-", "jQuery"),
    (r"gtag\(|google-analytics", "Google Analytics"),
    (r"gtm\.js",                "Google Tag Manager"),
    (r"cdn\.shopify\.com",      "Shopify"),
    (r"static\.squarespace\.com", "Squarespace"),
    (r"assets\.wix\.com",       "Wix"),
    (r"ghost\.",                "Ghost CMS"),
    (r"hexo",                   "Hexo"),
    (r"gatsby",                 "Gatsby"),
    (r"__NEXT_DATA__",          "Next.js"),
    (r"__NUXT_DATA__",          "Nuxt.js"),
    (r"django",                 "Django"),
    (r"laravel",                "Laravel"),
    (r"rails",                  "Ruby on Rails"),
]


async def get_tech_stack(target: str) -> dict:
    """Single HTTP GET to fingerprint the tech stack from headers + HTML."""
    url = target if target.startswith("http") else f"https://{target}"
    # Also try http if https fails
    technologies: list[str] = []

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        try:
            resp = await client.get(url, timeout=10.0)
        except httpx.ConnectError:
            try:
                resp = await client.get(url.replace("https://", "http://"), timeout=10.0)
            except Exception as exc:
                return {"ok": False, "error": str(exc)}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    found: set[str] = set()

    # --- Header fingerprinting ---
    for header_name, pattern, tech_name in HEADER_FINGERPRINTS:
        for h_key, h_val in resp.headers.items():
            if re.match(header_name, h_key.lower()):
                if not pattern or re.search(pattern, h_val.lower()):
                    found.add(tech_name)

    # --- HTML fingerprinting ---
    try:
        html = resp.text[:40_000]  # cap at 40KB
        for pattern, tech_name in HTML_FINGERPRINTS:
            if re.search(pattern, html, re.IGNORECASE):
                found.add(tech_name)

        # meta generator tag
        soup = BeautifulSoup(html, "html.parser")
        meta_gen = soup.find("meta", attrs={"name": re.compile("generator", re.I)})
        if meta_gen and meta_gen.get("content"):
            gen_val = str(meta_gen["content"]).strip()
            found.add(gen_val.split(" ")[0])  # e.g. "WordPress 6.4.2" → "WordPress"
    except Exception:
        pass

    # Detect CDN from response headers
    via = resp.headers.get("via", "")
    cf  = resp.headers.get("cf-ray", "")
    if cf or "cloudflare" in via.lower():
        found.add("Cloudflare")
    if "fastly" in via.lower() or resp.headers.get("x-served-by", "").startswith("cache-"):
        found.add("Fastly CDN")
    if resp.headers.get("x-cache", "").startswith("Hit from cloudfront"):
        found.add("AWS CloudFront")

    return {
        "ok":           True,
        "url":          str(resp.url),
        "status_code":  resp.status_code,
        "technologies": sorted(found),
        "server":       resp.headers.get("server", ""),
        "powered_by":   resp.headers.get("x-powered-by", ""),
    }


# ---------------------------------------------------------------------------
# Wayback Machine
# ---------------------------------------------------------------------------

async def get_wayback(target: str) -> dict:
    """Check Wayback Machine for availability and snapshot info."""
    clean = target.removeprefix("http://").removeprefix("https://").rstrip("/")

    async with httpx.AsyncClient(headers=HEADERS) as client:
        try:
            avail_resp = await client.get(
                "https://archive.org/wayback/available",
                params={"url": clean},
                timeout=10.0,
            )
            avail_data = avail_resp.json()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    snapshot = avail_data.get("archived_snapshots", {}).get("closest", {})
    available = snapshot.get("available", False)

    return {
        "ok":              True,
        "available":       available,
        "snapshot_url":    snapshot.get("url"),
        "snapshot_ts":     snapshot.get("timestamp"),
        "snapshot_status": snapshot.get("status"),
        "wayback_url":     f"https://web.archive.org/web/*/{clean}",
        "target":          clean,
    }


# ---------------------------------------------------------------------------
# Full scan — run everything concurrently
# ---------------------------------------------------------------------------

async def full_network_scan(target: str, api_keys: dict | None = None) -> dict:
    """
    api_keys: optional dict with shodan_key, virustotal_key, ipinfo_token
    passed in per-request (from frontend localStorage) rather than env vars.
    """
    domain = target if not is_ip(target) else None
    url_target = f"https://{target}" if not target.startswith("http") else target

    tasks = {
        "geoip":    get_geoip(target),
        "shodan":   get_shodan(target),
        "virustotal": get_virustotal(target),
        "hosting":  get_hosting_provider(target),
        "wayback":  get_wayback(target),
    }

    if domain:
        tasks["subdomains"] = get_subdomains(domain)
        tasks["tech_stack"] = get_tech_stack(url_target)

    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    output = {}
    for key, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            output[key] = {"ok": False, "error": str(result)}
        else:
            output[key] = result

    # Sync calls (whois + dns are blocking, run in thread pool)
    loop = asyncio.get_event_loop()
    output["whois"] = await loop.run_in_executor(None, get_whois, target)
    if domain:
        output["dns"] = await loop.run_in_executor(None, get_dns_records, domain)

    return output
