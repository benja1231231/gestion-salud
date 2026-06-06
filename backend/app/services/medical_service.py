import time
from typing import Dict, List, Tuple
from uuid import UUID
from app.models.medical import PacienteCreate, EvolucionCreate

from app.repositories.medical_repo import MedicalRepository

_cache: Dict[str, Tuple[float, any]] = {}
CACHE_TTL = 30

def _get_cached(key: str):
    if key in _cache:
        ts, val = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return val
        del _cache[key]
    return None

def _set_cache(key: str, val):
    _cache[key] = (time.time(), val)

class MedicalService:
    def __init__(self, repository: MedicalRepository):
        self.repository = repository

    async def registrar_paciente(self, paciente: PacienteCreate) -> dict:
        """Registro de pacientes con validación de DNI único por médico."""
        existente = await self.repository.get_paciente_by_dni(paciente.dni, paciente.medico_creador_id)
        if existente:
            raise ValueError("Paciente con este DNI ya registrado para este médico.")
        return await self.repository.create_paciente(paciente)

    async def listar_pacientes(self) -> List[dict]:
        return await self.repository.get_pacientes()

    async def buscar_historia_clinica(self, paciente_id: UUID) -> List[dict]:
        return await self.repository.get_evoluciones_by_paciente(paciente_id)

    async def registrar_evolucion(self, evolucion: EvolucionCreate) -> dict:
        return await self.repository.create_evolucion(evolucion)

    async def get_reporte_os_mensual(self, medico_id: UUID) -> List[dict]:
        cache_key = f"rep_mensual:{medico_id}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached
        data = await self.repository.get_os_stats_by_month(medico_id)
        _set_cache(cache_key, data)
        return data

    async def get_reporte_os_diario(self, medico_id: UUID, mes: str) -> List[dict]:
        cache_key = f"rep_diario:{medico_id}:{mes}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached
        data = await self.repository.get_os_stats_daily(medico_id, mes)
        _set_cache(cache_key, data)
        return data

    async def llamar_paciente_whatsapp(self, paciente_id: UUID, medico_nombre: str) -> str:
        """Genera link wa.me para notificar al paciente."""
        paciente = await self.repository.get_paciente_by_id(paciente_id)
        if not paciente or not paciente.telefono:
            raise ValueError("Paciente no tiene teléfono registrado.")
        
        mensaje = f"Hola {paciente.nombre}, el Dr/Dra {medico_nombre} te espera en el consultorio."
        encoded_msg = mensaje.replace(" ", "%20")
        return f"https://wa.me/{paciente.telefono}?text={encoded_msg}"
