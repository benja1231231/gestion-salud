from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional
from enum import Enum
from app.core.timezone import TIMEZONE_ARGENTINA

class EstadoTurno(str, Enum):
    PENDIENTE = "pendiente"
    LLEGO = "llegó"
    EN_ESPERA = "en_espera"
    EN_CONSULTORIO = "en_consultorio"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"

class TurnoBase(BaseModel):
    medico_id: UUID
    paciente_id: UUID
    fecha_hora: datetime
    duracion_minutos: int = Field(default=15, gt=0)
    motivo: Optional[str] = None
    es_sobreturno: bool = False

class TurnoCreate(TurnoBase):
    @field_validator("fecha_hora")
    @classmethod
    def fecha_futura(cls, v: datetime) -> datetime:
        # Comparar en zona horaria Argentina
        v_aware = v.replace(tzinfo=TIMEZONE_ARGENTINA) if v.tzinfo is None else v
        if v_aware < datetime.now(timezone.utc).astimezone(TIMEZONE_ARGENTINA):
            raise ValueError("Fecha debe ser futura")
        return v

class Turno(TurnoBase):
    id: UUID
    estado: EstadoTurno
    created_at: datetime

    class Config:
        from_attributes = True
