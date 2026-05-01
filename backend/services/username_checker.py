"""
Username checker — probes sites concurrently and streams results back.

Two detection strategies (set per-site in data/sites.json):

  status_404  The site returns HTTP 404 for missing profiles and 200 for existing
              ones.  This covers ~95% of reliably-checkable sites.
              found = (status == 200)

  content     The site always returns HTTP 200 but embeds a specific error phrase
              in the HTML when the profile is missing (e.g. Steam, Telegram).
              Matching is case-insensitive.
              found = (status == 200) AND (error_text NOT in response body)

Sites intentionally excluded (no reliable HTTP-level detection):
  Twitter/X, Instagram, TikTok, Threads, Snapchat, Pinterest, Kaggle, Patreon
  — JS-rendered SPAs or login-walled sites that return HTTP 200 for every URL
  regardless of profile existence.  Accurate checking requires a headless browser.
"""
import asyncio
import json
from pathlib import Path
from typing import AsyncGenerator

import httpx

SITES_PATH = Path(__file__).parent.parent / "data" / "sites.json"
with open(SITES_PATH) as f:
    SITES = json.load(f)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


async def _check_site(client: httpx.AsyncClient, site: dict, username: str) -> dict:
    url        = site["url"].replace("{}", username)
    error_type = site.get("error_type", "status_404")

    try:
        resp = await client.get(url, timeout=10.0, follow_redirects=True)

        if error_type == "content":
            # Case-insensitive: profile exists when the error phrase is absent
            error_text = site.get("error_text", "").lower()
            found = (
                resp.status_code == 200
                and bool(error_text)
                and error_text not in resp.text.lower()
            )
        else:
            # status_404 (default): 200 = profile exists, anything else = missing
            found = resp.status_code == 200

        return {
            "site":     site["name"],
            "url":      url,
            "found":    found,
            "status":   resp.status_code,
            "category": site.get("category", "misc"),
        }

    except httpx.TimeoutException:
        return {
            "site":     site["name"],
            "url":      url,
            "found":    False,
            "status":   "timeout",
            "category": site.get("category", "misc"),
        }
    except Exception as exc:
        return {
            "site":     site["name"],
            "url":      url,
            "found":    False,
            "status":   "error",
            "error":    str(exc)[:80],
            "category": site.get("category", "misc"),
        }


async def stream_username_check(username: str) -> AsyncGenerator[dict, None]:
    """Yield one result dict per site as checks complete."""
    limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
    async with httpx.AsyncClient(headers=HEADERS, limits=limits) as client:
        tasks = [_check_site(client, site, username) for site in SITES]
        for coro in asyncio.as_completed(tasks):
            result = await coro
            yield result
