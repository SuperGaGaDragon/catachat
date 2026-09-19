#!/usr/bin/env python3
"""Browser regression tests for the CataChess -> CataChat auth handoff."""

from __future__ import annotations

import os

from playwright.sync_api import Page, Route, expect, sync_playwright


BASE_URL = os.environ.get("CATACHAT_TEST_BASE_URL", "http://127.0.0.1:8770")


def mock_api(page: Page, observed_auth: list[str]) -> None:
    def respond(route: Route) -> None:
        authorization = route.request.headers.get("authorization")
        if authorization:
            observed_auth.append(authorization)

        path = route.request.url.split("api.catachess.com", 1)[-1].split("?", 1)[0]
        if path == "/user/profile":
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"id":"user-1","username":"alice","identifier":"alice","role":"user"}',
            )
        else:
            route.fulfill(status=200, content_type="application/json", body="[]")

    page.route("https://api.catachess.com/**", respond)


def test_fragment_replaces_stale_token(page: Page) -> None:
    observed_auth: list[str] = []
    mock_api(page, observed_auth)
    page.add_init_script(
        """
        localStorage.setItem('catachess_token', 'stale-token');
        localStorage.setItem('catachess_user_id', 'stale-user');
        sessionStorage.setItem('catachess_token', 'older-session-token');
        """
    )

    page.goto(f"{BASE_URL}/#token=fresh-token&persist=0", wait_until="networkidle")

    expect(page).to_have_url(f"{BASE_URL}/")
    expect(page.locator(".sidebar-brand-text")).to_contain_text("catachat")
    assert page.evaluate("localStorage.getItem('catachess_token')") is None
    assert page.evaluate("localStorage.getItem('catachess_user_id')") is None
    assert page.evaluate("sessionStorage.getItem('catachess_token')") == "fresh-token"
    assert observed_auth and all(value == "Bearer fresh-token" for value in observed_auth)


def test_legacy_query_remains_compatible(page: Page) -> None:
    observed_auth: list[str] = []
    mock_api(page, observed_auth)

    page.goto(f"{BASE_URL}/?keep=1&token=legacy-token", wait_until="networkidle")

    expect(page).to_have_url(f"{BASE_URL}/?keep=1")
    assert page.evaluate("localStorage.getItem('catachess_token')") == "legacy-token"
    assert page.evaluate("sessionStorage.getItem('catachess_token')") is None
    assert observed_auth and all(value == "Bearer legacy-token" for value in observed_auth)


def test_missing_token_still_requires_login(page: Page) -> None:
    page.goto(BASE_URL, wait_until="domcontentloaded")
    expect(page).to_have_url(f"{BASE_URL}/login")
    expect(page.locator(".login-subtitle")).to_have_text(
        "Sign in with your catachess account"
    )


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for test in (
                test_fragment_replaces_stale_token,
                test_legacy_query_remains_compatible,
                test_missing_token_still_requires_login,
            ):
                context = browser.new_context()
                page = context.new_page()
                test(page)
                context.close()
                print(f"PASS {test.__name__}")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
