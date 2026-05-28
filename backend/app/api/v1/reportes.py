from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from app.services.medical_service import MedicalService
from app.repositories.medical_repo import MedicalRepository
from app.core.supabase import get_supabase

router = APIRouter()

def get_service():
    client = get_supabase()
    repo = MedicalRepository(client)
    return MedicalService(repo)

@router.get("/obras-sociales-mensual")
async def get_os_mensual(medico_id: UUID, service: MedicalService = Depends(get_service)):
    try:
        return await service.get_reporte_os_mensual(medico_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/obras-sociales-diario")
async def get_os_diario(medico_id: UUID, mes: str, service: MedicalService = Depends(get_service)):
    try:
        return await service.get_reporte_os_diario(medico_id, mes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
