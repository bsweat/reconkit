"""
People OSINT router.

POST /api/people/username  — streams SSE results for username lookup (400+ sites)
POST /api/people/github    — streams SSE results for GitHub deep dive
POST /api/people/email     — email intelligence (HIBP, Gravatar, Hunter, disposable)
POST /api/people/reddit    — Reddit profile intel
POST /api/people/keybase   — Keybase linked accounts
POST /api/people/pastes    — Paste site search (manual dorks + optional live CSE)
POST /api/people/dorks     — Dynamic Google dork generation
POST /api/people/clarify   — Clarifying questions (kept for compatibility)
"""
import json
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from services.username_checker import stream_username_check
from services.github_intel import stream_github_intel
from services.email_intel import check_email_intel
from services.reddit_intel import get_reddit_intel
from services.keybase_intel import get_keybase_intel
from services.paste_intel import get_paste_intel
from services.dork_generator import generate_dorks

router = APIRouter(prefix="/api/people", tags=["people"])


# ---------------------------------------------------------------------------
# Shared models
# ---------------------------------------------------------------------------

class UsernameRequest(BaseModel):
    username: str


class GitHubRequest(BaseModel):
    username: str
    github_token: Optional[str] = None


class EmailRequest(BaseModel):
    email: str
    hibp_key:   Optional[str] = None
    hunter_key: Optional[str] = None


class RedditRequest(BaseModel):
    username: str


class KeybaseRequest(BaseModel):
    username: str


class PasteRequest(BaseModel):
    query: str
    google_cse_key: Optional[str] = None
    google_cse_id:  Optional[str] = None


class DorksRequest(BaseModel):
    full_name:    Optional[str] = None
    usernames:    list[str] = []
    email:        Optional[str] = None
    employer:     Optional[str] = None
    location:     Optional[str] = None
    phone:        Optional[str] = None
    aliases:      list[str] = []
    age:          Optional[str] = None
    education:    Optional[str] = None
    is_ctf:       bool = False
    # Discovered data from automated scans
    discovered_emails:    list[str] = []
    discovered_usernames: list[str] = []


class PersonProfile(BaseModel):
    """Full profile — used by clarify endpoint (kept for compatibility)."""
    full_name:   Optional[str] = None
    usernames:   list[str] = []
    employer:    Optional[str] = None
    location:    Optional[str] = None
    email:       Optional[str] = None
    age:         Optional[str] = None
    phone:       Optional[str] = None
    aliases:     list[str] = []
    hobbies:     Optional[str] = None
    education:   Optional[str] = None
    is_ctf:      bool = False
    ctf_name:    Optional[str] = None
    extra_notes: Optional[str] = None
    # Legacy fields
    suspected_username: Optional[str] = None
    suspected_location: Optional[str] = None
    suspected_email:    Optional[str] = None
    suspected_employer: Optional[str] = None
    unverified_fields:  list[str] = []


# ---------------------------------------------------------------------------
# Username sweep (SSE)
# ---------------------------------------------------------------------------

@router.post("/username")
async def username_lookup(req: UsernameRequest):
    """Stream SSE events as each site check completes."""

    async def generator():
        from services.username_checker import SITES
        total = len(SITES)
        yield {"event": "start", "data": json.dumps({"total": total})}
        found_count = 0
        checked = 0
        async for result in stream_username_check(req.username):
            checked += 1
            if result["found"]:
                found_count += 1
            yield {
                "event": "result",
                "data": json.dumps({**result, "checked": checked, "total": total, "found_total": found_count}),
            }
        yield {"event": "done", "data": json.dumps({"checked": checked, "total": total, "found_total": found_count})}

    return EventSourceResponse(generator())


# ---------------------------------------------------------------------------
# GitHub deep dive (SSE)
# ---------------------------------------------------------------------------

@router.post("/github")
async def github_lookup(req: GitHubRequest):
    """Stream SSE events for GitHub profile, repos, and commit email mining."""

    async def generator():
        async for payload_str in stream_github_intel(req.username, req.github_token):
            payload = json.loads(payload_str)
            yield {
                "event": payload.get("event", "data"),
                "data":  json.dumps(payload.get("data", {})),
            }

    return EventSourceResponse(generator())


# ---------------------------------------------------------------------------
# Email intelligence
# ---------------------------------------------------------------------------

@router.post("/email")
async def email_lookup(req: EmailRequest):
    result = await check_email_intel(
        email=req.email,
        hibp_key=req.hibp_key,
        hunter_key=req.hunter_key,
    )
    return result


# ---------------------------------------------------------------------------
# Reddit profile
# ---------------------------------------------------------------------------

@router.post("/reddit")
async def reddit_lookup(req: RedditRequest):
    return await get_reddit_intel(req.username)


# ---------------------------------------------------------------------------
# Keybase linked accounts
# ---------------------------------------------------------------------------

@router.post("/keybase")
async def keybase_lookup(req: KeybaseRequest):
    return await get_keybase_intel(req.username)


# ---------------------------------------------------------------------------
# Paste site search
# ---------------------------------------------------------------------------

@router.post("/pastes")
async def paste_search(req: PasteRequest):
    return await get_paste_intel(
        query=req.query,
        google_cse_key=req.google_cse_key,
        google_cse_id=req.google_cse_id,
    )


# ---------------------------------------------------------------------------
# Dynamic dork generation
# ---------------------------------------------------------------------------

@router.post("/dorks")
async def generate_dork_sections(req: DorksRequest):
    sections = generate_dorks(
        full_name=req.full_name,
        usernames=req.usernames,
        email=req.email,
        employer=req.employer,
        location=req.location,
        phone=req.phone,
        aliases=req.aliases,
        age=req.age,
        education=req.education,
        is_ctf=req.is_ctf,
        discovered_emails=req.discovered_emails,
        discovered_usernames=req.discovered_usernames,
    )
    total = sum(len(s["dorks"]) for s in sections)
    return {"sections": sections, "total_dorks": total}


# ---------------------------------------------------------------------------
# Clarify (kept for compatibility)
# ---------------------------------------------------------------------------

@router.post("/clarify")
async def get_clarifying_questions(profile: PersonProfile):
    questions = []
    tips = []

    has_name     = bool(profile.full_name)
    has_username = bool(profile.usernames or profile.suspected_username)
    has_email    = bool(profile.email or profile.suspected_email)
    has_employer = bool(profile.employer or profile.suspected_employer)
    has_location = bool(profile.location or profile.suspected_location)

    if not has_username:
        questions.append({"field": "usernames", "question": "Do you have any known or suspected usernames?", "priority": "high"})
    if not has_email:
        questions.append({"field": "email", "question": "Is there an email address associated with this person?", "priority": "high"})
    if has_name and not has_location:
        questions.append({"field": "location", "question": f"Do you know what city/state {profile.full_name or 'this person'} is based in?", "priority": "medium"})
    if not has_employer:
        questions.append({"field": "employer", "question": "Do you know where this person works?", "priority": "medium"})

    readiness = "low"
    filled = sum([has_name, has_username, has_email, has_employer, has_location])
    if filled >= 4:
        readiness = "high"
    elif filled >= 2:
        readiness = "medium"

    return {"readiness": readiness, "filled_fields": filled, "questions": questions, "search_tips": tips}
