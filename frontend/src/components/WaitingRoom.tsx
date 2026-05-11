"use client"

import { Clock, User, CheckCircle2, PlayCircle, LogIn, UserX } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useState, useEffect } from "react"

export type EstadoTurno = "pendiente" | "llegó" | "en_espera" | "en_consultorio" | "finalizado" | "cancelado" | "ausente"

interface WaitingRoomProps {
  turnos: any[]
  onUpdate: () => void
  onVerHC: (pacienteId: string) => void
}

export default function WaitingRoom({ turnos, onUpdate, onVerHC }: WaitingRoomProps) {
  const supabase = createClient()
  const [now, setNow] = useState(new Date())

  // Actualizar el tiempo cada segundo para el minutero
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const cambiarEstado = async (id: string, nuevoEstado: EstadoTurno) => {
    const updateData: any = { estado: nuevoEstado }
    
    // Si se marca "llegó", guardamos la hora actual
    if (nuevoEstado === "llegó") {
      updateData.hora_llegada = new Date().toISOString()
    }

    const { error } = await supabase
      .from("turnos")
      .update(updateData)
      .eq("id", id)
    
    if (!error) {
      onUpdate()
    }
  }

  // Función para calcular y formatear el tiempo transcurrido
  const formatearTiempoTranscurrido = (horaLlegada: string) => {
    const inicio = new Date(horaLlegada)
    const diff = now.getTime() - inicio.getTime()
    const minutos = Math.floor(diff / 60000)
    const segundos = Math.floor((diff % 60000) / 1000)
    return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
  }

  // Solo mostrar turnos de hoy que no estén cancelados ni finalizados
  const turnosActivos = turnos
    .filter(t => {
      const hoy = new Date().toLocaleDateString()
      const fechaTurno = new Date(t.fecha_hora).toLocaleDateString()
      return hoy === fechaTurno && t.estado !== "cancelado" && t.estado !== "finalizado" && t.estado !== "ausente"
    })
    .sort((a, b) => {
      // Ordenar por tiempo de espera (más largo primero) si tienen hora_llegada
      if (a.hora_llegada && b.hora_llegada) {
        return new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime()
      }
      // Si uno no tiene hora_llegada, ordenar por fecha_hora
      if (a.hora_llegada) return -1
      if (b.hora_llegada) return 1
      return new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
    })

  return (
    <div className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
      <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#7a7a7a]" />
          Sala de Espera Hoy
        </h2>
        <span className="text-[12px] font-medium bg-[#f5f5f7] text-[#7a7a7a] px-3 py-1 rounded-full">
          {turnosActivos.length} Pacientes
        </span>
      </div>
      
      <div className="divide-y divide-[#e0e0e0] max-h-[600px] overflow-y-auto">
        {turnosActivos.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-8 h-8 text-[#d2d2d7] mx-auto mb-2" />
            <p className="text-[12px] text-[#7a7a7a]">No hay pacientes para hoy</p>
          </div>
        ) : turnosActivos.map((t) => (
          <div key={t.id} className="p-4 hover:bg-[#f5f5f7] transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.estado === 'en_consultorio' ? 'bg-[#f5f5f7]' : 'bg-[#f5f5f7]'}`}>
                  <User className={`w-5 h-5 ${t.estado === 'en_consultorio' ? 'text-[#0066cc]' : 'text-[#7a7a7a]'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[17px] font-medium text-[#1d1d1f] tracking-tight leading-none">{t.pacientes?.nombre} {t.pacientes?.apellido}</h3>
                    {/* Minutero: mostrar solo si tiene hora_llegada y estado no es pendiente ni en_consultorio */}
                    {t.hora_llegada && t.estado !== "pendiente" && t.estado !== "en_consultorio" && (
                      <span className="text-[12px] font-mono text-[#0066cc] bg-[#0066cc]/10 px-2 py-0.5 rounded-full">
                        {formatearTiempoTranscurrido(t.hora_llegada)}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#7a7a7a] mt-1">
                    {new Date(t.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs • {t.motivo || "Consulta"}
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-medium text-[#7a7a7a] px-3 py-1 rounded-full bg-[#f5f5f7]">
                {t.estado.replace("_", " ")}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {t.estado === "pendiente" && (
                <>
                  <button 
                    onClick={() => cambiarEstado(t.id, "llegó")}
                    className="flex-[2] text-[14px] py-2 rounded-full bg-[#0066cc] text-white hover:opacity-90 font-medium transition"
                  >
                    <LogIn className="w-4 h-4 inline mr-1" />
                    Marcar Llegada
                  </button>
                  <button 
                    onClick={() => cambiarEstado(t.id, "ausente")}
                    className="flex-1 text-[14px] py-2 rounded-full bg-[#f5f5f7] text-[#7a7a7a] hover:bg-[#e0e0e0] font-medium transition flex items-center justify-center gap-1"
                    title="Marcar como ausente"
                  >
                    <UserX className="w-4 h-4" />
                    Ausente
                  </button>
                </>
              )}
              {t.estado === "llegó" && (
                <button 
                  onClick={() => cambiarEstado(t.id, "en_espera")}
                  className="flex-1 text-[14px] py-2 rounded-full bg-[#0066cc] text-white hover:opacity-90 font-medium transition"
                >
                  Pasar a Espera
                </button>
              )}
              {t.estado === "en_espera" && (
                <button 
                  onClick={() => {
                    cambiarEstado(t.id, "en_consultorio");
                    onVerHC(t.paciente_id);
                  }}
                  className="flex-1 text-[14px] py-2 rounded-full bg-[#0066cc] text-white hover:opacity-90 font-medium transition"
                >
                  <PlayCircle className="w-4 h-4 inline mr-1" />
                  Llamar y Ver HC
                </button>
              )}
              {t.estado === "en_consultorio" && (
                <button 
                  onClick={() => cambiarEstado(t.id, "finalizado")}
                  className="flex-1 text-[14px] py-2 rounded-full bg-[#0066cc] text-white hover:opacity-90 font-medium transition"
                >
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Finalizar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
