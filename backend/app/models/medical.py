from pydantic import BaseModel, Field
from datetime import datetime, date
from uuid import UUID
from typing import Optional, List

class PacienteBase(BaseModel):
    dni: str = Field(..., pattern=r"^\d{7,10}$")
    nombre: str
    apellido: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    obra_social_id: Optional[UUID] = None
    nro_afiliado: Optional[str] = None

class PacienteCreate(PacienteBase):
    medico_creador_id: UUID

class Paciente(PacienteBase):
    id: UUID
    medico_creador_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class EvolucionBase(BaseModel):
    paciente_id: UUID
    medico_id: UUID
    turno_id: Optional[UUID] = None
    contenido: str
    adjuntos: List[str] = []

class EvolucionCreate(EvolucionBase):
    pass

class Evolucion(EvolucionBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
