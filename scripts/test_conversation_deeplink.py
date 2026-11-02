#!/usr/bin/env python3
"""Regression for immutable conversation links and safe Magazine actions."""

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("CATACHAT_TEST_BASE_URL", "http://127.0.0.1:8770")
OUT = Path(__file__).resolve().parents[1] / "artifacts"


def main() -> None:
    OUT.mkdir(exist_ok=True)
    requested_paths: list[str] = []

    def respond(route):
        path = urlparse(route.request.url).path
        requested_paths.append(path)
        if path == "/user/profile":
            body = {"id": "author-1", "username": "Alpha", "identifier": "alpha@example.com", "role": "student"}
        elif path == "/api/catchat/conversations":
            body = [{
                "id": "conversation-1",
                "other_user_id": "editor-1",
                "other_username": "Editor One",
                "last_message_at": "2026-11-02T13:00:00Z",
                "created_at": "2026-11-02T12:00:00Z",
            }]
        elif path == "/api/catchat/conversations/conversation-1/messages":
            body = [{
                "id": "message-1",
                "conversation_id": "conversation-1",
                "sender_id": "editor-1",
                "sender_name": "Editor One",
                "content": "Magazine review: Changes were requested.\nOpen Magazine: https://catachess.com/magazine/2026-11\nUntrusted text: https://example.com/not-a-product-action",
                "created_at": "2026-11-02T13:00:00Z",
            }]
        elif path == "/api/catchat/groups":
            body = []
        elif path == "/api/catchat/broadcasts":
            body = []
        else:
            route.fulfill(status=404, content_type="application/json", body=json.dumps({"detail": path}))
            return
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.add_init_script("localStorage.setItem('catachess_token', 'test-token')")
        page.route("https://api.catachess.com/**", respond)
        page.goto(f"{BASE_URL}/conversation/conversation-1", wait_until="domcontentloaded")

        expect(page.get_by_text("Editor One", exact=True).first).to_be_visible()
        action = page.get_by_role("link", name="Open in CataChess")
        expect(action).to_have_attribute("href", "https://catachess.com/magazine/2026-11")
        expect(action).to_have_attribute("target", "_blank")
        expect(page.locator('.msg-bubble a')).to_have_count(1)
        expect(page.get_by_text("https://example.com/not-a-product-action", exact=False)).to_be_visible()
        assert "/user/by-username/Editor%20One" not in requested_paths
        page.screenshot(path=str(OUT / "conversation-deeplink.png"), full_page=True)
        browser.close()

    print("PASS exact conversation deep link and trusted Magazine action")


if __name__ == "__main__":
    main()
