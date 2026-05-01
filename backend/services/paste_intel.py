"""
Paste site intelligence service.

Always returns pre-filled manual dork links.
If a Google Custom Search Engine (CSE) key + ID are provided,
also runs live searches against paste sites.
"""
import urllib.parse

import httpx

HEADERS = {
    "User-Agent": "ReconKit/2.0",
    "Accept": "application/json",
}

PASTE_SITES = [
    "pastebin.com",
    "ghostbin.com",
    "paste.ee",
    "dpaste.com",
    "rentry.co",
    "hastebin.com",
    "controlc.com",
    "paste.centos.org",
]


def _q(s: str) -> str:
    return urllib.parse.quote_plus(f'"{s}"')


def _build_manual_links(query: str) -> list[dict]:
    """Generate manual Google dork links for paste sites."""
    links = []
    for site in PASTE_SITES:
        links.append({
            "label": f"Search {site} for: {query}",
            "url":   f"https://www.google.com/search?q=site%3A{site}+{_q(query)}",
            "site":  site,
        })
    # Also a combined dork
    sites_str = " OR ".join(f"site:{s}" for s in PASTE_SITES[:4])
    links.append({
        "label": f"Multi-site paste search: {query}",
        "url":   f"https://www.google.com/search?q=({urllib.parse.quote_plus(sites_str)})+{_q(query)}",
        "site":  "combined",
    })
    return links


async def _cse_search(
    query: str,
    api_key: str,
    cse_id: str,
) -> list[dict]:
    """Live Google Custom Search filtered to paste sites."""
    site_filter = " OR ".join(f"site:{s}" for s in PASTE_SITES)
    full_query  = f'"{query}" ({site_filter})'

    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=10.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "q":   full_query,
                    "key": api_key,
                    "cx":  cse_id,
                    "num": 10,
                },
            )
            if resp.status_code == 403:
                return []
            if resp.status_code != 200:
                return []

            items = resp.json().get("items", [])
            return [
                {
                    "title":   item.get("title", ""),
                    "url":     item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                }
                for item in items
            ]
    except Exception:
        return []


async def get_paste_intel(
    query: str,
    google_cse_key: str | None = None,
    google_cse_id:  str | None = None,
) -> dict:
    manual_links = _build_manual_links(query)

    live_results: list[dict] = []
    live_enabled = bool(google_cse_key and google_cse_id)

    if live_enabled:
        live_results = await _cse_search(query, google_cse_key, google_cse_id)  # type: ignore[arg-type]

    return {
        "ok":           True,
        "query":        query,
        "live_enabled": live_enabled,
        "live_results": live_results,
        "live_count":   len(live_results),
        "manual_links": manual_links,
    }
