#!/usr/bin/env python3
"""n8n platform smoke (instance health / version / workflows / executions).

Unlike sidecar smokes, this exercises the n8n HTTP API itself.

Env:
  N8N_BASE_URL           required (e.g. http://127.0.0.1:5678)
  N8N_API_KEY            required (public API key)
  EXPECTED_N8N_VERSION   optional; when set, must match detected version
  N8N_REPORTED_VERSION   optional override if editor-asset scrape fails
  SMOKE_EXEC_LIMIT       optional; recent executions to scan (default 30)

Usage:
  python3 scripts/smoke_n8n_platform.py \\
    --baseline docs/upgrade-baseline/workflows-2.28.7.json

  # optional: fire allow-listed test-gated webhooks
  python3 scripts/smoke_n8n_platform.py --baseline ... --trigger

Exit 0 = pass. Stdlib only; bypasses local HTTP(S)_PROXY for 127.0.0.1.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from typing import Any
from urllib import error, parse, request

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TRIGGERS = ROOT / "scripts" / "smoke_triggers.json"

_OPENER = request.build_opener(request.ProxyHandler({}))


class SmokeFailure(Exception):
    pass


def _ok(msg: str) -> None:
    print(f"OK  {msg}", flush=True)


def _warn(msg: str) -> None:
    print(f"WARN {msg}", flush=True)


def _fail(msg: str) -> None:
    raise SmokeFailure(msg)


def _env(name: str, default: str | None = None) -> str | None:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip()


def _base_url() -> str:
    base = _env("N8N_BASE_URL")
    if not base:
        _fail("N8N_BASE_URL is required")
    return base.rstrip("/")


def _api_key() -> str:
    key = _env("N8N_API_KEY")
    if not key:
        _fail("N8N_API_KEY is required")
    return key


def _request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    data: bytes | None = None,
    timeout: int = 30,
    expect_json: bool = True,
) -> tuple[int, Any, dict[str, str]]:
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    req = request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with _OPENER.open(req, timeout=timeout) as resp:
            raw = resp.read()
            status = getattr(resp, "status", 200) or 200
            resp_headers = {k.lower(): v for k, v in resp.headers.items()}
            if not expect_json:
                return status, raw, resp_headers
            text = raw.decode() if raw else ""
            return status, (json.loads(text) if text else {}), resp_headers
    except error.HTTPError as exc:
        body = exc.read().decode(errors="replace")[:800]
        _fail(f"HTTP {exc.code} {method} {url}\n{body}")
    except error.URLError as exc:
        _fail(f"URL error {method} {url}: {exc}")
    return 0, {}, {}


def _api_get(path: str, *, timeout: int = 30) -> Any:
    status, body, _ = _request(
        "GET",
        f"{_base_url()}{path}",
        headers={"X-N8N-API-KEY": _api_key()},
        timeout=timeout,
    )
    if status >= 400:
        _fail(f"GET {path} → HTTP {status}")
    return body


def _paginate_workflows() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        qs = "limit=250&excludePinnedData=true"
        if cursor:
            qs += f"&cursor={parse.quote(cursor)}"
        body = _api_get(f"/api/v1/workflows?{qs}")
        chunk = body.get("data") if isinstance(body, dict) else None
        if not isinstance(chunk, list):
            _fail(f"unexpected workflows payload: {type(body)}")
        items.extend(chunk)
        cursor = body.get("nextCursor")
        if not cursor:
            break
    return items


def _list_executions(*, limit: int) -> list[dict[str, Any]]:
    body = _api_get(f"/api/v1/executions?limit={limit}")
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, list):
        _fail(f"unexpected executions payload: {type(body)}")
    return data


def step_healthz() -> None:
    status, body, _ = _request("GET", f"{_base_url()}/healthz", timeout=15)
    if status != 200:
        _fail(f"/healthz HTTP {status}")
    if not isinstance(body, dict) or body.get("status") != "ok":
        _fail(f"/healthz unexpected body: {body}")
    _ok("/healthz status=ok")


def _detect_version_from_editor() -> str | None:
    """Best-effort version from editor HTML / assets (no docker required).

    2.46+: meta `n8n:config:sentry` base64 JSON has `release: "n8n@x.y.z"`.
    2.28.x: main `/assets/index-*.js` embeds `n8n@x.y.z`.
    """
    status, raw, _ = _request(
        "GET", f"{_base_url()}/", timeout=20, expect_json=False
    )
    if status != 200 or not isinstance(raw, (bytes, bytearray)):
        return None
    html = raw.decode("utf-8", errors="replace")

    sentry = re.search(
        r'<meta\s+name="n8n:config:sentry"\s+content="([^"]+)"', html
    )
    if sentry:
        try:
            payload = json.loads(base64.b64decode(sentry.group(1)).decode())
            release = str(payload.get("release") or "")
            m = re.fullmatch(r"n8n@(\d+\.\d+\.\d+)", release)
            if m:
                return m.group(1)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            pass

    assets = re.findall(r'(?:src|href)="(/assets/[^"]+\.js)"', html)
    # Prefer small index/entry chunks first (2.28 embeds version there).
    assets = sorted(set(assets), key=lambda p: (0 if "index-" in p else 1, p))
    for asset in assets:
        st2, js, _ = _request(
            "GET", f"{_base_url()}{asset}", timeout=60, expect_json=False
        )
        if st2 != 200 or not isinstance(js, (bytes, bytearray)):
            continue
        text = js.decode("utf-8", errors="replace")
        hits = re.findall(r"n8n@(\d+\.\d+\.\d+)", text)
        if hits:
            return max(set(hits), key=hits.count)
    return None


def step_version(expected: str | None) -> str | None:
    override = _env("N8N_REPORTED_VERSION")
    detected = override or _detect_version_from_editor()
    if expected:
        if not detected:
            _fail(
                f"EXPECTED_N8N_VERSION={expected} but could not detect version "
                "(set N8N_REPORTED_VERSION to override)"
            )
        if detected != expected:
            _fail(f"version mismatch: expected {expected}, got {detected}")
        _ok(f"version={detected} matches EXPECTED_N8N_VERSION")
        return detected
    if detected:
        _ok(f"version={detected} (no EXPECTED_N8N_VERSION; not asserted)")
    else:
        _warn("version not detected (no EXPECTED_N8N_VERSION; continuing)")
    return detected


def step_baseline(baseline_path: Path) -> dict[str, Any]:
    if not baseline_path.is_file():
        _fail(f"baseline missing: {baseline_path}")
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    expected_items = baseline.get("workflows") or []
    if not isinstance(expected_items, list):
        _fail("baseline.workflows must be a list")

    live = _paginate_workflows()
    live_meta = [
        {
            "id": w.get("id"),
            "name": w.get("name"),
            "active": bool(w.get("active")),
            "isArchived": bool(w.get("isArchived", False)),
        }
        for w in live
    ]

    if len(live_meta) != len(expected_items):
        _fail(
            f"workflow count mismatch: live={len(live_meta)} "
            f"baseline={len(expected_items)}"
        )

    base_active = {
        (str(w["id"]), str(w["name"]))
        for w in expected_items
        if w.get("active")
    }
    live_active = {
        (str(w["id"]), str(w["name"])) for w in live_meta if w["active"]
    }
    if live_active != base_active:
        only_live = sorted(live_active - base_active)
        only_base = sorted(base_active - live_active)
        _fail(
            "active workflow set mismatch: "
            f"only_live={only_live[:10]} only_baseline={only_base[:10]}"
        )

    base_ids = {str(w["id"]) for w in expected_items}
    live_ids = {str(w["id"]) for w in live_meta}
    if live_ids != base_ids:
        _fail(
            "workflow id set mismatch: "
            f"only_live={sorted(live_ids - base_ids)[:10]} "
            f"only_baseline={sorted(base_ids - live_ids)[:10]}"
        )

    _ok(
        f"workflows count={len(live_meta)} active={len(live_active)} "
        f"match baseline {baseline_path.name}"
    )
    return baseline


def step_no_crashed(*, limit: int) -> None:
    rows = _list_executions(limit=limit)
    crashed = [e for e in rows if str(e.get("status") or "") == "crashed"]
    if crashed:
        sample = [
            f"{e.get('id')}:{e.get('workflowId')}:{e.get('startedAt')}"
            for e in crashed[:5]
        ]
        _fail(f"found crashed executions in last {limit}: {sample}")
    statuses: dict[str, int] = {}
    for e in rows:
        s = str(e.get("status") or "unknown")
        statuses[s] = statuses.get(s, 0) + 1
    _ok(f"no crashed in last {len(rows)} executions statuses={statuses}")


def _load_triggers(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        _fail(f"triggers file missing: {path}")
    doc = json.loads(path.read_text(encoding="utf-8"))
    triggers = doc.get("triggers") or []
    if not isinstance(triggers, list) or not triggers:
        _fail(f"no triggers listed in {path}")
    return triggers


def _max_execution_id(workflow_id: str) -> int:
    rows = _list_executions(limit=50)
    ids = [
        int(e["id"])
        for e in rows
        if str(e.get("workflowId")) == str(workflow_id)
        and str(e.get("id", "")).isdigit()
    ]
    return max(ids) if ids else 0


def _poll_execution(
    *,
    workflow_id: str,
    after_id: int,
    success_statuses: set[str],
    timeout_s: float,
) -> dict[str, Any]:
    deadline = time.time() + timeout_s
    last_seen: list[str] = []
    while time.time() < deadline:
        rows = _list_executions(limit=50)
        candidates = [
            e
            for e in rows
            if str(e.get("workflowId")) == str(workflow_id)
            and str(e.get("id", "")).isdigit()
            and int(e["id"]) > after_id
        ]
        last_seen = [
            f"{e.get('id')}:{e.get('status')}" for e in candidates[:5]
        ]
        for e in sorted(candidates, key=lambda x: int(x["id"])):
            status = str(e.get("status") or "")
            if status in {"running", "waiting", "new", "unknown"}:
                continue
            if status in success_statuses:
                return e
            _fail(
                f"trigger execution {e.get('id')} finished status={status} "
                f"(want {sorted(success_statuses)})"
            )
        time.sleep(2)
    _fail(
        f"timeout waiting for workflow {workflow_id} execution after id={after_id}; "
        f"seen={last_seen}"
    )
    return {}


def step_triggers(triggers_path: Path) -> None:
    triggers = _load_triggers(triggers_path)
    for t in triggers:
        tid = t.get("id") or t.get("path") or "trigger"
        gate = t.get("test_gate")
        if not gate:
            _fail(f"trigger {tid}: missing test_gate (refuse to fire)")
        path = str(t.get("path") or "")
        if not path.startswith("/"):
            path = "/" + path
        method = str(t.get("method") or "POST").upper()
        workflow_id = str(t.get("workflow_id") or "")
        if not workflow_id:
            _fail(f"trigger {tid}: workflow_id required for polling")
        success = set(t.get("success_statuses") or ["success"])
        timeout_s = float(t.get("poll_timeout_s") or 180)

        body_obj = t.get("body")
        # Compact JSON matches JS JSON.stringify / Tally HMAC when n8n
        # falls back to stringify(body) (rawBody often absent in item json).
        _dumps = lambda o: json.dumps(o, separators=(",", ":")).encode()
        # Stamp a unique marker so retries don't look identical in Sheets.
        if isinstance(body_obj, dict):
            body_obj = json.loads(json.dumps(body_obj))
            marker = f"smoke-{uuid.uuid4().hex[:8]}"
            data = body_obj.get("data")
            if isinstance(data, dict) and isinstance(data.get("fields"), list):
                data["fields"] = list(data["fields"]) + [
                    {"label": "SmokeMarker", "value": marker}
                ]
            payload = _dumps(body_obj)
        elif body_obj is None:
            payload = None
        else:
            payload = _dumps(body_obj)

        headers = dict(t.get("headers") or {})
        if payload is not None and "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"

        # Optional HMAC for signed webhooks (e.g. Tally). Secret from env only.
        sign = t.get("sign") or {}
        if isinstance(sign, dict) and sign.get("env_secret") and payload is not None:
            secret = _env(str(sign["env_secret"]))
            if not secret:
                _fail(
                    f"trigger {tid}: sign.env_secret={sign['env_secret']} "
                    "is empty / unset"
                )
            algo = str(sign.get("algo") or "hmac-sha256-base64")
            header_name = str(sign.get("header") or "tally-signature")
            if algo == "hmac-sha256-base64":
                digest = hmac.new(
                    secret.encode(), payload, hashlib.sha256
                ).digest()
                headers[header_name] = base64.b64encode(digest).decode()
            else:
                _fail(f"trigger {tid}: unsupported sign.algo={algo}")

        before = _max_execution_id(workflow_id)
        url = f"{_base_url()}{path}"
        _ok(f"trigger {tid} → {method} {path} (gate: {gate})")
        status, resp_body, _ = _request(
            method,
            url,
            headers=headers,
            data=payload,
            timeout=60,
            expect_json=False,
        )
        if status >= 400:
            preview = (
                resp_body[:400]
                if isinstance(resp_body, (bytes, bytearray))
                else resp_body
            )
            _fail(f"trigger {tid} HTTP {status}: {preview}")

        exe = _poll_execution(
            workflow_id=workflow_id,
            after_id=before,
            success_statuses=success,
            timeout_s=timeout_s,
        )
        _ok(
            f"trigger {tid} execution id={exe.get('id')} "
            f"status={exe.get('status')}"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--baseline",
        required=True,
        help="path to workflow metadata snapshot JSON",
    )
    parser.add_argument(
        "--trigger",
        action="store_true",
        help="fire allow-listed test-gated webhooks from smoke_triggers.json",
    )
    parser.add_argument(
        "--triggers-file",
        default=str(DEFAULT_TRIGGERS),
        help="triggers JSON (default: scripts/smoke_triggers.json)",
    )
    parser.add_argument(
        "--exec-limit",
        type=int,
        default=int(_env("SMOKE_EXEC_LIMIT", "30") or "30"),
        help="recent executions to scan for crashed (default 30)",
    )
    args = parser.parse_args(argv)

    print(f"n8n platform smoke → {_env('N8N_BASE_URL')}", flush=True)
    try:
        step_healthz()
        step_version(_env("EXPECTED_N8N_VERSION"))
        step_baseline(Path(args.baseline))
        step_no_crashed(limit=max(1, args.exec_limit))
        if args.trigger:
            step_triggers(Path(args.triggers_file))
        else:
            _ok("skipped --trigger (default)")
    except SmokeFailure as exc:
        print(f"FAIL {exc}", file=sys.stderr, flush=True)
        return 1
    print("PASS n8n platform smoke", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
