"use client"

import { useState, useEffect } from "react";
import WaitingRoom from "@/components/WaitingRoom";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon, Users, ClipboardList, Settings, Plus, Search, Filter, History, FileText, Download, LogOut, X, Trash2, Clock } from "lucide-react";

import { QRCodeSVG } from "qrcode.react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Agenda");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"paciente" | "turno" | "evolucion" | "detalle_turno" | "editar_paciente" | "editar_turno" | "obra_social" | "editar_obra_social">("turno");
  const [selectedTurno, setSelectedTurno] = useState<any>(null);
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [evoluciones, setEvoluciones] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [medicoId, setMedicoId] = useState<string | null>(null);
  const [medicoConfig, setMedicoConfig] = useState<any>(null);
  const [medicoInfo, setMedicoInfo] = useState<{
    matricula: string, 
    especialidad: string, 
    matricula_especialidad?: string,
    telefono_consultorio?: string,
    direccion_consultorio?: string,
    firma_url?: string
  }>({matricula: "", especialidad: ""});
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getMedicoData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMedicoId(user.id);
        
        // Intentar obtener el perfil
        let { data: medico, error } = await supabase
          .from("medicos")
          .select("*")
          .eq("id", user.id)
          .single();

        // Auto-healing: Si no existe el perfil, lo creamos
        if (error && error.code === 'PGRST116') {
          const { data: newMedico, error: createError } = await supabase
            .from("medicos")
            .insert([{
              id: user.id,
              nombre: user.user_metadata?.nombre || "Nuevo",
              apellido: user.user_metadata?.apellido || "Médico",
              matricula: user.user_metadata?.matricula || "PENDIENTE",
              especialidad: user.user_metadata?.especialidad || "General"
            }])
            .select()
            .single();
          
          if (!createError) medico = newMedico;
        }

        if (medico) {
          setMedicoConfig(medico.config_agenda);
          setMedicoInfo({
            matricula: medico.matricula,
            especialidad: medico.especialidad,
            matricula_especialidad: medico.matricula_especialidad,
            telefono_consultorio: medico.telefono_consultorio,
            direccion_consultorio: medico.direccion_consultorio,
            firma_url: medico.firma_url
          });
        }
      }
    };
    getMedicoData();
  }, []);

  const handleUpdateConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!medicoId) return;
    const formData = new FormData(e.currentTarget);
    
    // Manejar firma si se subió una
    let firma_url = medicoInfo.firma_url;
    const firmaFile = formData.get("firma_file") as File;
    if (firmaFile && firmaFile.size > 0) {
      const fileExt = firmaFile.name.split('.').pop();
      const fileName = `${medicoId}_firma.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('firmas')
        .upload(fileName, firmaFile, { upsert: true });
      
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('firmas').getPublicUrl(fileName);
        firma_url = publicUrl;
      }
    }

    // Obtener días seleccionados
    const dias_laborales = [1, 2, 3, 4, 5, 6, 0].filter(d => formData.get(`dia_${d}`) === "on");

    const newConfig = {
      inicio: formData.get("inicio"),
      fin: formData.get("fin"),
      duracion_turno: parseInt(formData.get("duracion_turno") as string),
      dias_laborales
    };

    const updatedData = {
      config_agenda: newConfig,
      matricula: formData.get("matricula"),
      especialidad: formData.get("especialidad"),
      matricula_especialidad: formData.get("matricula_especialidad"),
      telefono_consultorio: formData.get("telefono_consultorio"),
      direccion_consultorio: formData.get("direccion_consultorio"),
      firma_url
    };

    const { error } = await supabase
      .from("medicos")
      .update(updatedData)
      .eq("id", medicoId);

    if (!error) {
      setMedicoConfig(newConfig);
      setMedicoInfo({
        matricula: updatedData.matricula as string,
        especialidad: updatedData.especialidad as string,
        matricula_especialidad: updatedData.matricula_especialidad as string,
        telefono_consultorio: updatedData.telefono_consultorio as string,
        direccion_consultorio: updatedData.direccion_consultorio as string,
        firma_url
      });
      alert("Configuración actualizada");
    } else {
      alert("Error al actualizar: " + error.message);
    }
  };

  const handleDeleteFirma = async () => {
    if (!medicoId || !medicoInfo.firma_url) return;
    if (!confirm("¿Estás seguro de que deseas eliminar tu firma digital?")) return;

    // 1. Obtener el nombre del archivo de la URL
    const urlParts = medicoInfo.firma_url.split('/');
    const fileName = urlParts[urlParts.length - 1];

    // 2. Borrar de Storage
    const { error: storageError } = await supabase.storage
      .from('firmas')
      .remove([fileName]);

    if (storageError) {
      alert("Error al borrar archivo de firma: " + storageError.message);
      return;
    }

    // 3. Borrar de la tabla medicos
    const { error: dbError } = await supabase
      .from("medicos")
      .update({ firma_url: null })
      .eq("id", medicoId);

    if (!dbError) {
      setMedicoInfo(prev => ({ ...prev, firma_url: undefined }));
      alert("Firma eliminada correctamente");
    } else {
      alert("Error al actualizar perfil: " + dbError.message);
    }
  };

  // Cargar pacientes desde Supabase
  const fetchPacientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pacientes")
      .select("*, obras_sociales(nombre)")
      .order("created_at", { ascending: false });
    
    if (data) setPacientes(data);
    setLoading(false);
  };

  // Cargar turnos desde Supabase
  const fetchTurnos = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();

    const { data, error } = await supabase
      .from("turnos")
      .select("*, pacientes(nombre, apellido)")
      .gte("fecha_hora", startOfMonth)
      .lte("fecha_hora", endOfMonth);
    
    if (data) setTurnos(data);
  };

  // Cargar evoluciones del paciente seleccionado
  const fetchEvoluciones = async (pacienteId: string) => {
    const { data, error } = await supabase
      .from("evoluciones")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });
    
    if (data) setEvoluciones(data);
  };

  // Cargar obras sociales
  const [obrasSociales, setObrasSociales] = useState<any[]>([]);

  const fetchObrasSociales = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from("obras_sociales")
      .select("*")
      .eq("medico_id", user.id)
      .order("nombre");
    if (data) setObrasSociales(data);
  };

  useEffect(() => {
    fetchPacientes();
    fetchTurnos();
    fetchObrasSociales();
  }, [currentDate]);

  useEffect(() => {
    if (selectedPaciente) {
      fetchEvoluciones(selectedPaciente.id);
    }
  }, [selectedPaciente]);

  const handleCreateTurno = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fecha = formData.get("fecha") as string;
    const hora = formData.get("hora") as string;
    const fecha_hora = new Date(`${fecha}T${hora}`).toISOString();
    const medico_id = (await supabase.auth.getUser()).data.user?.id;

    const newTurno = {
      medico_id,
      paciente_id: formData.get("paciente_id"),
      fecha_hora,
      motivo: formData.get("motivo"),
      estado: "pendiente",
      duracion_minutos: 15
    };

    const { error } = await supabase.from("turnos").insert([newTurno]);
    if (!error) {
      setIsModalOpen(false);
      fetchTurnos();
    } else {
      alert("Error al crear turno: " + error.message);
    }
  };

  const handleCancelTurno = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas cancelar este turno?")) return;

    const { error } = await supabase
      .from("turnos")
      .update({ estado: 'cancelado' })
      .eq('id', id);

    if (!error) {
      setIsModalOpen(false);
      fetchTurnos();
    } else {
      alert("Error al cancelar turno: " + error.message);
    }
  };


  const handleCreatePaciente = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const medico_id = (await supabase.auth.getUser()).data.user?.id;
    const newPaciente = {
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      fecha_nacimiento: formData.get("fecha_nacimiento"),
      telefono: formData.get("telefono"),
      email: formData.get("email") || null,
      obra_social_id: formData.get("obra_social_id") || null,
      nro_afiliado: formData.get("nro_afiliado") || null,
      medico_creador_id: medico_id
    };

    const { error } = await supabase.from("pacientes").insert([newPaciente]);
    if (!error) {
      setIsModalOpen(false);
      fetchPacientes();
    } else {
      alert("Error al crear paciente: " + error.message);
    }
  };

  const handleUpdatePaciente = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPaciente) return;
    const formData = new FormData(e.currentTarget);
    const updatedPaciente = {
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      fecha_nacimiento: formData.get("fecha_nacimiento"),
      telefono: formData.get("telefono"),
      email: formData.get("email") || null,
      obra_social_id: formData.get("obra_social_id") || null,
      nro_afiliado: formData.get("nro_afiliado") || null,
    };

    const { error } = await supabase
      .from("pacientes")
      .update(updatedPaciente)
      .eq("id", selectedPaciente.id);

    if (!error) {
      setIsModalOpen(false);
      fetchPacientes();
    } else {
      alert("Error al actualizar paciente: " + error.message);
    }
  };

  const handleDeletePaciente = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este paciente? Esta acción eliminará también sus turnos y evoluciones.")) return;

    const { error } = await supabase
      .from("pacientes")
      .delete()
      .eq("id", id);

    if (!error) {
      if (selectedPaciente?.id === id) setSelectedPaciente(null);
      fetchPacientes();
      fetchTurnos(); // Los turnos se borran por cascada en DB
    } else {
      alert("Error al eliminar paciente: " + error.message);
    }
  };

  const handleUpdateTurno = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTurno) return;
    const formData = new FormData(e.currentTarget);
    const fecha = formData.get("fecha") as string;
    const hora = formData.get("hora") as string;
    const fecha_hora = new Date(`${fecha}T${hora}`).toISOString();

    const updatedTurno = {
      paciente_id: formData.get("paciente_id"),
      fecha_hora,
      motivo: formData.get("motivo"),
    };

    const { error } = await supabase
      .from("turnos")
      .update(updatedTurno)
      .eq("id", selectedTurno.id);

    if (!error) {
      setIsModalOpen(false);
      fetchTurnos();
    } else {
      alert("Error al actualizar turno: " + error.message);
    }
  };

  const handleCreateEvolucion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPaciente) return;

    const formData = new FormData(e.currentTarget);
    const medico_id = (await supabase.auth.getUser()).data.user?.id;
    
    const newEvolucion = {
      paciente_id: selectedPaciente.id,
      medico_id: medico_id,
      contenido: formData.get("contenido"),
      created_at: formData.get("fecha") ? new Date(formData.get("fecha") as string).toISOString() : new Date().toISOString(),
      adjuntos: []
    };

    const { error } = await supabase.from("evoluciones").insert([newEvolucion]);
    if (!error) {
      setIsModalOpen(false);
      fetchEvoluciones(selectedPaciente.id);
    } else {
      alert("Error al guardar evolución: " + error.message);
    }
  };

  const handleCreateOS = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newOS = {
      nombre: formData.get("nombre"),
      codigo_nacional: formData.get("codigo_nacional") || null,
      medico_id: user.id
    };

    const { error } = await supabase.from("obras_sociales").insert([newOS]);
    if (!error) {
      setIsModalOpen(false);
      fetchObrasSociales();
    } else {
      alert("Error al crear Obra Social: " + error.message);
    }
  };

  const handleUpdateOS = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedOS) return;
    const formData = new FormData(e.currentTarget);
    const updatedOS = {
      nombre: formData.get("nombre"),
      codigo_nacional: formData.get("codigo_nacional") || null,
    };

    const { error } = await supabase
      .from("obras_sociales")
      .update(updatedOS)
      .eq("id", selectedOS.id);

    if (!error) {
      setIsModalOpen(false);
      fetchObrasSociales();
    } else {
      alert("Error al actualizar Obra Social: " + error.message);
    }
  };

  const handleDeleteOS = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta Obra Social? Los pacientes que la utilicen quedarán sin cobertura asignada.")) return;

    const { error } = await supabase
      .from("obras_sociales")
      .delete()
      .eq("id", id);

    if (!error) {
      fetchObrasSociales();
      fetchPacientes(); // Para actualizar visualización de S/D
    } else {
      alert("Error al eliminar Obra Social: " + error.message);
    }
  };

  const changeMonth = (offset: number) => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(nextDate);
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return "N/A";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    // Ajustar para que lunes sea 0, domingo sea 6
    return day === 0 ? 6 : day - 1;
  };

  const filteredPacientes = pacientes.filter(p => 
    `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const menuItems = [
    { icon: CalendarIcon, label: "Agenda" },
    { icon: Users, label: "Pacientes" },
    { icon: ClipboardList, label: "Historias Clínicas" },
    { icon: Settings, label: "Configuración" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleOpenModal = (type: "paciente" | "turno" | "evolucion" | "editar_paciente" | "editar_turno" | "obra_social" | "editar_obra_social") => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "Agenda":
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        // Array de 42 celdas (6 semanas) para cubrir cualquier mes
        const calendarDays = Array.from({ length: 42 }, (_, i) => {
          const dayNum = i - firstDay + 1;
          return dayNum > 0 && dayNum <= daysInMonth ? dayNum : null;
        });

        return (
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-900 capitalize">
                      {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                      <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 text-xs font-semibold bg-white border-r border-slate-200 hover:bg-slate-50 transition-colors">&lt;</button>
                      <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 transition-colors">Hoy</button>
                      <button onClick={() => changeMonth(1)} className="px-3 py-1.5 text-xs font-semibold bg-white border-l border-slate-200 hover:bg-slate-50 transition-colors">&gt;</button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 grid grid-cols-7 border-t border-l border-slate-100 mt-4 rounded-lg overflow-hidden shadow-inner">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                    <div key={day} className="p-3 text-center border-b border-r border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{day}</div>
                  ))}
                  {calendarDays.map((day, i) => {
                    const dayTurnos = day ? turnos.filter(t => {
                      const tDate = new Date(t.fecha_hora);
                      return tDate.getDate() === day && tDate.getMonth() === month && tDate.getFullYear() === year;
                    }) : [];
                    
                    return (
                      <div 
                        key={i} 
                        className={`aspect-square p-2 border-b border-r border-slate-100 transition-colors relative group ${day ? 'hover:bg-slate-50/50 cursor-pointer' : 'bg-slate-50/20'}`}
                      >
                        {day && (
                          <>
                            <span className={`text-xs font-medium transition-colors ${
                              day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
                              ? 'text-primary bg-primary/10 w-6 h-6 flex items-center justify-center rounded-full font-bold' 
                              : 'text-slate-400 group-hover:text-primary'
                            }`}>
                              {day}
                            </span>
                            <div className="mt-1 space-y-1 overflow-y-auto max-h-[80%] scrollbar-hide">
                              {dayTurnos.filter(t => t.estado !== 'cancelado').map(t => (
                                <div 
                                  key={t.id} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTurno(t);
                                    setModalType("detalle_turno");
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 bg-primary/10 border-l-2 border-primary rounded text-[9px] font-bold text-primary truncate shadow-sm hover:bg-primary/20 transition-colors"
                                  title={`${new Date(t.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${t.pacientes?.nombre}`}
                                >
                                  {new Date(t.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {t.pacientes?.nombre}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 space-y-8">
              <WaitingRoom 
                turnos={turnos} 
                onUpdate={fetchTurnos} 
                onVerHC={(p) => {
                  setSelectedPaciente(p);
                  setActiveTab("Historias Clínicas");
                }}
              />
            </div>
          </div>
        );
      case "Pacientes":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Buscar por DNI o Nombre..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 ring-primary/20" />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
                <Filter className="w-4 h-4" /> Filtros
              </button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Paciente</th>
                    <th className="px-6 py-4">DNI / Edad</th>
                    <th className="px-6 py-4">Contacto</th>
                    <th className="px-6 py-4">Obra Social</th>
                    <th className="px-6 py-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-4 text-center text-slate-400">Cargando...</td></tr>
                  ) : filteredPacientes.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-4 text-center text-slate-400">No hay pacientes registrados.</td></tr>
                  ) : filteredPacientes.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {p.nombre} {p.apellido}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900">{p.dni}</div>
                        <div className="text-xs text-slate-500">{calculateAge(p.fecha_nacimiento)} años</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900">{p.telefono || 'Sin tel'}</div>
                        <div className="text-xs text-slate-500">{p.email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {p.obras_sociales?.nombre || 'S/D'}
                        {p.nro_afiliado && <div className="text-[10px] font-bold text-slate-400 mt-1"># {p.nro_afiliado}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              setSelectedPaciente(p);
                              setActiveTab("Historias Clínicas");
                            }} 
                            className="text-primary font-bold hover:underline"
                          >
                            Ver HC
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedPaciente(p);
                              handleOpenModal("editar_paciente");
                            }} 
                            className="text-slate-400 font-bold hover:text-slate-600"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDeletePaciente(p.id)} 
                            className="text-red-400 font-bold hover:text-red-600"
                            title="Eliminar Paciente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "Historias Clínicas":
        return (
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar paciente..." 
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredPacientes.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => setSelectedPaciente(p)}
                      className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${selectedPaciente?.id === p.id ? 'bg-primary/5 border border-primary/20 shadow-sm' : 'hover:bg-slate-50'}`}
                    >
                      <p className="font-bold text-slate-900">{p.nombre} {p.apellido}</p>
                      <p className="text-xs text-slate-500 mt-0.5">DNI: {p.dni}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {selectedPaciente ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedPaciente.nombre} {selectedPaciente.apellido}</h2>
                      <div className="flex gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> DNI: {selectedPaciente.dni} ({calculateAge(selectedPaciente.fecha_nacimiento)} años)</span>
                        <span className="flex items-center gap-1">
                          <History className="w-3 h-3" /> 
                          {selectedPaciente.obras_sociales?.nombre || 'Sin Obra Social'} 
                          {selectedPaciente.nro_afiliado && ` - # ${selectedPaciente.nro_afiliado}`}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">Tel: {selectedPaciente.telefono || 'N/A'}</span>
                        <span className="flex items-center gap-1">Email: {selectedPaciente.email || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition" title="Descargar Historia Completa">
                        <Download className="w-4 h-4 text-slate-600" />
                      </button>
                      <button onClick={() => handleOpenModal("evolucion")} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Nueva Evolución
                      </button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {evoluciones.length === 0 ? (
                      <p className="text-center text-slate-400 py-10">No hay evoluciones registradas para este paciente.</p>
                    ) : evoluciones.map(e => (
                      <div key={e.id} className="relative pl-8 border-l-2 border-slate-100 pb-8 last:pb-0">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-primary"></div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button 
                            onClick={async () => {
                              try {
                                 const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                                 const res = await fetch(`${apiUrl}/api/v1/historia-clinica/receta/${e.id}`);
                                 if (!res.ok) throw new Error("Error al generar PDF");
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `receta_${selectedPaciente.nombre}_${new Date(e.created_at).toLocaleDateString()}.pdf`;
                                a.click();
                                window.URL.revokeObjectURL(url);
                              } catch (err) {
                                alert("Error: No se pudo conectar con el servidor de recetas.");
                                console.error(err);
                              }
                            }}
                            className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"
                          >
                            <FileText className="w-3 h-3" /> Descargar Receta
                          </button>
                        </div>
                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {e.contenido}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-2xl border border-dashed border-slate-300">
                  <Users className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900">Selecciona un paciente</h3>
                  <p className="text-sm text-slate-500 mt-1">Busca y selecciona un paciente para ver su historia clínica.</p>
                </div>
              )}
            </div>
          </div>
        );
      case "Configuración":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Configuración de Horarios */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Configuración de Agenda</h2>
                  <p className="text-sm text-slate-500">Define tus horarios y días de atención.</p>
                </div>
              </div>

              <form onSubmit={handleUpdateConfig} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Matrícula Profesional</label>
                    <input name="matricula" type="text" defaultValue={medicoInfo.matricula} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" placeholder="M.N. 12345" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Especialidad</label>
                    <input name="especialidad" type="text" defaultValue={medicoInfo.especialidad} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" placeholder="Cardiología" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Matrícula de Especialidad (M.E.)</label>
                    <input name="matricula_especialidad" type="text" defaultValue={medicoInfo.matricula_especialidad} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" placeholder="M.E. 67890" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Teléfono de Consultorio</label>
                    <input name="telefono_consultorio" type="tel" defaultValue={medicoInfo.telefono_consultorio} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" placeholder="+54 11 1234-5678" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Dirección del Establecimiento</label>
                  <input name="direccion_consultorio" type="text" defaultValue={medicoInfo.direccion_consultorio} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" placeholder="Av. Principal 123, Ciudad" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Firma Digital (Imagen)</label>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    {medicoInfo.firma_url ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative group">
                          <img src={medicoInfo.firma_url} alt="Firma" className="h-16 object-contain bg-white rounded p-1 border border-slate-200" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                            <p className="text-[10px] text-white font-bold">Actual</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={handleDeleteFirma}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-white rounded border border-slate-200 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input name="firma_file" type="file" accept="image/*" className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                      <p className="text-[10px] text-slate-400 mt-1">Sube una imagen PNG/JPG de tu firma. Para cambiarla, simplemente sube una nueva.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Hora de Inicio</label>
                    <input name="inicio" type="time" defaultValue={medicoConfig?.inicio || "08:00"} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Hora de Fin</label>
                    <input name="fin" type="time" defaultValue={medicoConfig?.fin || "20:00"} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Duración por Turno (minutos)</label>
                  <select name="duracion_turno" defaultValue={medicoConfig?.duracion_turno || 15} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm">
                    {[10, 15, 20, 30, 40, 60].map(m => (
                      <option key={m} value={m}>{m} minutos</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase">Días de Atención</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: 1, l: 'Lunes' }, { v: 2, l: 'Martes' }, { v: 3, l: 'Miércoles' }, 
                      { v: 4, l: 'Jueves' }, { v: 5, l: 'Viernes' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' }
                    ].map(dia => (
                      <label key={dia.v} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          name={`dia_${dia.v}`} 
                          defaultChecked={medicoConfig?.dias_laborales?.includes(dia.v)}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-slate-700">{dia.l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition">
                  Guardar Configuración de Agenda
                </button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Turnero Online</h2>
                  <p className="text-sm text-slate-500">Comparte este link con tus pacientes para que reserven solos.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  {medicoId && (
                    <QRCodeSVG 
                      value={`${window.location.origin}/reservar/${medicoId}`} 
                      size={160}
                      level="H"
                      includeMargin={true}
                    />
                  )}
                </div>
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">Link de Reserva</p>
                    <p className="text-sm font-mono bg-white p-3 rounded-lg border border-slate-200 break-all">
                      {medicoId ? `${window.location.origin}/reservar/${medicoId}` : "Cargando..."}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      if (medicoId) {
                        navigator.clipboard.writeText(`${window.location.origin}/reservar/${medicoId}`);
                        alert("Link copiado al portapapeles");
                      }
                    }}
                    className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition w-full md:w-auto"
                  >
                    Copiar Link
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800">Gestionar Obras Sociales</h3>
                  <button 
                    onClick={() => handleOpenModal("obra_social")}
                    className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Nueva OS
                  </button>
                </div>
                <div className="space-y-2">
                  {obrasSociales.map(os => (
                    <div key={os.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      <div>
                        <p className="text-sm font-bold text-slate-700">{os.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{os.codigo_nacional || "Sin código"}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setSelectedOS(os);
                            handleOpenModal("editar_obra_social");
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteOS(os.id)}
                          className="p-1.5 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4">Instrucciones</h3>
                <ul className="text-sm text-slate-600 space-y-3">
                  <li className="flex gap-2">
                    <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                    Imprime el código QR y colócalo en tu consultorio.
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                    El paciente escanea, ingresa su DNI y elige fecha/hora.
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                    El turno aparece automáticamente en tu agenda.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <aside className="w-64 border-r border-slate-200 bg-white p-6 space-y-8 fixed h-full">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">GestionSalud</span>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.label 
                  ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pt-8 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-800">{activeTab}</h1>
          <div className="flex items-center gap-4">
            {activeTab === "Agenda" && (
              <button onClick={() => handleOpenModal("turno")} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-1px] transition-all active:translate-y-[0]">
                <Plus className="w-4 h-4" />
                Nuevo Turno
              </button>
            )}
            {activeTab === "Pacientes" && (
              <button onClick={() => handleOpenModal("paciente")} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-1px] transition-all active:translate-y-[0]">
                <Plus className="w-4 h-4" />
                Nuevo Paciente
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300"></div>
          </div>
        </header>

        <div className="p-8">
          {renderContent()}
        </div>
      </main>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={
          modalType === "paciente" ? "Registrar Nuevo Paciente" : 
          modalType === "editar_paciente" ? "Editar Paciente" :
          modalType === "turno" ? "Programar Nuevo Turno" : 
          modalType === "editar_turno" ? "Editar Turno" :
          modalType === "detalle_turno" ? "Detalles del Turno" :
          modalType === "obra_social" ? "Nueva Obra Social" :
          modalType === "editar_obra_social" ? "Editar Obra Social" :
          "Nueva Evolución Médica"
        }
      >
        {modalType === "detalle_turno" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{selectedTurno?.pacientes?.nombre} {selectedTurno?.pacientes?.apellido}</h3>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Paciente</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Fecha</p>
                <p className="text-sm font-medium text-slate-700">{selectedTurno && new Date(selectedTurno.fecha_hora).toLocaleDateString()}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Hora</p>
                <p className="text-sm font-medium text-slate-700">{selectedTurno && new Date(selectedTurno.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Motivo de Consulta</p>
              <p className="text-sm text-slate-700">{selectedTurno?.motivo || "Sin motivo especificado"}</p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => handleCancelTurno(selectedTurno.id)}
                className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button 
                onClick={() => handleOpenModal("editar_turno")}
                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Editar
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={
            modalType === "paciente" ? handleCreatePaciente : 
            modalType === "editar_paciente" ? handleUpdatePaciente :
            modalType === "turno" ? handleCreateTurno : 
            modalType === "editar_turno" ? handleUpdateTurno :
            modalType === "obra_social" ? handleCreateOS :
            modalType === "editar_obra_social" ? handleUpdateOS :
            handleCreateEvolucion
          }>
          {modalType === "paciente" || modalType === "editar_paciente" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nombre</label>
                  <input name="nombre" type="text" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.nombre : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Apellido</label>
                  <input name="apellido" type="text" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.apellido : ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">DNI</label>
                  <input name="dni" type="text" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.dni : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fecha de Nacimiento</label>
                  <input name="fecha_nacimiento" type="date" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.fecha_nacimiento : ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label>
                  <input name="telefono" type="tel" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.telefono : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Email (Opcional)</label>
                  <input name="email" type="email" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.email : ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Obra Social</label>
                  <select name="obra_social_id" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.obra_social_id : ""} required>
                    <option value="" disabled>Seleccionar...</option>
                    {obrasSociales.map(os => (
                      <option key={os.id} value={os.id}>{os.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nro Afiliado</label>
                  <input name="nro_afiliado" type="text" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.nro_afiliado : ""} />
                </div>
              </div>
            </>
          ) : modalType === "turno" || modalType === "editar_turno" ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Paciente</label>
                <select name="paciente_id" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_turno" ? selectedTurno?.paciente_id : ""} required>
                  <option value="">Seleccionar paciente...</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} {p.apellido} ({p.dni})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                  <input name="fecha" type="date" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_turno" ? new Date(selectedTurno?.fecha_hora).toISOString().split('T')[0] : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Hora</label>
                  <input name="hora" type="time" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_turno" ? new Date(selectedTurno?.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ""} required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Motivo</label>
                <textarea name="motivo" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" rows={3} defaultValue={modalType === "editar_turno" ? selectedTurno?.motivo : ""}></textarea>
              </div>
            </>
          ) : modalType === "obra_social" || modalType === "editar_obra_social" ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Nombre de la Obra Social</label>
                <input name="nombre" type="text" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_obra_social" ? selectedOS?.nombre : ""} placeholder="Ej: OSDE" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Código Nacional (Opcional)</label>
                <input name="codigo_nacional" type="text" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={modalType === "editar_obra_social" ? selectedOS?.codigo_nacional : ""} placeholder="Ej: 400302" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Paciente</label>
                <p className="text-sm font-bold text-slate-900">{selectedPaciente?.nombre} {selectedPaciente?.apellido}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Fecha de Evolución</label>
                <input name="fecha" type="date" className="w-full p-2 bg-slate-50 border-none rounded-lg text-sm" defaultValue={new Date().toISOString().split('T')[0]} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Contenido de la Evolución</label>
                <textarea 
                  name="contenido"
                  className="w-full p-3 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 ring-primary/20" 
                  rows={8} 
                  placeholder="Escribe aquí el desarrollo de la consulta..."
                  required
                ></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Adjuntos (Opcional)</label>
                <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" multiple />
              </div>
            </>
          )}
          <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold mt-4 shadow-lg shadow-primary/20 hover:opacity-90 transition">
            {modalType === "paciente" ? "Guardar Paciente" : 
             modalType === "editar_paciente" ? "Actualizar Paciente" :
             modalType === "turno" ? "Confirmar Turno" : 
             modalType === "editar_turno" ? "Actualizar Turno" :
             modalType === "obra_social" ? "Crear Obra Social" :
             modalType === "editar_obra_social" ? "Actualizar Obra Social" :
             "Guardar Evolución"}
          </button>
        </form>
      )}
      </Modal>
    </div>
  );
}



