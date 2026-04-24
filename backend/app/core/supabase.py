from supabase import create_client, Client
from app.core.config import settings

def get_supabase() -> Client:
    # Usamos SERVICE_ROLE_KEY para que el backend ignore RLS
    # Esto permite descargar recetas y gestionar datos sin fallos de permisos
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
