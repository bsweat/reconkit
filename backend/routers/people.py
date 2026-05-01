"""
People OSINT router.

POST /api/people/username  — streams SSE results for username lookup
POST /api/people/clarify   — returns clarifying questions given current profile
POST /api/people/search    — returns general search links for a person
"""
import json
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from services.username_checker import stream_username_check

router = APIRouter(prefix="/api/people", tags=["people"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class UsernameRequest(BaseModel):
    username: str


class PersonProfile(BaseModel):
    # Core intel
    full_name: Optional[str] = None
    usernames: list[str] = []
    employer: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None

    # Extended intel
    age: Optional[str] = None
    phone: Optional[str] = None
    aliases: list[str] = []
    hobbies: Optional[str] = None
    education: Optional[str] = None

    # Confidence — list of field names the user marked as unverified
    unverified_fields: list[str] = []

    # Backward compat (clarify endpoint still uses these)
    suspected_username: Optional[str] = None
    suspected_location: Optional[str] = None
    suspected_email: Optional[str] = None
    suspected_employer: Optional[str] = None

    # CTF context
    is_ctf: bool = False
    ctf_name: Optional[str] = None
    extra_notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Username stream endpoint
# ---------------------------------------------------------------------------

@router.post("/username")
async def username_lookup(req: UsernameRequest):
    """Stream SSE events as each site check completes."""

    async def generator():
        found_count = 0
        checked = 0
        async for result in stream_username_check(req.username):
            checked += 1
            if result["found"]:
                found_count += 1
            yield {
                "event": "result",
                "data": json.dumps({**result, "checked": checked, "found_total": found_count}),
            }
        yield {"event": "done", "data": json.dumps({"checked": checked, "found_total": found_count})}

    return EventSourceResponse(generator())


# ---------------------------------------------------------------------------
# Clarifying questions
# ---------------------------------------------------------------------------

@router.post("/clarify")
async def get_clarifying_questions(profile: PersonProfile):
    """
    Analyzes what the user has provided and returns the next best
    clarifying questions to enable a deeper search.
    """
    questions = []
    tips = []

    has_name = bool(profile.full_name)
    has_username = bool(profile.usernames or profile.suspected_username)
    has_email = bool(profile.email or profile.suspected_email)
    has_employer = bool(profile.employer or profile.suspected_employer)
    has_location = bool(profile.location or profile.suspected_location)

    if not has_username:
        questions.append({
            "field": "usernames",
            "question": "Do you have any known or suspected usernames? Even partial handles help.",
            "priority": "high",
        })

    if not has_email:
        questions.append({
            "field": "email",
            "question": "Is there an email address associated with this person (even a guessed format like firstname.lastname@company.com)?",
            "priority": "high",
        })

    if has_name and not has_location:
        questions.append({
            "field": "location",
            "question": f"Do you know or suspect what city/state {profile.full_name or 'this person'} is based in?",
            "priority": "medium",
        })

    if not has_employer:
        questions.append({
            "field": "employer",
            "question": "Do you know where this person works or has worked? Company names help narrow LinkedIn and news searches.",
            "priority": "medium",
        })

    if has_username and not has_name:
        questions.append({
            "field": "full_name",
            "question": "Do you know the person's real name? Some platforms expose it in profiles.",
            "priority": "medium",
        })

    if profile.is_ctf and not profile.ctf_name:
        questions.append({
            "field": "ctf_name",
            "question": "What CTF challenge is this for? Knowing the CTF name helps narrow context.",
            "priority": "low",
        })

    # Build search tips based on what we have
    if has_username:
        for uname in (profile.usernames or [profile.suspected_username]):
            tips.append(f'Google dork: site:github.com "{uname}"')
            tips.append(f'Google dork: "{uname}" site:pastebin.com')
    if has_name:
        tips.append(f'Google dork: "{profile.full_name}" filetype:pdf')
        tips.append(f'Google dork: "{profile.full_name}" site:linkedin.com')
    if has_employer:
        employer = profile.employer or profile.suspected_employer
        tips.append(f'Google dork: site:linkedin.com "{employer}" "{profile.full_name or ""}"')

    readiness = "low"
    filled = sum([has_name, has_username, has_email, has_employer, has_location])
    if filled >= 4:
        readiness = "high"
    elif filled >= 2:
        readiness = "medium"

    return {
        "readiness": readiness,
        "filled_fields": filled,
        "questions": questions,
        "search_tips": tips,
    }


# ---------------------------------------------------------------------------
# Search link generator
# ---------------------------------------------------------------------------

@router.post("/search")
async def generate_search_links(profile: PersonProfile):
    """
    Returns search links grouped by section.
    Does NOT duplicate sites already probed by the username sweep.
    """
    import urllib.parse

    def enc(s: str) -> str:
        return urllib.parse.quote_plus(s)

    def quoted(s: str) -> str:
        return urllib.parse.quote_plus(f'"{s}"')

    def slug(s: str) -> str:
        return s.lower().replace(" ", "-").replace(",", "").replace(".", "")

    sections: list[dict] = []

    all_usernames = list(profile.usernames)
    if profile.suspected_username:
        all_usernames.append(profile.suspected_username)

    name     = profile.full_name or ""
    email    = profile.email or profile.suspected_email or ""
    employer = profile.employer or profile.suspected_employer or ""
    location = profile.location or profile.suspected_location or ""

    # ── Public records (name required) ───────────────────────────
    if name:
        n_slug = slug(name)
        sections.append({
            "section": "Public Records",
            "links": [
                {"label": f"FastPeopleSearch: {name}",       "url": f"https://www.fastpeoplesearch.com/name/{n_slug}"},
                {"label": f"TruePeopleSearch: {name}",       "url": f"https://www.truepeoplesearch.com/results?name={enc(name)}"},
                {"label": f"Spokeo: {name}",                 "url": f"https://www.spokeo.com/{n_slug}"},
                {"label": f"Whitepages: {name}",             "url": f"https://www.whitepages.com/name/{n_slug}"},
                {"label": f"ZabaSearch: {name}",             "url": f"https://www.zabasearch.com/people/{enc(name)}/"},
                {"label": f"PeopleFinder: {name}",           "url": f"https://www.peoplefinder.com/people/{n_slug}/"},
                {"label": f"411.com: {name}",                "url": f"https://www.411.com/name/{n_slug}"},
                {"label": f"FamilyTreeNow: {name}",         "url": f"https://www.familytreenow.com/search/genealogy/results?first={enc(name.split()[0]) if ' ' in name else enc(name)}&last={enc(name.split()[-1]) if ' ' in name else ''}"},
            ],
        })

    # ── Name + Location cross-reference (CTF gold) ────────────────
    if name and location:
        loc_slug = slug(location)
        sections.append({
            "section": f"Name + Location: {name} / {location}",
            "links": [
                {"label": f'Google verbatim: "{name}" + "{location}"',       "url": f"https://www.google.com/search?q={quoted(name)}+{quoted(location)}"},
                {"label": f"LinkedIn people: {name} in {location}",          "url": f"https://www.linkedin.com/search/results/people/?keywords={enc(name)}&geoUrn={enc(location)}"},
                {"label": f"FastPeopleSearch: {name} in {location}",         "url": f"https://www.fastpeoplesearch.com/name/{slug(name)}_{loc_slug}"},
                {"label": f"TruePeopleSearch: {name} + {location}",          "url": f"https://www.truepeoplesearch.com/results?name={enc(name)}&citystatezip={enc(location)}"},
                {"label": f"Google news: \"{name}\" \"{location}\"",         "url": f"https://news.google.com/search?q={quoted(name)}+{quoted(location)}"},
                {"label": f"OpenPayrolls: {name} ({location})",              "url": f"https://openpayrolls.com/search?q={enc(name)}"},
                {"label": f'Google dork: public record "{name}" "{location}"',"url": f"https://www.google.com/search?q={quoted(name)}+{quoted(location)}+%22public+record%22"},
                {"label": f'Voter reg dork: "{name}" "{location}" site:.gov', "url": f"https://www.google.com/search?q={quoted(name)}+{quoted(location)}+site%3A.gov"},
            ],
        })
    elif name and not location:
        # No location — still generate useful name combos
        sections.append({
            "section": "Name Cross-Reference",
            "links": [
                {"label": f'LinkedIn people search: {name}',                 "url": f"https://www.linkedin.com/search/results/people/?keywords={enc(name)}"},
                {"label": f'Google dork: filetype:pdf "{name}"',             "url": f"https://www.google.com/search?q={quoted(name)}+filetype%3Apdf"},
                {"label": f'Google dork: "{name}" site:.gov',                "url": f"https://www.google.com/search?q={quoted(name)}+site%3A.gov"},
                {"label": f'Google dork: "{name}" site:.edu',                "url": f"https://www.google.com/search?q={quoted(name)}+site%3A.edu"},
                {"label": f'Google news: "{name}"',                          "url": f"https://news.google.com/search?q={quoted(name)}"},
                {"label": f'Archive.org mentions: "{name}"',                 "url": f"https://web.archive.org/web/*/{enc(name)}"},
            ],
        })

    # ── Employment & Payroll ──────────────────────────────────────
    emp_links = []
    if name:
        emp_links += [
            {"label": f"OpenPayrolls: {name}",                               "url": f"https://openpayrolls.com/search?q={enc(name)}"},
            {"label": f"GovSalaries: {name}",                                "url": f"https://govsalaries.com/search?q={enc(name)}"},
            {"label": f"ProPublica Nonprofit Explorer: {name}",              "url": f"https://projects.propublica.org/nonprofits/search?q={enc(employer or name)}"},
            {"label": f"PACER federal court: {name}",                        "url": f"https://pcl.uscourts.gov/pcl/pages/search/findParty.jsf"},
            {"label": f"SEC EDGAR filings: {name}",                          "url": f"https://efts.sec.gov/LATEST/search-index?q={quoted(name)}&dateRange=custom"},
        ]
    if employer:
        emp_links += [
            {"label": f"OpenPayrolls employer: {employer}",                  "url": f"https://openpayrolls.com/employer/{slug(employer)}"},
            {"label": f"LinkedIn company: {employer}",                       "url": f"https://www.linkedin.com/company/{enc(employer)}"},
            {"label": f"USASpending.gov: {employer}",                        "url": f"https://www.usaspending.gov/search/?hash=&query={enc(employer)}"},
        ]
    if emp_links:
        sections.append({"section": "Employment & Payroll", "links": emp_links})

    # ── Email intel ───────────────────────────────────────────────
    if email:
        sections.append({
            "section": "Email Intel",
            "links": [
                {"label": f"HaveIBeenPwned: {email}",                        "url": f"https://haveibeenpwned.com/account/{email}"},
                {"label": f"EmailRep.io: {email}",                           "url": f"https://emailrep.io/{email}"},
                {"label": f"Hunter.io email verifier: {email}",              "url": f"https://hunter.io/email-verifier/{email}"},
                {"label": f'Google dork: "{email}"',                         "url": f"https://www.google.com/search?q={quoted(email)}"},
                {"label": f'Pastebin dork: "{email}"',                       "url": f"https://www.google.com/search?q=site%3Apastebin.com+{quoted(email)}"},
            ],
        })

    # ── Username deep dorks (no sweep duplicates) ─────────────────
    for uname in all_usernames:
        sections.append({
            "section": f"Username Deep Search: {uname}",
            "links": [
                {"label": f'Google verbatim: "{uname}"',                      "url": f"https://www.google.com/search?q={quoted(uname)}"},
                {"label": f'Pastebin dork: site:pastebin.com "{uname}"',      "url": f"https://www.google.com/search?q=site%3Apastebin.com+{quoted(uname)}"},
                {"label": f'GitHub Gist dork: site:gist.github.com',          "url": f"https://www.google.com/search?q=site%3Agist.github.com+{quoted(uname)}"},
                {"label": f'Code commit mentions: "{uname}" inurl:commit',    "url": f"https://www.google.com/search?q={quoted(uname)}+inurl%3Acommit"},
                {"label": f'Forum mentions: "{uname}" inurl:forum',           "url": f"https://www.google.com/search?q={quoted(uname)}+inurl%3Aforum"},
                {"label": f'Wayback Machine: "{uname}"',                      "url": f"https://web.archive.org/web/*/{enc(uname)}"},
            ],
        })

    # ── Aliases ───────────────────────────────────────────────────
    for alias in (profile.aliases or []):
        sections.append({
            "section": f"Alias: {alias}",
            "links": [
                {"label": f'Google verbatim: "{alias}"',                      "url": f"https://www.google.com/search?q={quoted(alias)}"},
                {"label": f'Pastebin dork: "{alias}"',                        "url": f"https://www.google.com/search?q=site%3Apastebin.com+{quoted(alias)}"},
                {"label": f'Google: "{alias}" profile',                       "url": f"https://www.google.com/search?q={quoted(alias)}+%22profile%22"},
            ],
        })

    # ── Phone ─────────────────────────────────────────────────────
    if profile.phone:
        ph = profile.phone.strip()
        sections.append({
            "section": "Phone Lookup",
            "links": [
                {"label": f'Whitepages reverse: {ph}',                        "url": f"https://www.whitepages.com/reverse-phone/{enc(ph)}"},
                {"label": f'Spy Dialer: {ph}',                                "url": f"https://www.spydialer.com/default.aspx?phone={enc(ph)}"},
                {"label": f'Google verbatim: "{ph}"',                         "url": f"https://www.google.com/search?q={quoted(ph)}"},
                {"label": f'Truecaller search: {ph}',                         "url": f"https://www.truecaller.com/search/{enc(ph)}"},
            ],
        })

    # ── Hobbies / Interests ───────────────────────────────────────
    if profile.hobbies:
        hobby_links = []
        for h in [x.strip() for x in profile.hobbies.split(',') if x.strip()]:
            base = f"{quoted(name)}+" if name else ""
            hobby_links += [
                {"label": f'Google: "{name or "target"}" + "{h}"',            "url": f"https://www.google.com/search?q={base}{quoted(h)}"},
                {"label": f'Reddit: search "{h}"{" + " + name if name else ""}', "url": f"https://www.reddit.com/search/?q={quoted(h)}{'+' + enc(name) if name else ''}"},
                {"label": f'Meetup groups: "{h}"',                            "url": f"https://www.meetup.com/find/?keywords={enc(h)}"},
            ]
        if hobby_links:
            sections.append({"section": "Hobbies & Interests", "links": hobby_links})

    # ── Education ─────────────────────────────────────────────────
    if profile.education:
        edu = profile.education
        edu_links = [
            {"label": f'Google: "{name}" at "{edu}"' if name else f'Google: "{edu}" alumni', "url": f"https://www.google.com/search?q={quoted(name)+'+' if name else ''}{quoted(edu)}"},
            {"label": f'LinkedIn: {name} at {edu}' if name else f'LinkedIn: {edu}',           "url": f"https://www.linkedin.com/search/results/people/?keywords={enc((name + ' ' + edu).strip())}"},
            {"label": f'Google dork: "{name}" site:{slug(edu)}.edu' if name else f'site:{slug(edu)}.edu', "url": f"https://www.google.com/search?q={quoted(name)+'+' if name else ''}site%3A{slug(edu)}.edu"},
            {"label": f'Alumni search: "{name}" alumni {edu}' if name else f'Alumni: {edu}',  "url": f"https://www.google.com/search?q={quoted(name)+'+' if name else ''}alumni+{enc(edu)}"},
        ]
        sections.append({"section": "Education", "links": edu_links})

    # ── Age / DOB ────────────────────────────────────────────────
    if profile.age and name:
        sections.append({
            "section": "Age / DOB Cross-Reference",
            "links": [
                {"label": f'FastPeopleSearch: {name} age {profile.age}',      "url": f"https://www.fastpeoplesearch.com/name/{slug(name)}"},
                {"label": f'Google dork: "{name}" "{profile.age}" years old', "url": f"https://www.google.com/search?q={quoted(name)}+{quoted(profile.age)}+%22years+old%22"},
                {"label": f'TruePeopleSearch: {name} + age',                  "url": f"https://www.truepeoplesearch.com/results?name={enc(name)}&age={enc(profile.age)}"},
            ],
        })

    # ── Fallback dorks when minimal info provided ──────────────────
    # Always include basic dorks if we have at least a name or username
    if (name or all_usernames) and len(sections) < 2:
        target = name or all_usernames[0]
        sections.append({
            "section": "Starter Dorks",
            "links": [
                {"label": f'Google verbatim: "{target}"',                     "url": f"https://www.google.com/search?q={quoted(target)}"},
                {"label": f'Google dork: "{target}" filetype:pdf',            "url": f"https://www.google.com/search?q={quoted(target)}+filetype%3Apdf"},
                {"label": f'Google dork: "{target}" site:.gov',               "url": f"https://www.google.com/search?q={quoted(target)}+site%3A.gov"},
                {"label": f'Wayback Machine: {target}',                       "url": f"https://web.archive.org/web/*/{enc(target)}"},
            ],
        })

    # Flatten for response but keep section metadata
    all_links = []
    for sec in sections:
        for lnk in sec["links"]:
            all_links.append({**lnk, "section": sec["section"]})

    return {"sections": sections, "links": all_links, "count": len(all_links)}
