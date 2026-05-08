"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Calendar as CalendarIcon, Clock, User, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase"

export default function ReservarTurno() {
  const { medicoId } = useParams()
  const [step, setStep] = useState(1) // 1: DNI, 2: Registro (if needed), 3: Fecha/Hora
  const [dni, setDni] = useState("")
  const [paciente, setPaciente] = useState<any>(null)
  const [medicoInfo, setMedicoInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [obrasSociales, setObrasSociales] = useState<any[]>([])
  
  // Datos para reserva
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")

  const API_URL = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/public`
  const supabase = createClient()

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingInitial(true)
      try {
        const res = await fetch(`${API_URL}/medico/${medicoId}`)
        if (res.ok) setMedicoInfo(await res.json())
        
        const { data } = await supabase
          .from("obras_sociales")
          .select("*")
          .eq("medico_id", medicoId)
          .order("nombre")
        if (data) setObrasSociales(data)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Error al cargar los datos del médico.")
      } finally {
        setLoadingInitial(false)
      }
    }
    if (medicoId) {
      fetchInitialData()
    }
  }, [medicoId])

  const [availableSlots, setAvailableSlots] = useState<any[]>([])

  useEffect(() => {
    if (selectedDate) {
      const fetchSlots = async () => {
        setLoading(true)
        try {
          const res = await fetch(`${API_URL}/disponibilidad/${medicoId}?fecha=${selectedDate}`)
          if (res.ok) setAvailableSlots(await res.json())
        } catch (err) {
          console.error("Error fetching slots:", err)
        } finally {
          setLoading(false)
        }
      }
      fetchSlots()
    }
  }, [selectedDate, medicoId])

  const handleCheckDni = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_URL}/paciente/${dni}?medico_id=${medicoId}`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setPaciente(data)
          setStep(3) // Ir a agenda
        } else {
          setStep(2) // Ir a registro
        }
      }
    } catch (err) {
      setError("Error al verificar DNI. Intente nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    const newPaciente = {
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: dni,
      fecha_nacimiento: formData.get("fecha_nacimiento"),
      telefono: formData.get("telefono"),
      email: formData.get("email") || null,
      obra_social_id: formData.get("obra_social_id") || null,
      nro_afiliado: formData.get("nro_afiliado") || null,
      medico_creador_id: medicoId
    }

    try {
      const res = await fetch(`${API_URL}/paciente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPaciente)
      })
      if (res.ok) {
        const data = await res.json()
        setPaciente(data)
        setStep(3)
      } else {
        const errData = await res.json()
        setError(errData.detail || "Error al registrar paciente")
      }
    } catch (err) {
      setError("Error de conexión con el servidor.")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmTurno = async () => {
    if (!selectedDate || !selectedTime) return
    setLoading(true)
    setError("")

    const fechaHora = new Date(`${selectedDate}T${selectedTime}`).toISOString()
    const newTurno = {
      medico_id: medicoId,
      paciente_id: paciente.id,
      fecha_hora: fechaHora,
      motivo: "Reserva Online",
      duracion_minutos: 15,
      es_sobreturno: false
    }

    try {
      const res = await fetch(`${API_URL}/turno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTurno)
      })
      if (res.ok) {
        setSuccess(true)
      } else {
        const errData = await res.json()
        setError(errData.detail || "Error al agendar turno")
      }
    } catch (err) {
      setError("Error al confirmar el turno.")
    } finally {
      setLoading(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#e0e0e0] border-t-[#0066cc] rounded-full animate-spin mx-auto"></div>
          <p className="text-[14px] text-[#7a7a7a]">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!medicoInfo) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg border border-[#e0e0e0] max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-[#ff6666] mx-auto" />
          <h2 className="text-[21px] font-semibold text-[#1d1d1f]">Médico no encontrado</h2>
          <p className="text-[14px] text-[#7a7a7a]">El link de reserva no es válido. Por favor, verifica el enlace.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg border border-[#e0e0e0] max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-[#0066cc]" />
          </div>
          <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">¡Turno Confirmado!</h2>
          <p className="text-[14px] text-[#7a7a7a]">
            Tu turno con el/la Dr/Dra {medicoInfo?.apellido} ha sido reservado para el día <strong>{new Date(selectedDate).toLocaleDateString()}</strong> a las <strong>{selectedTime} hs</strong>.
          </p>
          <div className="pt-4">
            <p className="text-[12px] text-[#7a7a7a]">Puedes cerrar esta ventana.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 flex flex-col items-center">
      <div className="max-w-xl w-full space-y-8 mt-12">
        <div className="text-center space-y-2">
          <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight">Reservar Turno Online</h1>
          <p className="text-[14px] text-[#7a7a7a]">Dr/Dra {medicoInfo?.nombre} {medicoInfo?.apellido}</p>
        </div>

        <div className="bg-white p-8 rounded-lg border border-[#e0e0e0]">
          {error && (
            <div className="mb-6 p-4 bg-[#f5f5f7] border border-[#e0e0e0] rounded-lg flex items-center gap-3 text-[#1d1d1f] text-[14px]">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleCheckDni} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider">Ingresa tu DNI</label>
                <input 
                  type="text" 
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full p-4 bg-[#f5f5f7] border-none rounded-full text-[17px] font-medium transition-all outline-none focus:ring-2 focus:ring-[#0066cc]"
                  placeholder="Ej: 12345678"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#0066cc] text-white py-4 rounded-full font-medium text-[17px] hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Verificando..." : "Continuar"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <button type="button" onClick={() => setStep(1)} className="text-[#7a7a7a] hover:text-[#1d1d1f] flex items-center gap-1 text-[14px] mb-4">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <h3 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight mb-4">Completar Registro</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Nombre</label>
                  <input name="nombre" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Apellido</label>
                  <input name="apellido" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Fecha de Nacimiento</label>
                <input name="fecha_nacimiento" type="date" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Teléfono</label>
                  <input name="telefono" type="tel" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Email</label>
                  <input name="email" type="email" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Obra Social</label>
                  <select name="obra_social_id" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required defaultValue="">
                    <option value="" disabled>Seleccionar...</option>
                    {obrasSociales.map(os => (
                      <option key={os.id} value={os.id}>{os.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Nro Afiliado</label>
                  <input name="nro_afiliado" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#0066cc] text-white py-4 rounded-full font-medium text-[17px] mt-4 hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Registrando..." : "Registrar y Continuar"}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-lg border border-[#e0e0e0]">
                <div className="w-12 h-12 bg-[#0066cc]/10 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-[#0066cc]" />
                </div>
                <div>
                  <h3 className="text-[17px] font-medium text-[#1d1d1f]">{paciente.nombre} {paciente.apellido}</h3>
                  <p className="text-[12px] text-[#7a7a7a] uppercase font-medium tracking-wider">Paciente</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" /> Selecciona el Día
                  </label>
                  <input 
                    type="date" 
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // No hoy
                    className="w-full p-4 bg-[#f5f5f7] border-none rounded-full outline-none focus:ring-2 focus:ring-[#0066cc] text-[14px]"
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                {selectedDate && (
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Selecciona la Hora
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map(slot => (
                        <button
                          key={slot.hora}
                          disabled={!slot.disponible}
                          onClick={() => setSelectedTime(slot.hora)}
                          className={`p-3 rounded-full text-[14px] font-medium transition-all ${
                            selectedTime === slot.hora 
                              ? 'bg-[#0066cc] text-white' 
                              : slot.disponible 
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e0e0e0]' 
                                : 'bg-[#f5f5f7] text-[#d2d2d7] cursor-not-allowed line-through'
                          }`}
                        >
                          {slot.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleConfirmTurno}
                  disabled={!selectedDate || !selectedTime || loading}
                  className="w-full bg-[#0066cc] text-white py-4 rounded-full font-medium text-[17px] mt-6 hover:opacity-90 transition disabled:opacity-50"
                >
                  {loading ? "Confirmando..." : "Confirmar Turno"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
