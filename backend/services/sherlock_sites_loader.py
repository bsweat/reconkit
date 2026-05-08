"""
Sherlock sites loader — fetches Sherlock's 400+ site list on startup
and merges it with our existing sites.json, converting schema as needed.

Sherlock data.json schema (current):
  URL placeholder: {} (already matches our format)
  errorType values:
    status_code  → our error_type: "status_404"
    message      → our error_type: "content",  error_text: errorMsg[0]
    response_url → our error_type: "response_url", error_text: errorMsg
"""
import json
import logging
from pathlib import Path

import httpx

logger = logging.getLogger("reconkit.sherlock_loader")

SHERLOCK_URL = (
    "https://raw.githubusercontent.com/sherlock-project/sherlock/"
    "master/sherlock_project/resources/data.json"
)

DATA_DIR = Path(__file__).parent.parent / "data"
SHERLOCK_CACHE = DATA_DIR / "sherlock_sites.json"
FALLBACK_PATH  = DATA_DIR / "sites.json"

# Intentionally skipped: JS-rendered SPAs / auth-walled / unreliable sites
SKIP_SITES = {
    # Always 200 regardless of user — can't detect server-side
    "twitter", "x", "instagram", "tiktok", "threads", "snapchat",
    "pinterest", "kaggle", "patreon", "facebook", "$schema",
    "twitch",

    # Removed by request — irrelevant / unreliable
    "mercadolivre", "mercadolibre",
    "cracked",
    "cryptohack",
    "ninjakiwi",
}

CATEGORY_KEYWORDS = {
    "dev":    ["github", "gitlab", "replit", "codepen", "stackoverflow", "hackerrank",
               "leetcode", "bitbucket", "npm", "pypi", "docker", "heroku", "netlify",
               "vercel", "hackthebox", "tryhackme", "ctftime", "1337x"],
    "social": ["reddit", "twitter", "mastodon", "bluesky", "tumblr", "medium",
               "devto", "hashnode", "substack"],
    "gaming": ["steam", "twitch", "xbox", "playstation", "itch", "roblox",
               "minecraft", "chess", "lichess"],
    "media":  ["youtube", "vimeo", "soundcloud", "spotify", "lastfm", "bandcamp",
               "flickr", "500px", "behance", "dribbble", "deviantart", "artstation"],
    "work":   ["linkedin", "angel", "wellfound", "fiverr", "upwork"],
}


def _guess_category(name: str) -> str:
    lower = name.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return cat
    return "misc"


def _normalize_error_msg(val) -> str:
    """Sherlock errorMsg can be a string or a list — return first usable string."""
    if isinstance(val, list):
        return val[0] if val else ""
    return str(val) if val else ""


def _convert_sherlock_site(name: str, data: dict) -> dict | None:
    """Convert one Sherlock site entry to our schema. Returns None to skip."""
    if name.lower() in SKIP_SITES:
        return None
    if not isinstance(data, dict):
        return None

    url_template = data.get("url", "")
    if not url_template or "{}" not in url_template:
        return None

    error_type_raw = data.get("errorType", "status_code")

    if error_type_raw == "status_code":
        return {
            "name":       name,
            "url":        url_template,
            "error_type": "status_404",
            "category":   _guess_category(name),
        }

    elif error_type_raw == "message":
        error_msg = _normalize_error_msg(data.get("errorMsg", ""))
        if not error_msg:
            # No message to match — fall back to 404 detection
            return {
                "name":       name,
                "url":        url_template,
                "error_type": "status_404",
                "category":   _guess_category(name),
            }
        return {
            "name":       name,
            "url":        url_template,
            "error_type": "content",
            "error_text": error_msg,
            "category":   _guess_category(name),
        }

    elif error_type_raw == "response_url":
        error_msg = _normalize_error_msg(data.get("errorMsg", ""))
        return {
            "name":       name,
            "url":        url_template,
            "error_type": "response_url",
            "error_text": error_msg,
            "category":   _guess_category(name),
        }

    # Unknown type — skip
    return None


async def fetch_and_cache_sherlock_sites() -> list[dict]:
    """
    Fetch Sherlock's site list, convert schema, merge with existing sites.json,
    cache result to sherlock_sites.json, and return the merged list.
    Falls back to existing sites.json if fetch fails.
    """
    with open(FALLBACK_PATH) as f:
        existing_sites: list[dict] = json.load(f)

    existing_names = {s["name"].lower() for s in existing_sites}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(SHERLOCK_URL)
            resp.raise_for_status()
            sherlock_data: dict = resp.json()

        merged = list(existing_sites)
        added  = 0

        for site_name, site_data in sherlock_data.items():
            if site_name.lower() in existing_names:
                continue
            converted = _convert_sherlock_site(site_name, site_data)
            if converted is not None:
                merged.append(converted)
                existing_names.add(site_name.lower())
                added += 1

        DATA_DIR.mkdir(exist_ok=True)
        with open(SHERLOCK_CACHE, "w") as f:
            json.dump(merged, f, indent=2)

        logger.info(
            "Sherlock sites loaded: %d total (%d from Sherlock, %d existing)",
            len(merged), added, len(existing_sites),
        )
        return merged

    except Exception as exc:
        logger.warning(
            "Failed to fetch Sherlock sites (%s) — falling back to sites.json", exc
        )
        if SHERLOCK_CACHE.exists():
            with open(SHERLOCK_CACHE) as f:
                cached = json.load(f)
            logger.info("Using cached sherlock_sites.json (%d sites)", len(cached))
            return cached

        logger.info("Using fallback sites.json (%d sites)", len(existing_sites))
        return existing_sites


def load_cached_sites() -> list[dict]:
    """Synchronous load from disk — used at module import time."""
    if SHERLOCK_CACHE.exists():
        try:
            with open(SHERLOCK_CACHE) as f:
                return json.load(f)
        except Exception:
            pass
    with open(FALLBACK_PATH) as f:
        return json.load(f)
