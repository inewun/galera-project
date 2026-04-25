from hmac import new
from unittest import skip
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import TaskLink

async def create_task_link(db: AsyncSession, openproject_id: str, jira_id: str) -> TaskLink:
    new_link = TaskLink(openproject_task_id = openproject_id, jira_task_id = jira_id)
    db.add(new_link)
    await db.commit()
    await db.refresh(new_link)
    return new_link

async def get_task_links(db: AsyncSession, skip: int = 0, limitt: int = 100):
    result = await db.execute(select(TaskLink).offset(skip).limit(limitt))
    return result.scalars().all()

async def get_link_by_openproject_id(db: AsyncSession, openproject_id: str):
    result = await db.execute(select(TaskLink).where(TaskLink.openproject_task_id == openproject_id))
    return result.scalar_one_or_none()

async def delete_task_link(db: AsyncSession, link_id: int):
    link = await db.get(TaskLink, link_id)
    if link:
        await db.delete(link)
        await db.commit()
        return True
    return False



