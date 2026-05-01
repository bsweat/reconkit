"""
Username checker — probes sites concurrently and streams results back.

Detection strategies (set per-site):

  status_404    Site returns HTTP 404 for missing profiles, 200 for existing.
                found = (status == 200)

  content       Site always returns 200 but embeds a specific error phrase
                in the HTML when the profile is missing.
                found = (status == 200) AND (error_text NOT in response body)

  response_url  Site redirects to a specific URL when profile doesn't exist.
                error_text is a URL fragment that appears in the final URL
                when the account does NOT exist.
                found = (status == 200) AND (error_text NOT in final URL)

  redirect      Account exists if final URL stays on the same domain.
                found = (status == 200) AND (final_host == original_host)

Sites loaded from sherlock_sites.json (400+) which is cached on startup.
Falls back to sites.json (57 hand-curated sites) if cache unavailable.
"""
import asyncio
from typing import AsyncGenerator

import httpx

from services.sherlock_sites_loader import load_cached_sites

# Load sites at module import time (sync — cache should already exist from startup)
SITES = load_cached_sites()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def reload_sites() -> None:
    """Re-read sites from disk after startup fetch completes."""
    global SITES
    SITES = load_cached_sites()


async def _check_site(client: httpx.AsyncClient, site: dict, username: str) -> dict:
    url        = site["url"].replace("{}", username)
    error_type = site.get("error_type", "status_404")

    try:
        resp = await client.get(url, timeout=10.0, follow_redirects=True)

        if error_type == "content":
            error_text = site.get("error_text", "").lower()
            found = (
                resp.status_code == 200
                and bool(error_text)
                and error_text not in resp.text.lower()
            )

        elif error_type == "response_url":
            # error_text is a URL fragment that appears when account does NOT exist
            error_text = site.get("error_text", "").lower()
            final_url  = str(resp.url).lower()
            if error_text:
                found = resp.status_code == 200 and error_text not in final_url
            else:
                found = resp.status_code == 200

        elif error_type == "redirect":
            # Account exists if final URL stays on same domain
            try:
                original_host = httpx.URL(url).host
                final_host    = resp.url.host
                found = resp.status_code == 200 and final_host == original_host
            except Exception:
                found = resp.status_code == 200

        else:
            # status_404 (default): 200 = profile exists
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
    limits = httpx.Limits(max_connections=30, max_keepalive_connections=15)
    async with httpx.AsyncClient(headers=HEADERS, limits=limits) as client:
        tasks = [_check_site(client, site, username) for site in SITES]
        for coro in asyncio.as_completed(tasks):
            result = await coro
            yield result
