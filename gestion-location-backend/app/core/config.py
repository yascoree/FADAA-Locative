from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/fadaa_locative_db"
    secret_key: str = "c"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    refresh_token_expire_days: int = 30

    # Chemin vers le fichier JSON de compte de service Firebase (voir Firebase Console
    # > Paramètres du projet > Comptes de service > Générer une nouvelle clé privée).
    # Tant que non renseigné, les push FCM sont simplement ignorés (les notifications
    # in-app continuent d'être créées normalement).
    firebase_credentials_path: str | None = None
    push_alert_days_before: int = 3
    push_overdue_reminder_every_days: int = 3


settings = Settings()
