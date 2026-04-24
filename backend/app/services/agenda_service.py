from datetime import timedelta, datetime
from typing import List
from app.models.turno import TurnoCreate, Turno
from uuid import UUID

class AgendaService:
    def __init__(self, repository):
        self.repository = repository

    async def crear_turno(self, turno_data: TurnoCreate) -> Turno:
        """
        Crea un turno validando solapamientos y reglas de sobreturnos.
        """
        # 1. Buscar turnos existentes para el médico en ese día
        inicio_dia = turno_data.fecha_hora.replace(hour=0, minute=0, second=0)
        fin_dia = inicio_dia + timedelta(days=1)
        
        turnos_existentes = await self.repository.get_by_medico_and_range(
            turno_data.medico_id, inicio_dia, fin_dia
        )

        # 2. Validar solapamientos
        nuevo_inicio = turno_data.fecha_hora
        nuevo_fin = nuevo_inicio + timedelta(minutes=turno_data.duracion_minutos)

        for t in turnos_existentes:
            if t.estado == "cancelado":
                continue
                
            t_inicio = t.fecha_hora
            t_fin = t_inicio + timedelta(minutes=t.duracion_minutos)

            # Lógica de intersección: (StartA < EndB) and (EndA > StartB)
            if nuevo_inicio < t_fin and nuevo_fin > t_inicio:
                if not turno_data.es_sobreturno:
                    raise ValueError("Solapamiento detectado. Use 'sobreturno' si está autorizado.")
                
                # Si es sobreturno, igual validar que no haya demasiados (ej. max 2 por hora)
                # O simplemente permitirlo si el flag está activo (según requerimiento)
        
        # 3. Guardar en DB
        return await self.repository.create(turno_data)

    async def validar_disponibilidad(self, medico_id: UUID, inicio: datetime, fin: datetime) -> bool:
        """
        Chequeo rápido de huecos libres.
        """
        turnos = await self.repository.get_by_medico_and_range(medico_id, inicio, fin)
        return len([t for t in turnos if t.estado != "cancelado"]) == 0
