from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from app.models.medical import PacienteCreate, Paciente, EvolucionCreate, Evolucion

from app.repositories.medical_repo import MedicalRepository

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

    async def llamar_paciente_whatsapp(self, paciente_id: UUID, medico_nombre: str) -> str:
        """Genera link wa.me para notificar al paciente."""
        paciente = await self.repository.get_paciente_by_id(paciente_id)
        if not paciente or not paciente.telefono:
            raise ValueError("Paciente no tiene teléfono registrado.")
        
        mensaje = f"Hola {paciente.nombre}, el Dr/Dra {medico_nombre} te espera en el consultorio."
        encoded_msg = mensaje.replace(" ", "%20")
        return f"https://wa.me/{paciente.telefono}?text={encoded_msg}"
