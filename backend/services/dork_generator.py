"""
Dynamic Google dork generator.

Takes the current profile + any discovered data and returns categorized
dork sections. Dorks incorporate discovered data (emails from GitHub commits,
usernames from Keybase, etc.) not just what the user originally typed.

Returns query strings (not full URLs) — the frontend builds the search URLs.
"""
import urllib.parse
from typing import Optional


def _q(s: str) -> str:
    """Wrap in quotes for exact-match Google search."""
    return f'"{s}"'


def generate_dorks(
    full_name:     Optional[str] = None,
    usernames:     list[str] | None = None,
    email:         Optional[str] = None,
    employer:      Optional[str] = None,
    location:      Optional[str] = None,
    phone:         Optional[str] = None,
    aliases:       list[str] | None = None,
    age:           Optional[str] = None,
    education:     Optional[str] = None,
    is_ctf:        bool = False,
    # Discovered data (enriched from automated scans)
    discovered_emails:    list[str] | None = None,
    discovered_usernames: list[str] | None = None,
) -> list[dict]:
    """
    Returns a list of dork sections, each with:
      { "section": str, "dorks": [{ "label": str, "query": str }] }
    """
    usernames         = usernames or []
    aliases           = aliases or []
    discovered_emails    = [e for e in (discovered_emails or []) if e != email]
    discovered_usernames = [u for u in (discovered_usernames or []) if u not in usernames]

    all_usernames = list(dict.fromkeys(usernames + discovered_usernames))
    all_emails    = list(dict.fromkeys(([email] if email else []) + discovered_emails))

    sections = []

    # ── Identity ─────────────────────────────────────────────────
    identity_dorks = []
    if full_name:
        identity_dorks += [
            {"label": f'Exact name match',               "query": _q(full_name)},
            {"label": f'Name + filetype PDF',             "query": f'{_q(full_name)} filetype:pdf'},
            {"label": f'Name on .gov sites',              "query": f'{_q(full_name)} site:.gov'},
            {"label": f'Name on .edu sites',              "query": f'{_q(full_name)} site:.edu'},
            {"label": f'Name in news',                    "query": f'{_q(full_name)} site:news.google.com OR site:reuters.com OR site:apnews.com'},
        ]
    if full_name and location:
        identity_dorks += [
            {"label": f'Name + location',                 "query": f'{_q(full_name)} {_q(location)}'},
            {"label": f'Public records: name + location', "query": f'{_q(full_name)} {_q(location)} "public record"'},
            {"label": f'Voter reg: name + location',      "query": f'{_q(full_name)} {_q(location)} site:.gov "voter"'},
        ]
    if full_name and employer:
        identity_dorks.append(
            {"label": f'Name + employer',                 "query": f'{_q(full_name)} {_q(employer)}'}
        )
    if full_name and age:
        identity_dorks.append(
            {"label": f'Name + age',                      "query": f'{_q(full_name)} "{age} years old" OR "age {age}"'}
        )
    if identity_dorks:
        sections.append({"section": "Identity", "dorks": identity_dorks})

    # ── Email ────────────────────────────────────────────────────
    email_dorks = []
    for em in all_emails:
        label_suffix = " (discovered)" if em != email else ""
        email_dorks += [
            {"label": f'Email anywhere{label_suffix}',    "query": _q(em)},
            {"label": f'Email on paste sites{label_suffix}', "query": f'{_q(em)} site:pastebin.com OR site:ghostbin.com OR site:paste.ee'},
            {"label": f'Email in GitHub commits{label_suffix}', "query": f'{_q(em)} site:github.com'},
        ]
    if email_dorks:
        sections.append({"section": "Email Intel", "dorks": email_dorks})

    # ── Social / Username ────────────────────────────────────────
    social_dorks = []
    for uname in all_usernames:
        label_suffix = " (discovered)" if uname in discovered_usernames else ""
        social_dorks += [
            {"label": f'Username exact match{label_suffix}',     "query": _q(uname)},
            {"label": f'GitHub profile{label_suffix}',           "query": f'{_q(uname)} site:github.com'},
            {"label": f'GitHub gists{label_suffix}',             "query": f'{_q(uname)} site:gist.github.com'},
            {"label": f'Reddit profile{label_suffix}',           "query": f'{_q(uname)} site:reddit.com'},
            {"label": f'Paste sites{label_suffix}',              "query": f'{_q(uname)} site:pastebin.com OR site:ghostbin.com'},
            {"label": f'Forum mentions{label_suffix}',           "query": f'{_q(uname)} inurl:forum OR inurl:thread OR inurl:topic'},
            {"label": f'HackerNews{label_suffix}',               "query": f'{_q(uname)} site:news.ycombinator.com'},
        ]
    if social_dorks:
        sections.append({"section": "Social & Username", "dorks": social_dorks})

    # ── Employment ───────────────────────────────────────────────
    emp_dorks = []
    if full_name and employer:
        emp_dorks += [
            {"label": f'LinkedIn: name at employer',      "query": f'{_q(full_name)} {_q(employer)} site:linkedin.com'},
            {"label": f'OpenPayrolls',                    "query": f'{_q(full_name)} site:openpayrolls.com'},
            {"label": f'GovSalaries',                     "query": f'{_q(full_name)} site:govsalaries.com'},
            {"label": f'SEC EDGAR filings',               "query": f'{_q(full_name)} site:efts.sec.gov OR site:sec.gov'},
            {"label": f'ProPublica Nonprofit Explorer',   "query": f'{_q(full_name)} site:projects.propublica.org'},
        ]
    elif employer:
        emp_dorks += [
            {"label": f'Employer on LinkedIn',            "query": f'{_q(employer)} site:linkedin.com/company'},
        ]
    elif full_name:
        emp_dorks += [
            {"label": f'LinkedIn profile',                "query": f'{_q(full_name)} site:linkedin.com/in'},
        ]
    if emp_dorks:
        sections.append({"section": "Employment", "dorks": emp_dorks})

    # ── Leaks & Breaches ────────────────────────────────────────
    leak_dorks = []
    for em in all_emails:
        label_suffix = " (discovered)" if em != email else ""
        leak_dorks += [
            {"label": f'Email in data dumps{label_suffix}', "query": f'{_q(em)} "leaked" OR "breach" OR "dump" OR "combo"'},
            {"label": f'Email on HaveIBeenPwned',           "query": f'{_q(em)} site:haveibeenpwned.com'},
        ]
    for uname in all_usernames:
        label_suffix = " (discovered)" if uname in discovered_usernames else ""
        leak_dorks.append(
            {"label": f'Username in data dumps{label_suffix}', "query": f'{_q(uname)} "leaked" OR "breach" OR "dump"'}
        )
    if full_name:
        leak_dorks.append(
            {"label": f'Name in court records',           "query": f'{_q(full_name)} "court" OR "docket" OR "case" site:.gov'}
        )
    if leak_dorks:
        sections.append({"section": "Leaks & Breaches", "dorks": leak_dorks})

    # ── Technical ───────────────────────────────────────────────
    tech_dorks = []
    for em in all_emails:
        label_suffix = " (discovered)" if em != email else ""
        tech_dorks += [
            {"label": f'Email in git commits{label_suffix}', "query": f'{_q(em)} inurl:commit site:github.com'},
            {"label": f'PGP keyservers{label_suffix}',       "query": f'{_q(em)} site:keys.openpgp.org OR site:keyserver.ubuntu.com'},
        ]
    for uname in all_usernames:
        label_suffix = " (discovered)" if uname in discovered_usernames else ""
        tech_dorks += [
            {"label": f'Code commit mentions{label_suffix}', "query": f'{_q(uname)} inurl:commit'},
            {"label": f'Docker Hub{label_suffix}',           "query": f'{_q(uname)} site:hub.docker.com'},
            {"label": f'npm packages{label_suffix}',         "query": f'{_q(uname)} site:npmjs.com'},
        ]
    if email and "@" in email:
        domain = email.split("@")[1]
        tech_dorks.append(
            {"label": f'Certificate transparency: email domain', "query": f'{_q(domain)} site:crt.sh'}
        )
    if tech_dorks:
        sections.append({"section": "Technical", "dorks": tech_dorks})

    # ── CTF-specific ─────────────────────────────────────────────
    if is_ctf:
        ctf_dorks = []
        for uname in all_usernames:
            ctf_dorks += [
                {"label": f'CTF writeups mentioning username', "query": f'{_q(uname)} CTF OR "capture the flag" OR writeup'},
                {"label": f'HackTheBox / TryHackMe profile',  "query": f'{_q(uname)} site:hackthebox.com OR site:tryhackme.com'},
                {"label": f'CTFtime profile',                 "query": f'{_q(uname)} site:ctftime.org'},
            ]
        if full_name:
            ctf_dorks.append(
                {"label": f'CTF results: {full_name}',        "query": f'{_q(full_name)} CTF OR "capture the flag"'}
            )
        if ctf_dorks:
            sections.append({"section": "CTF Specific", "dorks": ctf_dorks})

    # ── Phone ────────────────────────────────────────────────────
    if phone:
        sections.append({
            "section": "Phone",
            "dorks": [
                {"label": "Phone number exact match",         "query": _q(phone)},
                {"label": "Phone on Whitepages",              "query": f'{_q(phone)} site:whitepages.com'},
                {"label": "Phone on Truecaller",              "query": f'{_q(phone)} site:truecaller.com'},
            ],
        })

    # ── Education ────────────────────────────────────────────────
    if education:
        edu_dorks = []
        if full_name:
            edu_dorks += [
                {"label": f'Name at institution',             "query": f'{_q(full_name)} {_q(education)}'},
                {"label": f'Alumni search',                   "query": f'{_q(full_name)} alumni {_q(education)}'},
                {"label": f'Name on institution .edu site',   "query": f'{_q(full_name)} site:{education.lower().replace(" ", "")}.edu'},
            ]
        else:
            edu_dorks.append(
                {"label": f'Institution alumni',              "query": f'alumni {_q(education)}'}
            )
        sections.append({"section": "Education", "dorks": edu_dorks})

    return sections
