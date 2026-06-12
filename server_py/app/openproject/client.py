import base64
from typing import Any

import httpx

from app.config import config


class OpenProjectError(RuntimeError):
    pass


def _basic_auth_header() -> str:
    token = base64.b64encode(f"apikey:{config.op_api_key}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def _default_headers() -> dict[str, str]:
    return {
        "Authorization": _basic_auth_header(),
        "Accept": "application/json",
    }


async def op_get(path: str) -> dict[str, Any]:
    url = f"{config.op_base_url}{path}"
    try:
        async with httpx.AsyncClient(headers=_default_headers(), timeout=30.0) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        raise OpenProjectError(f"OpenProject API error: GET {path} - {exc}") from exc

    if not 200 <= response.status_code < 300:
        raise OpenProjectError(
            f"OpenProject API error: GET {path} - "
            f"{response.status_code} {response.reason_phrase}\n{response.text}"
        )

    return response.json()


async def op_patch(path: str, body: dict[str, Any]) -> dict[str, Any]:
    url = f"{config.op_base_url}{path}"
    headers = {**_default_headers(), "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
            response = await client.patch(url, json=body)
    except httpx.HTTPError as exc:
        raise OpenProjectError(f"OpenProject API error: PATCH {path} - {exc}") from exc

    if not 200 <= response.status_code < 300:
        raise OpenProjectError(
            f"OpenProject API error: PATCH {path} - "
            f"{response.status_code} {response.reason_phrase}\n{response.text}"
        )

    return response.json()


async def get_collection(path: str, query: dict[str, str | int] | None = None) -> list[dict[str, Any]]:
    all_elements: list[dict[str, Any]] = []
    page_size = 100
    offset = 1
    total = float("inf")

    while len(all_elements) < total:
        params = dict(query or {})
        params["pageSize"] = page_size
        params["offset"] = offset

        separator = "&" if "?" in path else "?"
        query_string = httpx.QueryParams(params)
        page = await op_get(f"{path}{separator}{query_string}")

        total = page.get("total", 0)
        elements = page.get("_embedded", {}).get("elements", [])
        all_elements.extend(elements)

        if len(elements) == 0:
            break

        offset += 1

    return all_elements


def id_from_href(href: str | None) -> str | None:
    if not href:
        return None
    segments = [segment for segment in href.split("/") if segment]
    return segments[-1] if segments else None
