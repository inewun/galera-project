from typing import Any

from app.openproject.client import id_from_href
from app.openproject.schemas import Group, Project, Task, User


def map_work_package(wp: dict[str, Any]) -> Task:
    links = wp.get("_links") or {}
    assignee_href = (links.get("assignee") or {}).get("href")

    assignee_type = None
    if assignee_href and "/groups/" in assignee_href:
        assignee_type = "group"
    elif assignee_href and "/users/" in assignee_href:
        assignee_type = "user"

    return Task(
        id=str(wp.get("id")),
        subject=wp.get("subject"),
        start=wp.get("startDate"),
        due=wp.get("dueDate"),
        progress=wp.get("percentageDone") or 0,
        status=(links.get("status") or {}).get("title") or "",
        typeName=(links.get("type") or {}).get("title") or "",
        assigneeId=id_from_href(assignee_href),
        assigneeType=assignee_type,
        parentId=id_from_href((links.get("parent") or {}).get("href")),
        projectId=id_from_href((links.get("project") or {}).get("href")),
        dependencies=[],
    )


def map_user(user: dict[str, Any]) -> User:
    links = user.get("_links") or {}
    return User(
        id=str(user.get("id")),
        name=user.get("name"),
        email=user.get("email"),
        avatarUrl=(links.get("avatar") or {}).get("href"),
        groupIds=[],
    )


def map_group(group: dict[str, Any]) -> Group:
    member_ids: list[str] = []
    embedded_members = (group.get("_embedded") or {}).get("members")

    if embedded_members:
        member_ids = [
            member_id
            for member in embedded_members
            if (member_id := id_from_href(((member.get("_links") or {}).get("self") or {}).get("href")))
        ]
    elif (group.get("_links") or {}).get("members"):
        member_ids = [
            member_id
            for member in (group.get("_links") or {}).get("members", [])
            if (member_id := id_from_href(member.get("href")))
        ]

    return Group(
        id=str(group.get("id")),
        name=group.get("name"),
        memberIds=member_ids,
    )


def map_project(project: dict[str, Any]) -> Project:
    return Project(
        id=str(project.get("id")),
        name=project.get("name"),
    )
