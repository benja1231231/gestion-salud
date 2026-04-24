"use client"

import { Clock, User, CheckCircle2, PlayCircle, LogIn } from "lucide-react"
import { createClient } from "@/lib/supabase"

export type EstadoTurno = "pendiente" | "llegó" | "en_espera" | "en_consultorio" | "finalizado" | "cancelado"

interface WaitingRoomProps {
  turnos: any[]
  onUpdate: () => void
}

export default function WaitingRoom({ turnos, onUpdate }: WaitingRoomProps) {
  const supabase = createClient()

  const cambiarEstado = async (id: string, nuevoEstado: EstadoTurno) => {
    const { error } = await supabase
      .from("turnos")
      .update({ estado: nuevoEstado })
      .eq("id", id)
    
    if (!error) {
      onUpdate()
    }
  }

  const getStatusColor = (estado: EstadoTurno) => {
    switch (estado) {
      case "en_espera": return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "llegó": return "bg-blue-100 text-blue-700 border-blue-200"
      case "en_consultorio": return "bg-purple-100 text-purple-700 border-purple-200"
      case "finalizado": return "bg-green-100 text-green-700 border-green-200"
      case "pendiente": return "bg-slate-100 text-slate-600 border-slate-200"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  // Solo mostrar turnos de hoy que no estén cancelados ni finalizados
  const turnosActivos = turnos
    .filter(t => {
      const hoy = new Date().toLocaleDateString()
      const fechaTurno = new Date(t.fecha_hora).toLocaleDateString()
      return hoy === fechaTurno && t.estado !== "cancelado" && t.estado !== "finalizado"
    })
    .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Sala de Espera Hoy
        </h2>
        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
          {turnosActivos.length} Pacientes
        </span>
      </div>
      
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {turnosActivos.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No hay pacientes para hoy</p>
          </div>
        ) : turnosActivos.map((t) => (
          <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.estado === 'en_consultorio' ? 'bg-purple-100 animate-pulse' : 'bg-slate-100'}`}>
                  <User className={`w-5 h-5 ${t.estado === 'en_consultorio' ? 'text-purple-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 leading-none">{t.pacientes?.nombre} {t.pacientes?.apellido}</h3>
                  <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider">
                    {new Date(t.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs • {t.motivo || "Consulta"}
                  </p>
                </div>
              </div>
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getStatusColor(t.estado)}`}>
                {t.estado.replace("_", " ")}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-3">
              {t.estado === "pendiente" && (
                <button 
                  onClick={() => cambiarEstado(t.id, "llegó")}
                  className="flex-1 text-[11px] py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 font-bold flex items-center justify-center gap-1 transition shadow-sm shadow-blue-200"
                >
                  <LogIn className="w-3 h-3" />
                  Marcar Llegada
                </button>
              )}
              {t.estado === "llegó" && (
                <button 
                  onClick={() => cambiarEstado(t.id, "en_espera")}
                  className="flex-1 text-[11px] py-1.5 rounded bg-yellow-500 text-white hover:bg-yellow-600 font-bold transition shadow-sm shadow-yellow-200"
                >
                  Pasar a Espera
                </button>
              )}
              {t.estado === "en_espera" && (
                <button 
                  onClick={() => cambiarEstado(t.id, "en_consultorio")}
                  className="flex-1 text-[11px] py-1.5 rounded bg-primary text-white hover:opacity-90 font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-primary/20"
                >
                  <PlayCircle className="w-3 h-3" />
                  Llamar
                </button>
              )}
              {t.estado === "en_consultorio" && (
                <button 
                  onClick={() => cambiarEstado(t.id, "finalizado")}
                  className="flex-1 text-[11px] py-1.5 rounded bg-green-600 text-white hover:bg-green-700 font-bold flex items-center justify-center gap-1 transition"
                >
                  <CheckCircle2 className="w-3 h-3" />
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
