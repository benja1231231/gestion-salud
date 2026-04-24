from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import agenda, pacientes, historia_clinica, public

import os

app = FastAPI(
    title="GestionSalud API",
    description="Clon de BlipDoc - Sistema de gestión de salud robusto",
    version="1.0.0"
)

# CORS
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas
app.include_router(agenda.router, prefix="/api/v1/agenda", tags=["Agenda"])
app.include_router(pacientes.router, prefix="/api/v1/pacientes", tags=["Pacientes"])
app.include_router(historia_clinica.router, prefix="/api/v1/historia-clinica", tags=["Historia Clínica"])
app.include_router(public.router, prefix="/api/v1/public", tags=["Public"])

@app.get("/")
async def root():
    return {"message": "GestionSalud API Running", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
