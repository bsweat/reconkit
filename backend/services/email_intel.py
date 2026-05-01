"""
Email intelligence service.

Runs concurrently:
  1. HIBP breach check       (requires hibp_key)
  2. HIBP paste check        (requires hibp_key)
  3. Gravatar profile lookup (free, no key)
  4. Hunter.io verification  (requires hunter_key)
  5. Disposable email check  (bundled list, no key)
"""
import asyncio
import hashlib
from pathlib import Path

import httpx

DATA_DIR = Path(__file__).parent.parent / "data"
DISPOSABLE_DOMAINS_PATH = DATA_DIR / "disposable_domains.txt"

# Lazy-loaded set of disposable domains
_disposable_domains: set[str] | None = None


def _load_disposable_domains() -> set[str]:
    global _disposable_domains
    if _disposable_domains is None:
        if DISPOSABLE_DOMAINS_PATH.exists():
            with open(DISPOSABLE_DOMAINS_PATH) as f:
                _disposable_domains = {
                    line.strip().lower()
                    for line in f
                    if line.strip() and not line.startswith("#")
                }
        else:
            _disposable_domains = set()
    return _disposable_domains


def _is_disposable(email: str) -> bool:
    domain = email.split("@")[-1].lower() if "@" in email else ""
    return domain in _load_disposable_domains()


def _gravatar_hash(email: str) -> str:
    return hashlib.md5(email.strip().lower().encode()).hexdigest()


HEADERS = {
    "User-Agent": "ReconKit/2.0",
    "Accept": "application/json",
}


async def _check_hibp_breaches(client: httpx.AsyncClient, email: str, api_key: str) -> dict:
    try:
        resp = await client.get(
            f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}",
            params={"truncateResponse": "false"},
            headers={**HEADERS, "hibp-api-key": api_key},
        )
        if resp.status_code == 404:
            return {"ok": True, "breaches": [], "breach_count": 0}
        if resp.status_code == 401:
            return {"ok": False, "error": "Invalid HIBP API key"}
        if resp.status_code == 429:
            return {"ok": False, "error": "HIBP rate limit — try again shortly"}
        if resp.status_code != 200:
            return {"ok": False, "error": f"HIBP returned {resp.status_code}"}

        breaches = resp.json()
        return {
            "ok": True,
            "breach_count": len(breaches),
            "breaches": [
                {
                    "name":         b.get("Name"),
                    "title":        b.get("Title"),
                    "domain":       b.get("Domain"),
                    "breach_date":  b.get("BreachDate"),
                    "pwn_count":    b.get("PwnCount"),
                    "data_classes": b.get("DataClasses", []),
                    "description":  (b.get("Description") or "")[:200],
                    "is_verified":  b.get("IsVerified", False),
                    "is_sensitive": b.get("IsSensitive", False),
                }
                for b in breaches
            ],
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def _check_hibp_pastes(client: httpx.AsyncClient, email: str, api_key: str) -> dict:
    try:
        resp = await client.get(
            f"https://haveibeenpwned.com/api/v3/pasteaccount/{email}",
            headers={**HEADERS, "hibp-api-key": api_key},
        )
        if resp.status_code == 404:
            return {"ok": True, "pastes": [], "paste_count": 0}
        if resp.status_code in (401, 403):
            return {"ok": False, "error": "Invalid or unauthorized HIBP API key"}
        if resp.status_code != 200:
            return {"ok": False, "error": f"HIBP pastes returned {resp.status_code}"}

        pastes = resp.json()
        return {
            "ok": True,
            "paste_count": len(pastes),
            "pastes": [
                {
                    "source":    p.get("Source"),
                    "id":        p.get("Id"),
                    "title":     p.get("Title"),
                    "date":      p.get("Date"),
                    "email_count": p.get("EmailCount"),
                }
                for p in (pastes or [])[:20]  # cap at 20
            ],
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def _check_gravatar(client: httpx.AsyncClient, email: str) -> dict:
    md5_hash = _gravatar_hash(email)
    try:
        resp = await client.get(
            f"https://www.gravatar.com/{md5_hash}.json",
            headers=HEADERS,
        )
        if resp.status_code == 404:
            return {"ok": True, "found": False, "avatar_url": f"https://www.gravatar.com/avatar/{md5_hash}?d=404"}
        if resp.status_code != 200:
            return {"ok": True, "found": False}

        data = resp.json()
        entry = (data.get("entry") or [{}])[0]
        accounts = [
            {"shortname": a.get("shortname"), "url": a.get("url")}
            for a in (entry.get("accounts") or [])
        ]
        return {
            "ok": True,
            "found": True,
            "hash": md5_hash,
            "avatar_url":      f"https://www.gravatar.com/avatar/{md5_hash}",
            "display_name":    entry.get("displayName"),
            "username":        entry.get("preferredUsername"),
            "about":           entry.get("aboutMe"),
            "location":        entry.get("currentLocation"),
            "profile_url":     entry.get("profileUrl"),
            "linked_accounts": accounts,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def _check_hunter(client: httpx.AsyncClient, email: str, api_key: str) -> dict:
    try:
        resp = await client.get(
            "https://api.hunter.io/v2/email-verifier",
            params={"email": email, "api_key": api_key},
            headers=HEADERS,
        )
        if resp.status_code == 401:
            return {"ok": False, "error": "Invalid Hunter.io API key"}
        if resp.status_code == 429:
            return {"ok": False, "error": "Hunter.io rate limit exceeded"}
        if resp.status_code != 200:
            return {"ok": False, "error": f"Hunter.io returned {resp.status_code}"}

        d = resp.json().get("data", {})
        return {
            "ok": True,
            "status":     d.get("status"),       # "valid", "invalid", "risky", "unknown"
            "score":      d.get("score"),
            "disposable": d.get("disposable"),
            "webmail":    d.get("webmail"),
            "mx_records": d.get("mx_records"),
            "smtp_check": d.get("smtp_server"),
            "sources":    [
                {"domain": s.get("domain"), "uri": s.get("uri")}
                for s in (d.get("sources") or [])[:5]
            ],
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def check_email_intel(
    email: str,
    hibp_key: str | None = None,
    hunter_key: str | None = None,
) -> dict:
    """Run all email checks concurrently and return unified result."""
    async with httpx.AsyncClient(timeout=12.0) as client:
        coros = {
            "gravatar": _check_gravatar(client, email),
        }

        async def _no_hibp():
            return {"ok": False, "error": "No HIBP API key — add one in API Keys to enable breach checking"}

        async def _no_hibp_paste():
            return {"ok": False, "error": "No HIBP API key"}

        async def _no_hunter():
            return {"ok": False, "error": "No Hunter.io API key"}

        if hibp_key:
            coros["breaches"] = _check_hibp_breaches(client, email, hibp_key)
            coros["pastes"]   = _check_hibp_pastes(client, email, hibp_key)
        else:
            coros["breaches"] = _no_hibp()
            coros["pastes"]   = _no_hibp_paste()

        if hunter_key:
            coros["hunter"] = _check_hunter(client, email, hunter_key)
        else:
            coros["hunter"] = _no_hunter()

        results = await asyncio.gather(*coros.values(), return_exceptions=True)

    output = {}
    for key, result in zip(coros.keys(), results):
        if isinstance(result, Exception):
            output[key] = {"ok": False, "error": str(result)}
        else:
            output[key] = result

    output["disposable"] = _is_disposable(email)
    output["email"] = email

    return output
