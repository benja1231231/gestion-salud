from fastapi import APIRouter, Depends, HTTPException
from app.models.turno import TurnoCreate, Turno
from app.services.agenda_service import AgendaService
# from app.repositories.turno_repo import TurnoRepository

router = APIRouter()

@router.post("/", response_model=Turno)
async def crear_turno(turno: TurnoCreate):
    # En implementación real, inyectar repo y service
    # service = AgendaService(TurnoRepository())
    # return await service.crear_turno(turno)
    return {"message": "Endpoint configurado. Lógica de AgendaService lista."}
