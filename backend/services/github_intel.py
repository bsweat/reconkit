"""
GitHub intelligence service.

Streams profile data, repos, and extracts emails from commit history.

SSE events emitted:
  profile      — basic GitHub profile info
  repo         — one event per repo (name, stars, language, topics)
  emails_found — deduplicated emails discovered in commit metadata
  done         — scan complete summary

Rate limits:
  Unauthenticated: 60 req/hr  (cap at 5 repos for commit mining)
  Authenticated:  5000 req/hr (cap at 15 repos)
"""
import asyncio
import json
import re
from typing import AsyncGenerator

import httpx

GITHUB_API = "https://api.github.com"
NO_REPLY_RE = re.compile(r"\d+\+.+@users\.noreply\.github\.com")

HEADERS_BASE = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ReconKit/2.0",
}


def _build_headers(token: str | None) -> dict:
    h = dict(HEADERS_BASE)
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _rate_remaining(resp: httpx.Response) -> int:
    try:
        return int(resp.headers.get("X-RateLimit-Remaining", 999))
    except (ValueError, TypeError):
        return 999


async def stream_github_intel(
    username: str, token: str | None = None
) -> AsyncGenerator[str, None]:
    """
    Yields SSE-formatted strings (the raw data payloads for each event).
    Caller wraps these in EventSourceResponse.
    """
    headers = _build_headers(token)
    max_repos_for_commits = 15 if token else 5
    rate_limited = False

    async with httpx.AsyncClient(headers=headers, timeout=12.0) as client:

        # ── 1. Fetch profile ─────────────────────────────────────
        try:
            resp = await client.get(f"{GITHUB_API}/users/{username}")
            if _rate_remaining(resp) < 5:
                rate_limited = True
            if resp.status_code == 404:
                yield json.dumps({"event": "error", "data": {"error": "GitHub user not found"}})
                return
            if resp.status_code != 200:
                yield json.dumps({"event": "error", "data": {"error": f"GitHub API error {resp.status_code}"}})
                return

            p = resp.json()
            profile = {
                "login":        p.get("login"),
                "name":         p.get("name"),
                "bio":          p.get("bio"),
                "company":      p.get("company"),
                "location":     p.get("location"),
                "email":        p.get("email"),           # public email (may be null)
                "blog":         p.get("blog"),
                "twitter":      p.get("twitter_username"),
                "avatar_url":   p.get("avatar_url"),
                "html_url":     p.get("html_url"),
                "created_at":   p.get("created_at"),
                "followers":    p.get("followers", 0),
                "following":    p.get("following", 0),
                "public_repos": p.get("public_repos", 0),
                "public_gists": p.get("public_gists", 0),
            }
            yield json.dumps({"event": "profile", "data": profile})

        except Exception as exc:
            yield json.dumps({"event": "error", "data": {"error": str(exc)}})
            return

        if rate_limited:
            yield json.dumps({"event": "done", "data": {"rate_limited": True, "repos_scanned": 0, "emails_found": []}})
            return

        # ── 2. Fetch repos ──────────────────────────────────────
        repos_scanned = 0
        all_emails: set[str] = set()

        # Seed with public profile email if present
        if profile.get("email"):
            all_emails.add(profile["email"])

        try:
            resp = await client.get(
                f"{GITHUB_API}/users/{username}/repos",
                params={"sort": "pushed", "per_page": 30, "type": "owner"},
            )
            if _rate_remaining(resp) < 5:
                rate_limited = True
            repos = resp.json() if resp.status_code == 200 else []
        except Exception:
            repos = []

        # Emit each repo
        for repo in repos:
            if not isinstance(repo, dict):
                continue
            yield json.dumps({
                "event": "repo",
                "data": {
                    "name":        repo.get("name"),
                    "full_name":   repo.get("full_name"),
                    "description": repo.get("description"),
                    "language":    repo.get("language"),
                    "stars":       repo.get("stargazers_count", 0),
                    "forks":       repo.get("forks_count", 0),
                    "topics":      repo.get("topics", []),
                    "url":         repo.get("html_url"),
                    "updated_at":  repo.get("updated_at"),
                    "fork":        repo.get("fork", False),
                },
            })

        # ── 3. Mine commit emails ───────────────────────────────
        if not rate_limited:
            # Only mine from non-fork repos, sorted by push date
            mine_repos = [r for r in repos if isinstance(r, dict) and not r.get("fork")]
            mine_repos = mine_repos[:max_repos_for_commits]

            for repo in mine_repos:
                if rate_limited:
                    break
                repo_name = repo.get("name", "")
                try:
                    resp = await client.get(
                        f"{GITHUB_API}/repos/{username}/{repo_name}/commits",
                        params={"per_page": 10},
                    )
                    remaining = _rate_remaining(resp)
                    if remaining < 5:
                        rate_limited = True
                    if resp.status_code != 200:
                        continue

                    commits = resp.json()
                    repos_scanned += 1

                    for commit in commits:
                        if not isinstance(commit, dict):
                            continue
                        commit_data = commit.get("commit", {})
                        for role in ("author", "committer"):
                            actor = commit_data.get(role, {}) or {}
                            email = actor.get("email", "")
                            if email and "@" in email and not NO_REPLY_RE.match(email):
                                all_emails.add(email)

                except Exception:
                    continue

        # Emit discovered emails
        emails_list = sorted(all_emails)
        yield json.dumps({
            "event": "emails_found",
            "data": {
                "emails": emails_list,
                "count":  len(emails_list),
            },
        })

        yield json.dumps({
            "event": "done",
            "data": {
                "rate_limited":  rate_limited,
                "repos_scanned": repos_scanned,
                "emails_found":  emails_list,
            },
        })
