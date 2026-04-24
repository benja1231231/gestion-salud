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
      }
    }
    fetchInitialData()
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

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">¡Turno Confirmado!</h2>
          <p className="text-slate-600">
            Tu turno con el/la Dr/Dra {medicoInfo?.apellido} ha sido reservado para el día <strong>{new Date(selectedDate).toLocaleDateString()}</strong> a las <strong>{selectedTime} hs</strong>.
          </p>
          <div className="pt-4">
            <p className="text-xs text-slate-400">Puedes cerrar esta ventana.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="max-w-xl w-full space-y-8 mt-12">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Reservar Turno Online</h1>
          <p className="text-slate-500">Dr/Dra {medicoInfo?.nombre} {medicoInfo?.apellido}</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleCheckDni} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Ingresa tu DNI</label>
                <input 
                  type="text" 
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl text-lg font-medium transition-all outline-none"
                  placeholder="Ej: 12345678"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Verificando..." : "Continuar"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <button type="button" onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-4">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Completar Registro</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nombre</label>
                  <input name="nombre" type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Apellido</label>
                  <input name="apellido" type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Fecha de Nacimiento</label>
                <input name="fecha_nacimiento" type="date" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label>
                  <input name="telefono" type="tel" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                  <input name="email" type="email" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Obra Social</label>
                  <select name="obra_social_id" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" required defaultValue="">
                    <option value="" disabled>Seleccionar...</option>
                    {obrasSociales.map(os => (
                      <option key={os.id} value={os.id}>{os.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nro Afiliado</label>
                  <input name="nro_afiliado" type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg mt-4 shadow-lg shadow-primary/20 hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Registrando..." : "Registrar y Continuar"}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{paciente.nombre} {paciente.apellido}</h3>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Paciente</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" /> Selecciona el Día
                  </label>
                  <input 
                    type="date" 
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // No hoy
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 ring-primary/20"
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                {selectedDate && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Selecciona la Hora
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map(slot => (
                        <button
                          key={slot.hora}
                          disabled={!slot.disponible}
                          onClick={() => setSelectedTime(slot.hora)}
                          className={`p-3 rounded-xl text-sm font-bold transition-all ${
                            selectedTime === slot.hora 
                              ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                              : slot.disponible 
                                ? 'bg-slate-50 text-slate-600 hover:bg-slate-100' 
                                : 'bg-slate-50 text-slate-300 cursor-not-allowed line-through'
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
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg mt-6 shadow-lg shadow-primary/20 hover:opacity-90 transition disabled:opacity-50"
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
