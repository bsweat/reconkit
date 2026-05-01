"""
Keybase intelligence service.

Fetches linked social accounts and crypto addresses for a Keybase username.
Free API, no authentication required.
"""
import httpx

HEADERS = {
    "User-Agent": "ReconKit/2.0",
    "Accept": "application/json",
}

# Human-readable labels for proof types
PROOF_LABELS = {
    "twitter":    "Twitter/X",
    "github":     "GitHub",
    "reddit":     "Reddit",
    "hackernews": "Hacker News",
    "dns":        "Website (DNS)",
    "web":        "Website",
    "coinbase":   "Coinbase",
    "facebook":   "Facebook",
    "genericwebsite": "Website",
    "mastodon":   "Mastodon",
    "stellar":    "Stellar",
    "zcash":      "Zcash",
}


async def get_keybase_intel(username: str) -> dict:
    url = f"https://keybase.io/_/api/1.0/user/lookup.json?username={username}"

    async with httpx.AsyncClient(headers=HEADERS, timeout=12.0) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 404:
                return {"ok": False, "error": "Keybase user not found", "not_found": True}
            if resp.status_code != 200:
                return {"ok": False, "error": f"Keybase API returned {resp.status_code}"}

            data = resp.json()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    status = data.get("status", {})
    if status.get("code") != 0:
        if status.get("name") == "NOT_FOUND":
            return {"ok": False, "error": "Keybase user not found", "not_found": True}
        return {"ok": False, "error": status.get("desc", "Unknown Keybase error")}

    them = data.get("them")
    if not them:
        return {"ok": False, "error": "Keybase user not found", "not_found": True}

    user = them[0] if isinstance(them, list) else them
    if not user:
        return {"ok": False, "error": "Empty Keybase response"}

    # Profile basics
    basics  = user.get("basics", {})
    profile = user.get("profile", {}) or {}

    # Social proofs
    proofs_raw = (
        (user.get("proofs_summary") or {}).get("all") or []
    )
    linked_accounts = []
    for proof in proofs_raw:
        proof_type = proof.get("proof_type", "")
        state      = proof.get("state", 0)  # 1 = verified
        nametag    = proof.get("nametag", "")
        human_url  = proof.get("human_url", "")
        linked_accounts.append({
            "type":     proof_type,
            "label":    PROOF_LABELS.get(proof_type, proof_type.capitalize()),
            "username": nametag,
            "url":      human_url,
            "verified": state == 1,
        })

    # Crypto addresses
    crypto_raw   = user.get("cryptocurrency_addresses") or {}
    crypto_addrs = {}
    for coin, entries in crypto_raw.items():
        if entries:
            crypto_addrs[coin] = [e.get("address") for e in entries if e.get("address")]

    return {
        "ok": True,
        "username":        basics.get("username"),
        "full_name":       profile.get("full_name"),
        "bio":             profile.get("bio"),
        "location":        profile.get("location"),
        "profile_url":     f"https://keybase.io/{username}",
        "linked_accounts": linked_accounts,
        "crypto_addresses": crypto_addrs,
        "account_count":   len(linked_accounts),
    }
