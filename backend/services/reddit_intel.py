"""
Reddit intelligence service.

Reddit's public JSON API blocks server-side requests since their 2023 API policy change.
This service provides direct profile links and search dorks for manual investigation.
If Reddit opens access again in the future, the async fetch code is preserved below.
"""
import urllib.parse


def _q(s: str) -> str:
    return urllib.parse.quote_plus(f'"{s}"')


async def get_reddit_intel(username: str) -> dict:
    """
    Returns profile links and search dorks for a Reddit username.
    Reddit's API now requires OAuth for server-side access.
    """
    profile_url  = f"https://www.reddit.com/user/{username}"
    old_url      = f"https://old.reddit.com/user/{username}"
    search_url   = f"https://www.reddit.com/search/?q=%22{urllib.parse.quote(username)}%22&type=user"

    links = [
        {"label": "Reddit Profile",             "url": profile_url},
        {"label": "Reddit Profile (old.reddit)","url": old_url},
        {"label": "Reddit Search for username", "url": search_url},
        {"label": f'Google: site:reddit.com "{username}"',
         "url": f"https://www.google.com/search?q=site%3Areddit.com+{_q(username)}"},
        {"label": f'Google: Reddit posts by "{username}"',
         "url": f"https://www.google.com/search?q=site%3Areddit.com+%22u%2F{urllib.parse.quote(username)}%22"},
        {"label": "Pushshift Reddit search (if available)",
         "url": f"https://www.reddit.com/search/?q=author%3A{urllib.parse.quote(username)}"},
    ]

    return {
        "ok":              True,
        "api_blocked":     True,
        "message":         "Reddit's API requires OAuth for server-side access. Use the links below to investigate manually.",
        "username":        username,
        "profile_url":     profile_url,
        "links":           links,
    }
