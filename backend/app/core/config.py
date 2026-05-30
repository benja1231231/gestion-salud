from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "GestionSalud"
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # Planes Manuales
    BANK_TRANSFER_INFO: str = "Alias: benjamartin.nx | CBU: 4530000800017972080653"
    
    class Config:
        env_file = ".env"

settings = Settings()
