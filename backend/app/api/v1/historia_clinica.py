from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List
from uuid import UUID
from app.models.medical import EvolucionCreate, Evolucion
from app.services.medical_service import MedicalService
from app.repositories.medical_repo import MedicalRepository
from app.core.supabase import get_supabase
from app.services.pdf_service import PDFService

router = APIRouter()

def get_service():
    client = get_supabase()
    repo = MedicalRepository(client)
    return MedicalService(repo)

@router.get("/{paciente_id}", response_model=List[Evolucion])
async def obtener_historia_clinica(paciente_id: UUID, service: MedicalService = Depends(get_service)):
    return await service.buscar_historia_clinica(paciente_id)

@router.post("/evolucion", response_model=Evolucion)
async def agregar_evolucion(evolucion: EvolucionCreate, service: MedicalService = Depends(get_service)):
    try:
        return await service.registrar_evolucion(evolucion)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/receta/{evolucion_id}")
async def descargar_receta(evolucion_id: UUID, service: MedicalService = Depends(get_service)):
    try:
        print(f"DEBUG: Generando receta para evolucion_id: {evolucion_id}")
        # 1. Obtener datos de la evolución, paciente y médico
        client = get_supabase()
        
        # Intentar query con joins
        try:
            evolucion_res = client.table("evoluciones").select("*, pacientes(*), medicos(*)").eq("id", str(evolucion_id)).execute()
        except Exception as query_err:
            print(f"DEBUG: Error en query Supabase: {str(query_err)}")
            raise HTTPException(status_code=500, detail=f"Error en base de datos: {str(query_err)}")

        if not evolucion_res.data:
            print(f"DEBUG: No se encontró evolución con id {evolucion_id}")
            raise HTTPException(status_code=404, detail="Evolución no encontrada")
            
        data = evolucion_res.data[0]
        print(f"DEBUG: Evolucion data: {data}")
        
        # Obtener médico y paciente por ID directo (más seguro)
        medico_res = client.table("medicos").select("*").eq("id", data['medico_id']).execute()
        paciente_res = client.table("pacientes").select("*").eq("id", data['paciente_id']).execute()
        
        medico = medico_res.data[0] if medico_res.data else None
        paciente = paciente_res.data[0] if paciente_res.data else None
        
        if not medico or not paciente:
            print(f"DEBUG: Falló recuperación. Medico: {bool(medico)}, Paciente: {bool(paciente)}")
            raise HTTPException(status_code=404, detail=f"No se encontró el médico ({data['medico_id']}) o el paciente ({data['paciente_id']}) vinculado a esta evolución")
            
        medico_nombre = f"{medico.get('nombre', 'Médico')} {medico.get('apellido', '')}"
        matricula = medico.get('matricula', 'S/M')
        firma_url = medico.get('firma_url')
        print(f"DEBUG: Firma URL encontrada en DB: {firma_url}")
        paciente_nombre = f"{paciente.get('nombre', 'Paciente')} {paciente.get('apellido', '')}"
        contenido = data.get('contenido', '')

        # 2. Generar PDF
        print(f"DEBUG: Iniciando generación de PDF para {paciente_nombre}")
        pdf_service = PDFService()
        pdf_buffer = pdf_service.generar_receta(medico_nombre, matricula, paciente_nombre, contenido, firma_url)
        
        print("DEBUG: PDF generado exitosamente")
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=receta_{paciente_nombre.replace(' ', '_')}.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        import traceback
        print(f"ERROR GENERANDO RECETA: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
