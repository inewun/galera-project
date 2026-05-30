from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "Galera Planner Backend"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/galera"

    # OpenProject integration — placeholder for future use
    openproject_url: str | None = None
    openproject_api_key: str | None = None

    # JIRA integration — placeholder for future use
    jira_url: str | None = None
    jira_api_token: str | None = None
    jira_username: str | None = None


settings = Settings()
