from typing import List, Optional
from uuid import UUID
from datetime import datetime
from supabase import Client
from app.models.medical import PacienteCreate, Paciente, EvolucionCreate, Evolucion
from app.models.turno import TurnoCreate, Turno

class MedicalRepository:
    def __init__(self, client: Client):
        self.client = client

    # Pacientes
    async def create_paciente(self, data: PacienteCreate) -> dict:
        res = self.client.table("pacientes").insert(data.model_dump(mode="json")).execute()
        return res.data[0]

    async def get_pacientes(self) -> List[dict]:
        res = self.client.table("pacientes").select("*").execute()
        return res.data

    async def get_paciente_by_dni(self, dni: str, medico_id: Optional[UUID] = None) -> Optional[dict]:
        query = self.client.table("pacientes").select("*").eq("dni", dni)
        if medico_id:
            query = query.eq("medico_creador_id", str(medico_id))
        res = query.execute()
        return res.data[0] if res.data else None

    async def get_paciente_by_id(self, id: UUID) -> Optional[dict]:
        res = self.client.table("pacientes").select("*").eq("id", str(id)).execute()
        return res.data[0] if res.data else None

    async def get_medico_by_id(self, id: UUID) -> Optional[dict]:
        res = self.client.table("medicos").select("*").eq("id", str(id)).execute()
        return res.data[0] if res.data else None

    # Turnos
    async def create_turno(self, data: TurnoCreate) -> dict:
        res = self.client.table("turnos").insert(data.model_dump(mode="json")).execute()
        return res.data[0]

    async def get_by_medico_and_range(self, medico_id: UUID, inicio: datetime, fin: datetime) -> List[dict]:
        res = self.client.table("turnos").select("*")\
            .eq("medico_id", str(medico_id))\
            .gte("fecha_hora", inicio.isoformat())\
            .lte("fecha_hora", fin.isoformat())\
            .execute()
        # Convertir a objetos Turno para el service
        return res.data

    async def check_availability(self, medico_id: UUID, fecha_hora: datetime) -> bool:
        res = self.client.table("turnos").select("*")\
            .eq("medico_id", str(medico_id))\
            .eq("fecha_hora", fecha_hora.isoformat())\
            .neq("estado", "cancelado")\
            .execute()
        return len(res.data) == 0

    # Evoluciones
    async def create_evolucion(self, data: EvolucionCreate) -> dict:
        res = self.client.table("evoluciones").insert(data.model_dump(mode="json")).execute()
        return res.data[0]

    async def get_evoluciones_by_paciente(self, paciente_id: UUID) -> List[dict]:
        res = self.client.table("evoluciones").select("*").eq("paciente_id", str(paciente_id)).execute()
        return res.data
