from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.medical import PacienteCreate, Paciente
from app.models.turno import TurnoCreate, Turno
from app.services.medical_service import MedicalService
from app.services.agenda_service import AgendaService
from app.repositories.medical_repo import MedicalRepository
from app.core.supabase import get_supabase

router = APIRouter()

def get_medical_service():
    client = get_supabase()
    repo = MedicalRepository(client)
    return MedicalService(repo)

def get_agenda_service():
    client = get_supabase()
    repo = MedicalRepository(client)
    return AgendaService(repo)

@router.get("/paciente/{dni}")
async def check_paciente(dni: str, medico_id: UUID, service: MedicalService = Depends(get_medical_service)):
    paciente = await service.repository.get_paciente_by_dni(dni, medico_id)
    if paciente:
        # Solo devolver info básica para confirmar identidad
        return {
            "id": paciente["id"],
            "nombre": paciente["nombre"],
            "apellido": paciente["apellido"]
        }
    return None

@router.post("/paciente", response_model=Paciente)
async def registrar_paciente_publico(paciente: PacienteCreate, service: MedicalService = Depends(get_medical_service)):
    try:
        return await service.registrar_paciente(paciente)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/turno", response_model=dict)
async def agendar_turno_publico(turno: TurnoCreate, service: AgendaService = Depends(get_agenda_service)):
    # Validar disponibilidad exacta
    is_available = await service.repository.check_availability(turno.medico_id, turno.fecha_hora)
    if not is_available:
        raise HTTPException(status_code=400, detail="El horario ya no está disponible.")
    
    try:
        # Usamos dict porque crear_turno del repo devuelve dict
        res = await service.repository.create_turno(turno)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/medico/{medico_id}")
async def get_medico_info(medico_id: UUID, service: MedicalService = Depends(get_medical_service)):
    medico = await service.repository.get_medico_by_id(medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    return {"nombre": medico["nombre"], "apellido": medico["apellido"]}

@router.get("/disponibilidad/{medico_id}")
async def get_disponibilidad(medico_id: UUID, fecha: str, service: AgendaService = Depends(get_agenda_service)):
    # 1. Obtener config del médico
    medico = await service.repository.get_medico_by_id(medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    
    config = medico.get("config_agenda", {
        "inicio": "08:00", 
        "fin": "20:00", 
        "duracion_turno": 10, 
        "dias_laborales": [1,2,3,4,5]
    })

    # 2. Parsear fecha
    try:
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    
    # 3. Validar si es día laboral
    # weekday() en Python: 0=Lunes, 6=Domingo. 
    # En nuestro config (JS): 1=Lunes, 0=Domingo.
    dia_semana_python = fecha_dt.weekday()
    # Mapeo: 0(L)->1, 1(M)->2, ..., 5(S)->6, 6(D)->0
    dia_semana_js = (dia_semana_python + 1) % 7
    
    if dia_semana_js not in config.get("dias_laborales", []):
        return [] # No atiende este día

    inicio_dia = fecha_dt.replace(hour=0, minute=0, second=0)
    fin_dia = inicio_dia.replace(hour=23, minute=59, second=59)
    
    turnos = await service.repository.get_by_medico_and_range(medico_id, inicio_dia, fin_dia)
    horas_ocupadas = [t["fecha_hora"] for t in turnos if t["estado"] != "cancelado"]
    
    # 4. Generar slots basados en config
    slots = []
    h_inicio, m_inicio = map(int, config.get("inicio", "08:00").split(":"))
    h_fin, m_fin = map(int, config.get("fin", "20:00").split(":"))
    duracion = config.get("duracion_turno", 15)

    current = fecha_dt.replace(hour=h_inicio, minute=m_inicio)
    while current.hour < h_fin or (current.hour == h_fin and current.minute < m_fin):
        slot_iso = current.isoformat()
        # Verificación de solapamiento
        is_taken = any(slot_iso in h or h in slot_iso for h in horas_ocupadas)
        slots.append({"hora": current.strftime("%H:%M"), "disponible": not is_taken})
        current += timedelta(minutes=duracion)
    
    return slots

from datetime import timedelta
