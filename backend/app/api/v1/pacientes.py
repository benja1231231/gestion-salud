from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.models.medical import PacienteCreate, Paciente
from app.services.medical_service import MedicalService
from app.repositories.medical_repo import MedicalRepository
from app.core.supabase import get_supabase

router = APIRouter()

def get_service():
    client = get_supabase()
    repo = MedicalRepository(client)
    return MedicalService(repo)

@router.post("/", response_model=Paciente)
async def crear_paciente(paciente: PacienteCreate, service: MedicalService = Depends(get_service)):
    try:
        return await service.registrar_paciente(paciente)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[Paciente])
async def listar_pacientes(service: MedicalService = Depends(get_service)):
    return await service.listar_pacientes()
