from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    openf1_base_url: str = "https://api.openf1.org"

    # Live auth — free OAuth2 tier (3 req/s, 30 req/min). Required only inside
    # the live window (30 min before session start → 30 min after session end).
    # Historical data and replay need no credentials.
    openf1_username: str | None = None
    openf1_password: str | None = None
    openf1_token: str | None = None  # optional pre-issued bearer; skips OAuth

    poll_interval_ms: int = 5000
    timing_poll_interval_ms: int = 4000
    track_poll_interval_ms: int = 1000
    telemetry_poll_interval_ms: int = 1000
    cors_origins: str = "http://localhost:3000"

    # Replay is the default dev path — historical OpenF1 data is free and keyless.
    replay_mode: bool = True
    replay_session_key: int = 9165
    replay_step_seconds: float = 1.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def live_auth_configured(self) -> bool:
        return bool(
            self.openf1_token
            or (self.openf1_username and self.openf1_password)
        )


settings = Settings()
