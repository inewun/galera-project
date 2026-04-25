from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uvicorn
import os
import httpx

from db import models
from db.database import engine, get_db
from db.crud import create_task_link, get_task_links

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

app = FastAPI(on_startup=[init_db])

OPENPROJECT_URL = os.getenv("OPENPROJECT_URL")
OPENPROJECT_API_KEY = os.getenv("OPENPROJECT_API_KEY")

JIRA_URL = os.getenv("JIRA_URL")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_KEY = os.getenv("JIRA_API_KEY")

@app.get("/")
def root():
    return {"message": "Hello!"}

@app.get("/health/openproject")
async def health_openproject():
    url = f"{OPENPROJECT_URL}/api/v3/projects"
    auth = ("apikey", OPENPROJECT_API_KEY)

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(url, auth=auth)

    if response.status_code==200:
        return {"status": "succes connection to OpenProject"}
    else:
        raise HTTPException(status_code=response.status_code, detail=f"OpenProject return status code: {response.status_code}")

@app.get("/health/jira")
async def health_jira():
    url = f"{JIRA_URL}/rest/api/3/myself"
    auth = (JIRA_EMAIL, JIRA_API_KEY)

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(url, auth=auth)

    if response.status_code==200:
        return {"ststus": "succes connection to Jira"}
    else:
        raise HTTPException(status_code=response.status_code, detail=f"Jira return ststus code: {response.status_code}")

@app.post("/links")
async def create_link(openproject_id: str, jira_id: str, db: AsyncSession = Depends(get_db)):
    link = await create_task_link(db, openproject_id, jira_id)
    return {"id": link.id, "openproject_id": link.openproject_task_id, "jira_id": link.jira_task_id}

@app.get("/links")
async def list_links(db: AsyncSession = Depends(get_db)):
    links = await get_task_links(db)
    return links

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)