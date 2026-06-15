from datetime import datetime
from zoneinfo import ZoneInfo

TIMEZONE_ARGENTINA = ZoneInfo('America/Argentina/Buenos_Aires')


def now_argentina() -> datetime:
    """Devuelve la fecha/hora actual en zona horaria Argentina."""
    return datetime.now(TIMEZONE_ARGENTINA)


def as_argentina(dt: datetime) -> datetime:
    """Convierte un datetime a zona horaria Argentina."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TIMEZONE_ARGENTINA)
    return dt.astimezone(TIMEZONE_ARGENTINA)
