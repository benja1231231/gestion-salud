"use client"

import { useState, useEffect, useRef } from "react";
import WaitingRoom from "@/components/WaitingRoom";
import Modal from "@/components/Modal";
import ReportesTab from "@/components/Reportes";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon, Users, ClipboardList, Settings, Plus, Search, Filter, History, FileText, Download, LogOut, X, Trash2, Clock, BarChart3 } from "lucide-react";

import { QRCodeSVG } from "qrcode.react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Agenda");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"paciente" | "turno" | "evolucion" | "detalle_turno" | "editar_paciente" | "editar_turno" | "obra_social" | "editar_obra_social" | "bloqueos" | "filtros" | "vista_diaria" | "unificar_pacientes">("turno");
  const [selectedPacientePrincipal, setSelectedPacientePrincipal] = useState<any>(null);
  const [pacientesABorrar, setPacientesABorrar] = useState<string[]>([]);
  const [busquedaUnificar, setBusquedaUnificar] = useState("");
  const [selectedDateForVistaDiaria, setSelectedDateForVistaDiaria] = useState<string | null>(null);
  const [filtroObraSocial, setFiltroObraSocial] = useState<string | null>(null);
  const [selectedTurno, setSelectedTurno] = useState<any>(null);
  const [selectedDateForBloqueo, setSelectedDateForBloqueo] = useState<string | null>(null);
  const [bloqueoTipo, setBloqueoTipo] = useState<"parcial" | "feriado">("parcial");
  const [bloqueos, setBloqueos] = useState<any[]>([]);
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacienteSearchQuery, setPacienteSearchQuery] = useState("");
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);
  const [selectedPacienteForTurno, setSelectedPacienteForTurno] = useState<any>(null);
  const pacienteDropdownRef = useRef<HTMLDivElement>(null);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [evoluciones, setEvoluciones] = useState<any[]>([]);
  const [creatingRecetaFor, setCreatingRecetaFor] = useState<string | null>(null);
  const [recetaContent, setRecetaContent] = useState<string>("");
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
    firma_url?: string,
    plan?: "freemium" | "premium",
    suscripcion_activa?: boolean
  }>({matricula: "", especialidad: ""});
  const supabase = createClient();
  const router = useRouter();

  // Función para verificar si puede crear un paciente
  const canCreatePaciente = () => {
    if (medicoInfo.plan === "premium") return true;
    return pacientes.length < 50; // Límite freemium
  };

  const handleUpgrade = async () => {
    const mensaje = `Hola! Quiero mejorar mi plan a Premium en GestionSalud. Mi ID de médico es: ${medicoId}`;
    const whatsappUrl = `https://wa.me/5493572612061?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

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
              especialidad: user.user_metadata?.especialidad || "General",
              plan: "freemium"
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
            firma_url: medico.firma_url,
            plan: medico.plan,
            suscripcion_activa: medico.suscripcion_activa
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
      .select("*, paciente_id, pacientes(nombre, apellido)")
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

  const handleCreateBloqueo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tipo = formData.get("tipo") as "parcial" | "feriado";
    
    const newBloqueo = {
      medico_id: medicoId,
      fecha: selectedDateForBloqueo,
      tipo,
      hora_inicio: tipo === "parcial" ? formData.get("hora_inicio") : null,
      hora_fin: tipo === "parcial" ? formData.get("hora_fin") : null
    };

    const { error } = await supabase.from("bloqueos_agenda").insert([newBloqueo]);
    if (!error) {
      setIsModalOpen(false);
      fetchBloqueos();
    } else {
      alert("Error al crear bloqueo: " + error.message);
    }
  };

  const handleDeleteBloqueo = async (id: string) => {
    const { error } = await supabase.from("bloqueos_agenda").delete().eq("id", id);
    if (!error) {
      fetchBloqueos();
    }
  };

  const fetchBloqueos = async () => {
    if (!medicoId) return;
    const { data } = await supabase
      .from("bloqueos_agenda")
      .select("*")
      .eq("medico_id", medicoId);
    if (data) setBloqueos(data);
  };

  useEffect(() => {
    if (medicoId) {
      fetchPacientes();
      fetchTurnos();
      fetchObrasSociales();
      fetchBloqueos();
    }
  }, [currentDate, medicoId]);

  useEffect(() => {
    if (selectedPaciente) {
      fetchEvoluciones(selectedPaciente.id);
    }
  }, [selectedPaciente]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pacienteDropdownRef.current && !pacienteDropdownRef.current.contains(event.target as Node)) {
        setShowPacienteDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCreateTurno = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPacienteForTurno) {
      alert("Por favor selecciona un paciente");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const fecha = formData.get("fecha") as string;
    const hora = formData.get("hora") as string;
    const fecha_hora = new Date(`${fecha}T${hora}`).toISOString();
    const medico_id = (await supabase.auth.getUser()).data.user?.id;

    const newTurno = {
      medico_id,
      paciente_id: selectedPacienteForTurno.id,
      fecha_hora,
      motivo: formData.get("motivo"),
      estado: "pendiente",
      duracion_minutos: 15
    };

    const { error } = await supabase.from("turnos").insert([newTurno]);
    if (!error) {
      setIsModalOpen(false);
      setSelectedPacienteForTurno(null);
      setPacienteSearchQuery("");
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
    if (!selectedPacienteForTurno) {
      alert("Por favor selecciona un paciente");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const fecha = formData.get("fecha") as string;
    const hora = formData.get("hora") as string;
    const fecha_hora = new Date(`${fecha}T${hora}`).toISOString();

    const updatedTurno = {
      paciente_id: selectedPacienteForTurno.id,
      fecha_hora,
      motivo: formData.get("motivo"),
    };

    const { error } = await supabase
      .from("turnos")
      .update(updatedTurno)
      .eq("id", selectedTurno.id);

    if (!error) {
      setIsModalOpen(false);
      setSelectedPacienteForTurno(null);
      setPacienteSearchQuery("");
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

  const handleUnificarPacientes = async () => {
    if (!selectedPacientePrincipal) {
      alert("Por favor selecciona un paciente principal");
      return;
    }
    if (pacientesABorrar.length === 0) {
      alert("Por favor selecciona al menos un paciente para unificar");
      return;
    }
    if (!confirm(`¿Estás seguro de unificar ${pacientesABorrar.length} paciente(s) en ${selectedPacientePrincipal.nombre} ${selectedPacientePrincipal.apellido}? Esta acción no se puede deshacer.`)) return;

    setLoading(true);
    try {
      // 1. Reasignar turnos
      for (const pacienteId of pacientesABorrar) {
        await supabase
          .from("turnos")
          .update({ paciente_id: selectedPacientePrincipal.id })
          .eq("paciente_id", pacienteId);
      }

      // 2. Reasignar evoluciones
      for (const pacienteId of pacientesABorrar) {
        await supabase
          .from("evoluciones")
          .update({ paciente_id: selectedPacientePrincipal.id })
          .eq("paciente_id", pacienteId);
      }

      // 3. Borrar los pacientes
      for (const pacienteId of pacientesABorrar) {
        await supabase
          .from("pacientes")
          .delete()
          .eq("id", pacienteId);
      }

      // 4. Actualizar lista y cerrar modal
      await fetchPacientes();
      setIsModalOpen(false);
      setSelectedPacientePrincipal(null);
      setPacientesABorrar([]);
      setBusquedaUnificar("");
      alert("Unificación completada correctamente");
    } catch (error: any) {
      alert("Error al unificar pacientes: " + error.message);
    } finally {
      setLoading(false);
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

  const getAvailableHours = () => {
    if (!medicoConfig) return [];
    const [h_inicio, m_inicio] = medicoConfig.inicio.split(":").map(Number);
    const [h_fin, m_fin] = medicoConfig.fin.split(":").map(Number);
    const duracion = medicoConfig.duracion_turno;

    const hours = [];
    let current = new Date();
    current.setHours(h_inicio, m_inicio, 0, 0);
    const end = new Date();
    end.setHours(h_fin, m_fin, 0, 0);

    while (current <= end) {
      hours.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      current.setMinutes(current.getMinutes() + duracion);
    }
    return hours;
  };

  const filteredPacientes = pacientes.filter(p => {
    const matchSearch = `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchObraSocial = filtroObraSocial ? p.obra_social_id === filtroObraSocial : true;
    return matchSearch && matchObraSocial;
  });

  const filteredPacientesForTurno = pacientes.filter(p => {
    const query = pacienteSearchQuery.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(query) ||
      p.apellido.toLowerCase().includes(query) ||
      p.dni.toLowerCase().includes(query)
    );
  });


  const menuItems = [
    { icon: CalendarIcon, label: "Agenda" },
    { icon: Users, label: "Pacientes" },
    { icon: ClipboardList, label: "Historias Clínicas" },
    { icon: BarChart3, label: "Reportes" },
    { icon: Settings, label: "Configuración" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleOpenModal = (type: "paciente" | "turno" | "evolucion" | "detalle_turno" | "editar_paciente" | "editar_turno" | "obra_social" | "editar_obra_social" | "bloqueos" | "filtros" | "unificar_pacientes") => {
    setModalType(type);
    setIsModalOpen(true);
    if (type === "turno") {
      setPacienteSearchQuery("");
      setSelectedPacienteForTurno(null);
    } else if (type === "editar_turno" && selectedTurno) {
      const paciente = pacientes.find(p => p.id === selectedTurno.paciente_id);
      setSelectedPacienteForTurno(paciente || null);
      setPacienteSearchQuery(paciente ? `${paciente.nombre} ${paciente.apellido}` : "");
    }
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
              <div className="bg-white p-6 rounded-lg border border-[#e0e0e0] min-h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight capitalize">
                      {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex border border-[#e0e0e0] rounded-full overflow-hidden">
                      <button onClick={() => changeMonth(-1)} className="px-4 py-2 text-[14px] font-medium bg-white border-r border-[#e0e0e0] hover:bg-[#f5f5f7] transition-colors">&lt;</button>
                      <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-[14px] font-medium bg-white hover:bg-[#f5f5f7] transition-colors">Hoy</button>
                      <button onClick={() => changeMonth(1)} className="px-4 py-2 text-[14px] font-medium bg-white border-l border-[#e0e0e0] hover:bg-[#f5f5f7] transition-colors">&gt;</button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 grid grid-cols-7 border-t border-l border-[#e0e0e0] mt-4 rounded-lg overflow-hidden">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                    <div key={day} className="p-3 text-center border-b border-r border-[#e0e0e0] bg-[#f5f5f7] text-[12px] font-medium text-[#7a7a7a] uppercase">{day}</div>
                  ))}
                  {calendarDays.map((day, i) => {
                    const dayTurnos = day ? turnos.filter(t => {
                      const tDate = new Date(t.fecha_hora);
                      return tDate.getDate() === day && tDate.getMonth() === month && tDate.getFullYear() === year;
                    }) : [];
                    
                    const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    const isFeriado = bloqueos.some(b => b.fecha === dateStr && b.tipo === 'feriado');
                    const hasBloqueos = bloqueos.some(b => b.fecha === dateStr && b.tipo === 'parcial');
                    
                    return (
                      <div 
                        key={i} 
                        onClick={() => {
                          if (!day) return;
                          setSelectedDateForVistaDiaria(dateStr);
                          setModalType("vista_diaria");
                          setIsModalOpen(true);
                        }}
                        onContextMenu={(e) => {
                          if (!day) return;
                          e.preventDefault();
                          setSelectedDateForBloqueo(dateStr);
                          handleOpenModal("bloqueos");
                        }}
                        className={`aspect-square p-2 border-b border-r border-[#e0e0e0] transition-colors relative group ${day ? 'hover:bg-[#f5f5f7] cursor-pointer' : 'bg-[#fafafc]'} ${isFeriado ? 'bg-[#fafafc]' : ''}`}
                      >
                        {day && (
                          <>
                            <div className="flex justify-between items-start">
                              <span className={`text-[14px] font-medium transition-colors ${
                                day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
                                ? 'text-white bg-[#0066cc] w-6 h-6 flex items-center justify-center rounded-full' 
                                : 'text-[#7a7a7a] group-hover:text-[#1d1d1f]'
                              }`}>
                                {day}
                              </span>
                              {isFeriado && <div className="text-[10px] bg-[#f5f5f7] text-[#7a7a7a] px-2 rounded-full font-medium">Feriado</div>}
                              {(hasBloqueos || dayTurnos.filter(t => t.estado !== 'cancelado').length > 0) && !isFeriado && <div className="w-2 h-2 bg-[#0066cc] rounded-full"></div>}
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
                onVerHC={(pacienteId) => {
                  const pacienteCompleto = pacientes.find(p => p.id === pacienteId);
                  if (pacienteCompleto) {
                    setSelectedPaciente(pacienteCompleto);
                    setActiveTab("Historias Clínicas");
                  }
                }}
              />
            </div>
          </div>
        );
      case "Pacientes":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#e0e0e0]">
              <div className="relative w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                <input 
                  type="text" 
                  placeholder="Buscar por DNI o Nombre..." 
                  className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleOpenModal("filtros")}
                  className="flex items-center gap-2 px-5 py-2.5 border border-[#e0e0e0] rounded-full text-[14px] font-medium hover:bg-[#f5f5f7] transition"
                >
                  <Filter className="w-4 h-4" /> Filtros
                  {filtroObraSocial && <span className="bg-[#0066cc] text-white text-[12px] px-2.5 py-0.5 rounded-full">1</span>}
                </button>
                <button 
                  onClick={() => {
                    if (!canCreatePaciente()) {
                      alert("Has alcanzado el límite de 50 pacientes del plan Freemium. Mejora a Premium para continuar.");
                      return;
                    }
                    handleOpenModal("paciente");
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0066cc] text-white rounded-full text-[14px] font-medium hover:opacity-90 transition"
                >
                  <Plus className="w-4 h-4" /> Nuevo Paciente
                </button>
                <button 
                  onClick={() => {
                    setSelectedPacientePrincipal(null);
                    setPacientesABorrar([]);
                    setBusquedaUnificar("");
                    handleOpenModal("unificar_pacientes");
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 border border-[#e0e0e0] rounded-full text-[14px] font-medium hover:bg-[#f5f5f7] transition"
                >
                  <Users className="w-4 h-4" /> Unificar
                </button>
              </div>
            </div>
            {medicoInfo.plan === "freemium" && (
              <div className="bg-[#0066cc]/5 border border-[#0066cc]/20 p-4 rounded-lg flex justify-between items-center">
                <div className="text-[14px] text-[#0066cc]">
                  <span className="font-semibold">Uso del Plan:</span> {pacientes.length} / 50 pacientes registrados.
                </div>
                <button 
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="text-[12px] font-bold bg-[#0066cc] text-white px-4 py-1.5 rounded-full hover:bg-[#0055aa] transition-colors disabled:opacity-50"
                >
                  {loading ? "CARGANDO..." : "MEJORAR A PREMIUM"}
                </button>
              </div>
            )}
            <div className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#f5f5f7] text-[#7a7a7a] font-medium border-b border-[#e0e0e0]">
                  <tr>
                    <th className="px-6 py-4 text-[14px]">Paciente</th>
                    <th className="px-6 py-4 text-[14px]">DNI / Edad</th>
                    <th className="px-6 py-4 text-[14px]">Contacto</th>
                    <th className="px-6 py-4 text-[14px]">Obra Social</th>
                    <th className="px-6 py-4 text-[14px]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-4 text-center text-[#7a7a7a]">Cargando...</td></tr>
                  ) : filteredPacientes.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-4 text-center text-[#7a7a7a]">No hay pacientes registrados.</td></tr>
                  ) : filteredPacientes.map(p => (
                    <tr key={p.id} className="hover:bg-[#f5f5f7] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#1d1d1f] text-[17px]">
                        {p.nombre} {p.apellido}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[#1d1d1f] text-[14px]">{p.dni}</div>
                        <div className="text-[12px] text-[#7a7a7a]">{calculateAge(p.fecha_nacimiento)} años</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[#1d1d1f] text-[14px]">{p.telefono || 'Sin tel'}</div>
                        <div className="text-[12px] text-[#7a7a7a]">{p.email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-[#7a7a7a] text-[14px]">
                        {p.obras_sociales?.nombre || 'S/D'}
                        {p.nro_afiliado && <div className="text-[12px] font-medium text-[#7a7a7a] mt-1"># {p.nro_afiliado}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              setSelectedPaciente(p);
                              setActiveTab("Historias Clínicas");
                            }} 
                            className="text-[#0066cc] font-medium hover:underline text-[14px]"
                          >
                            Ver HC
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedPaciente(p);
                              handleOpenModal("editar_paciente");
                            }} 
                            className="text-[#7a7a7a] font-medium hover:text-[#1d1d1f] text-[14px]"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDeletePaciente(p.id)} 
                            className="text-[#7a7a7a] font-medium hover:text-[#1d1d1f] text-[14px]"
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
              <div className="bg-white p-4 rounded-lg border border-[#e0e0e0]">
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                  <input 
                    type="text" 
                    placeholder="Buscar paciente..." 
                    className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredPacientes.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => setSelectedPaciente(p)}
                      className={`w-full text-left p-4 rounded-lg text-sm transition-colors ${selectedPaciente?.id === p.id ? 'bg-[#0066cc]/10 border border-[#0066cc]/20' : 'hover:bg-[#f5f5f7]'}`}
                    >
                      <p className="font-semibold text-[#1d1d1f] text-[17px]">{p.nombre} {p.apellido}</p>
                      <p className="text-[12px] text-[#7a7a7a] mt-0.5">DNI: {p.dni}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {selectedPaciente ? (
                <div className="bg-white p-6 rounded-lg border border-[#e0e0e0]">
                  <div className="flex justify-between items-start mb-6 border-b border-[#e0e0e0] pb-6">
                    <div>
                      <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">{selectedPaciente.nombre} {selectedPaciente.apellido}</h2>
                      <div className="flex gap-4 mt-2 text-[14px] text-[#7a7a7a]">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> DNI: {selectedPaciente.dni} ({calculateAge(selectedPaciente.fecha_nacimiento)} años)</span>
                        <span className="flex items-center gap-1">
                          <History className="w-3 h-3" /> 
                          {selectedPaciente.obras_sociales?.nombre || 'Sin Obra Social'} 
                          {selectedPaciente.nro_afiliado && ` - # ${selectedPaciente.nro_afiliado}`}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-1 text-[14px] text-[#7a7a7a]">
                        <span className="flex items-center gap-1">Tel: {selectedPaciente.telefono || 'N/A'}</span>
                        <span className="flex items-center gap-1">Email: {selectedPaciente.email || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 border border-[#e0e0e0] rounded-full hover:bg-[#f5f5f7] transition" title="Descargar Historia Completa">
                        <Download className="w-4 h-4 text-[#7a7a7a]" />
                      </button>
                      <button onClick={() => handleOpenModal("evolucion")} className="bg-[#0066cc] text-white px-5 py-2.5 rounded-full text-[14px] font-medium flex items-center gap-2 hover:opacity-90">
                        <Plus className="w-4 h-4" /> Nueva Evolución
                      </button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {evoluciones.length === 0 ? (
                      <p className="text-center text-[#7a7a7a] py-10 text-[14px]">No hay evoluciones registradas para este paciente.</p>
                    ) : evoluciones.map(e => (
                      <div key={e.id} className="relative pl-8 border-l-2 border-[#e0e0e0] pb-8 last:pb-0">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-[#0066cc]"></div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[12px] font-medium text-[#7a7a7a] uppercase">
                            {new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {creatingRecetaFor === e.id ? (
                            <div className="flex flex-col gap-2 w-full mt-2 bg-white p-4 rounded-lg border border-[#0066cc]/20">
                              <label className="text-[12px] font-medium text-[#0066cc] uppercase">Contenido de la Receta</label>
                              <textarea
                                className="w-full p-3 bg-[#f5f5f7] border-none rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                                placeholder="Escribe la receta aquí..."
                                value={recetaContent}
                                onChange={(ev) => setRecetaContent(ev.target.value)}
                                rows={4}
                              />
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => setCreatingRecetaFor(null)}
                                  className="text-[14px] text-[#7a7a7a] font-medium hover:underline"
                                >
                                  Cancelar
                                </button>
                                <button 
                                  onClick={async () => {
                                    try {
                                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                                      const res = await fetch(`${apiUrl}/api/v1/historia-clinica/receta/${e.id}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ contenido: recetaContent })
                                      });
                                      if (!res.ok) throw new Error("Error al generar PDF");
                                      const blob = await res.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `receta_${selectedPaciente.nombre}_${new Date(e.created_at).toLocaleDateString()}.pdf`;
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                      setCreatingRecetaFor(null);
                                    } catch (err) {
                                      alert("Error: No se pudo conectar con el servidor de recetas.");
                                      console.error(err);
                                    }
                                  }}
                                  className="bg-[#0066cc] text-white px-4 py-2 rounded-full text-[14px] font-medium flex items-center gap-1 hover:opacity-90 transition"
                                >
                                  <Download className="w-4 h-4" /> Descargar PDF
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setCreatingRecetaFor(e.id);
                                setRecetaContent(e.contenido);
                              }}
                              className="text-[14px] text-[#0066cc] font-medium flex items-center gap-1 hover:underline"
                            >
                              <FileText className="w-4 h-4" /> Crear nueva receta
                            </button>
                          )}
                        </div>
                        <div className="bg-[#f5f5f7] p-4 rounded-lg border border-[#e0e0e0]">
                          <p className="text-[17px] text-[#1d1d1f] leading-relaxed">
                            {e.contenido}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-lg border border-dashed border-[#e0e0e0]">
                  <Users className="w-12 h-12 text-[#d2d2d7] mb-4" />
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Selecciona un paciente</h3>
                  <p className="text-[14px] text-[#7a7a7a] mt-1">Busca y selecciona un paciente para ver su historia clínica.</p>
                </div>
              )}
            </div>
          </div>
        );
      case "Reportes":
        return <ReportesTab medicoId={medicoId || ""} />;
      case "Configuración":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Configuración de Horarios */}
            <div className="bg-white p-8 rounded-lg border border-[#e0e0e0] space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[#0066cc]/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-[#0066cc]" />
                </div>
                <div>
                  <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">Configuración de Agenda</h2>
                  <p className="text-[14px] text-[#7a7a7a]">Define tus horarios y días de atención.</p>
                </div>
              </div>

              <form onSubmit={handleUpdateConfig} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Matrícula Profesional</label>
                    <input name="matricula" type="text" defaultValue={medicoInfo.matricula} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" placeholder="M.N. 12345" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Especialidad</label>
                    <input name="especialidad" type="text" defaultValue={medicoInfo.especialidad} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" placeholder="Cardiología" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Matrícula de Especialidad (M.E.)</label>
                    <input name="matricula_especialidad" type="text" defaultValue={medicoInfo.matricula_especialidad} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" placeholder="M.E. 67890" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Teléfono de Consultorio</label>
                    <input name="telefono_consultorio" type="tel" defaultValue={medicoInfo.telefono_consultorio} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" placeholder="+54 11 1234-5678" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Dirección del Establecimiento</label>
                  <input name="direccion_consultorio" type="text" defaultValue={medicoInfo.direccion_consultorio} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" placeholder="Av. Principal 123, Ciudad" />
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Firma Digital (Imagen)</label>
                  <div className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-lg border border-dashed border-[#e0e0e0]">
                    {medicoInfo.firma_url ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative group">
                          <img src={medicoInfo.firma_url} alt="Firma" className="h-16 object-contain bg-white rounded p-1 border border-[#e0e0e0]" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                            <p className="text-[10px] text-white font-medium">Actual</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={handleDeleteFirma}
                          className="text-[10px] font-medium text-[#7a7a7a] hover:text-[#1d1d1f] flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-white rounded border border-[#e0e0e0] flex items-center justify-center">
                        <Plus className="w-6 h-6 text-[#d2d2d7]" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input name="firma_file" type="file" accept="image/*" className="text-[12px] text-[#7a7a7a] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[12px] file:font-medium file:bg-[#0066cc]/10 file:text-[#0066cc] hover:file:bg-[#0066cc]/20" />
                      <p className="text-[10px] text-[#7a7a7a] mt-1">Sube una imagen PNG/JPG de tu firma. Para cambiarla, simplemente sube una nueva.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Hora de Inicio</label>
                    <input name="inicio" type="time" defaultValue={medicoConfig?.inicio || "08:00"} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Hora de Fin</label>
                    <input name="fin" type="time" defaultValue={medicoConfig?.fin || "20:00"} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Duración por Turno (minutos)</label>
                  <select name="duracion_turno" defaultValue={medicoConfig?.duracion_turno || 15} className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]">
                    {[10, 15, 20, 30, 40, 60].map(m => (
                      <option key={m} value={m}>{m} minutos</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Días de Atención</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: 1, l: 'Lunes' }, { v: 2, l: 'Martes' }, { v: 3, l: 'Miércoles' }, 
                      { v: 4, l: 'Jueves' }, { v: 5, l: 'Viernes' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' }
                    ].map(dia => (
                      <label key={dia.v} className="flex items-center gap-2 bg-[#f5f5f7] px-4 py-2 rounded-full cursor-pointer hover:bg-[#e0e0e0] transition-colors">
                        <input 
                          type="checkbox" 
                          name={`dia_${dia.v}`} 
                          defaultChecked={medicoConfig?.dias_laborales?.includes(dia.v)}
                          className="w-4 h-4 rounded border-[#e0e0e0] text-[#0066cc] focus:ring-[#0066cc]"
                        />
                        <span className="text-[14px] font-medium text-[#1d1d1f]">{dia.l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full bg-[#0066cc] text-white py-3.5 rounded-full font-medium hover:opacity-90 transition">
                  Guardar Configuración de Agenda
                </button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-lg border border-[#e0e0e0] space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[#0066cc]/10 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-[#0066cc]" />
                </div>
                <div>
                  <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">Turnero Online</h2>
                  <p className="text-[14px] text-[#7a7a7a]">Comparte este link con tus pacientes para que reserven solos.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center bg-[#f5f5f7] p-6 rounded-lg border border-[#e0e0e0]">
                <div className="bg-white p-4 rounded-lg border border-[#e0e0e0]">
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
                    <p className="text-[12px] font-medium text-[#7a7a7a] uppercase">Link de Reserva</p>
                    <p className="text-[14px] font-mono bg-white p-3 rounded-lg border border-[#e0e0e0] break-all">
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
                    className="bg-[#0066cc] text-white px-6 py-2.5 rounded-full font-medium text-[14px] hover:opacity-90 transition w-full md:w-auto"
                  >
                    Copiar Link
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-[#e0e0e0]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Gestionar Obras Sociales</h3>
                  <button 
                    onClick={() => handleOpenModal("obra_social")}
                    className="text-[12px] bg-[#f5f5f7] text-[#7a7a7a] px-3 py-1.5 rounded-full font-medium hover:bg-[#e0e0e0] transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Nueva OS
                  </button>
                </div>
                <div className="space-y-2">
                  {obrasSociales.map(os => (
                    <div key={os.id} className="flex justify-between items-center p-3 bg-[#f5f5f7] rounded-lg border border-[#e0e0e0] group">
                      <div>
                        <p className="text-[14px] font-medium text-[#1d1d1f]">{os.nombre}</p>
                        <p className="text-[10px] text-[#7a7a7a] font-medium uppercase tracking-wider">{os.codigo_nacional || "Sin código"}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setSelectedOS(os);
                            handleOpenModal("editar_obra_social");
                          }}
                          className="p-1.5 text-[#7a7a7a] hover:text-[#1d1d1f]"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteOS(os.id)}
                          className="p-1.5 text-[#7a7a7a] hover:text-[#1d1d1f]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-[#e0e0e0]">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-4">Instrucciones</h3>
                <ul className="text-[14px] text-[#7a7a7a] space-y-3">
                  <li className="flex gap-2">
                    <span className="w-5 h-5 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[10px] font-medium shrink-0">1</span>
                    Imprime el código QR y colócalo en tu consultorio.
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[10px] font-medium shrink-0">2</span>
                    El paciente escanea, ingresa su DNI y elige fecha/hora.
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[10px] font-medium shrink-0">3</span>
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
    <div className="flex min-h-screen bg-[#f5f5f7]">
      <aside className="w-64 border-r border-[#e0e0e0] bg-white p-6 space-y-8 fixed h-full">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-[#0066cc] rounded-lg flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">GestionSalud</span>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[14px] font-medium transition-all ${
                activeTab === item.label 
                  ? "bg-[#0066cc] text-white" 
                  : "text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pt-8 border-t border-[#e0e0e0]">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[14px] font-medium text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <header className="h-[52px] border-b border-[#e0e0e0] bg-[#f5f5f7]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">{activeTab}</h1>
          <div className="flex items-center gap-4">
            {activeTab === "Agenda" && (
              <button onClick={() => handleOpenModal("turno")} className="bg-[#0066cc] text-white px-6 py-2.5 rounded-full text-[14px] font-medium flex items-center gap-2 hover:opacity-90 transition">
                <Plus className="w-4 h-4" />
                Nuevo Turno
              </button>
            )}
            {activeTab === "Pacientes" && (
              <button onClick={() => handleOpenModal("paciente")} className="bg-[#0066cc] text-white px-6 py-2.5 rounded-full text-[14px] font-medium flex items-center gap-2 hover:opacity-90 transition">
                <Plus className="w-4 h-4" />
                Nuevo Paciente
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-[#f5f5f7] border border-[#e0e0e0]"></div>
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
          modalType === "bloqueos" ? `Gestionar Bloqueos - ${selectedDateForBloqueo}` :
          modalType === "filtros" ? "Filtros de Pacientes" :
          modalType === "vista_diaria" ? (() => {
            if (!selectedDateForVistaDiaria) return "Agenda del Día";
            const [year, month, day] = selectedDateForVistaDiaria.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          })() :
          modalType === "unificar_pacientes" ? "Unificar Pacientes" :
          "Nueva Evolución Médica"
        }
      >
        {modalType === "unificar_pacientes" ? (
          <div className="space-y-6">
            {/* Paciente Principal */}
            <div className="space-y-4">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">1. Seleccionar Paciente Principal</h3>
              <p className="text-[14px] text-[#7a7a7a]">
                Este paciente conservará todos sus datos (DNI, nombre, obra social, etc.)
              </p>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, apellido o DNI..." 
                  className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  value={busquedaUnificar}
                  onChange={(e) => setBusquedaUnificar(e.target.value)}
                />
              </div>
              <div className="max-h-60 overflow-y-auto border border-[#e0e0e0] rounded-lg">
                {pacientes
                  .filter(p => 
                    `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(busquedaUnificar.toLowerCase())
                  )
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPacientePrincipal(p)}
                      className={`w-full text-left p-3 text-[14px] hover:bg-[#f5f5f7] transition-colors ${selectedPacientePrincipal?.id === p.id ? 'bg-[#0066cc]/10 border-l-4 border-[#0066cc]' : ''}`}
                    >
                      <div className="font-medium text-[#1d1d1f]">
                        {p.nombre} {p.apellido}
                      </div>
                      <div className="text-[12px] text-[#7a7a7a]">
                        DNI: {p.dni}
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Pacientes a Borrar */}
            {selectedPacientePrincipal && (
              <div className="space-y-4 pt-4 border-t border-[#e0e0e0]">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f]">2. Seleccionar Pacientes a Unificar</h3>
                <p className="text-[14px] text-[#7a7a7a]">
                  Los turnos y historias clínicas de estos pacientes se reasignarán al paciente principal, y luego serán eliminados.
                </p>
                <div className="max-h-60 overflow-y-auto border border-[#e0e0e0] rounded-lg">
                  {pacientes
                    .filter(p => p.id !== selectedPacientePrincipal.id)
                    .filter(p => 
                      `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(busquedaUnificar.toLowerCase())
                    )
                    .map(p => (
                      <label key={p.id} className="flex items-center gap-3 p-3 hover:bg-[#f5f5f7] transition-colors cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={pacientesABorrar.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPacientesABorrar([...pacientesABorrar, p.id]);
                            } else {
                              setPacientesABorrar(pacientesABorrar.filter(id => id !== p.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-[#e0e0e0] text-[#0066cc] focus:ring-[#0066cc]"
                        />
                        <div>
                          <div className="font-medium text-[#1d1d1f]">
                            {p.nombre} {p.apellido}
                          </div>
                          <div className="text-[12px] text-[#7a7a7a]">
                            DNI: {p.dni}
                          </div>
                        </div>
                      </label>
                    ))}
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3 pt-4 border-t border-[#e0e0e0]">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-[#f5f5f7] text-[#7a7a7a] py-3 rounded-full font-medium text-[14px] hover:bg-[#e0e0e0] transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleUnificarPacientes}
                disabled={!selectedPacientePrincipal || pacientesABorrar.length === 0 || loading}
                className="flex-1 bg-[#0066cc] text-white py-3 rounded-full font-medium text-[14px] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Unificando..." : `Unificar ${pacientesABorrar.length} Paciente(s)`}
              </button>
            </div>
          </div>
        ) : modalType === "vista_diaria" ? (
          <div className="space-y-4">
            {(() => {
              if (!selectedDateForVistaDiaria || !medicoConfig) return null;
              
              const [year, month, day] = selectedDateForVistaDiaria.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              const isToday = date.toDateString() === new Date().toDateString();
              
              // Generar todos los slots horarios
              const [h_inicio, m_inicio] = medicoConfig.inicio.split(':').map(Number);
              const [h_fin, m_fin] = medicoConfig.fin.split(':').map(Number);
              const duracion = medicoConfig.duracion_turno;
              
              const slots = [];
              let current = new Date(date);
              current.setHours(h_inicio, m_inicio, 0, 0);
              const end = new Date(date);
              end.setHours(h_fin, m_fin, 0, 0);
              
              while (current < end) {
                const slotStart = new Date(current);
                current.setMinutes(current.getMinutes() + duracion);
                const slotEnd = new Date(current);
                slots.push({ start: slotStart, end: slotEnd });
              }
              
              // Obtener turnos y bloqueos para este día
              const dayTurnos = turnos.filter(t => {
                const tDate = new Date(t.fecha_hora);
                return tDate.getFullYear() === year && tDate.getMonth() === month - 1 && tDate.getDate() === day && t.estado !== 'cancelado';
              });
              
              const dayBloqueos = bloqueos.filter(b => b.fecha === selectedDateForVistaDiaria);
              const isFeriado = dayBloqueos.some(b => b.tipo === 'feriado');
              
              return (
                <>
                  <div className="border-b border-[#e0e0e0] pb-4">
                    <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
                      {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {isToday && <span className="ml-2 text-[12px] bg-[#0066cc]/10 text-[#0066cc] px-2 py-0.5 rounded-full font-medium">HOY</span>}
                    </h2>
                    {isFeriado && <p className="text-[14px] text-[#7a7a7a] mt-1">Día Feriado (Cerrado)</p>}
                  </div>
                  
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {slots.map((slot, idx) => {
                      const slotStartStr = slot.start.toISOString();
                      const slotEndStr = slot.end.toISOString();
                      
                      // Buscar turno que cae en este slot
                      const turno = dayTurnos.find(t => {
                        const tDate = new Date(t.fecha_hora);
                        return tDate >= slot.start && tDate < slot.end;
                      });
                      
                      // Buscar bloqueo que cubre este slot
                      const bloqueo = dayBloqueos.find(b => {
                        if (b.tipo === 'feriado') return true;
                        if (!b.hora_inicio || !b.hora_fin) return false;
                        
                        const bloqueoStart = new Date(date);
                        const [bh, bm] = b.hora_inicio.split(':').map(Number);
                        bloqueoStart.setHours(bh, bm, 0, 0);
                        
                        const bloqueoEnd = new Date(date);
                        const [beh, bem] = b.hora_fin.split(':').map(Number);
                        bloqueoEnd.setHours(beh, bem, 0, 0);
                        
                        return slot.start < bloqueoEnd && slot.end > bloqueoStart;
                      });
                      
                      const isBloqueado = bloqueo !== undefined;
                      
                      return (
                        <div key={idx} className="border-t border-[#e0e0e0]">
                          <div className="flex items-center">
                            <div className="w-20 text-[12px] text-[#7a7a7a] font-medium">
                              {slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex-1">
                              {isBloqueado ? (
                                <div className="p-3 bg-[#ffcccc] border-l-4 border-[#ff6666]">
                                  <p className="text-[14px] text-[#cc0000] font-medium">
                                    X -HORARIO BLOQUEADO
                                  </p>
                                </div>
                              ) : turno ? (
                                <div 
                                  className="p-3 bg-[#e8f4ff] border-l-4 border-[#0066cc] cursor-pointer hover:bg-[#d0e8ff] transition-colors"
                                  onClick={() => {
                                    setSelectedTurno(turno);
                                    setModalType("detalle_turno");
                                    setIsModalOpen(true);
                                  }}
                                >
                                  <div className="text-[12px] text-[#7a7a7a] mb-1">
                                    {slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <p className="text-[14px] text-[#1d1d1f] font-medium">
                                    {turno.pacientes?.apellido?.toUpperCase()} {turno.pacientes?.nombre}
                                  </p>
                                </div>
                              ) : (
                                <div className="p-3 bg-white">
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ) : modalType === "filtros" ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Obra Social</label>
                <select 
                  value={filtroObraSocial || ""}
                  onChange={(e) => setFiltroObraSocial(e.target.value || null)}
                  className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                >
                  <option value="">Todas las obras sociales</option>
                  {obrasSociales.map(os => (
                    <option key={os.id} value={os.id}>{os.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-[#e0e0e0]">
              <button 
                onClick={() => {
                  setFiltroObraSocial(null);
                  setIsModalOpen(false);
                }}
                className="flex-1 bg-[#f5f5f7] text-[#7a7a7a] py-3 rounded-full font-medium text-[14px] hover:bg-[#e0e0e0] transition-colors"
              >
                Limpiar Filtros
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-[#0066cc] text-white py-3 rounded-full font-medium text-[14px] hover:opacity-90 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        ) : modalType === "bloqueos" ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[14px] font-medium text-[#1d1d1f] uppercase">Bloqueos Activos</h3>
              <div className="space-y-2">
                {bloqueos.filter(b => b.fecha === selectedDateForBloqueo).length === 0 ? (
                  <p className="text-[12px] text-[#7a7a7a] italic">No hay bloqueos para este día.</p>
                ) : (
                  bloqueos.filter(b => b.fecha === selectedDateForBloqueo).map(b => (
                    <div key={b.id} className="flex justify-between items-center p-3 bg-[#f5f5f7] rounded-lg border border-[#e0e0e0]">
                      <div>
                        <p className="text-[14px] font-medium text-[#1d1d1f]">
                          {b.tipo === "feriado" ? "Día Feriado" : `Bloqueo: ${b.hora_inicio.slice(0,5)} - ${b.hora_fin.slice(0,5)}`}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteBloqueo(b.id)} className="text-[#7a7a7a] hover:text-[#1d1d1f] p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleCreateBloqueo} className="pt-6 border-t border-[#e0e0e0] space-y-4">
              <h3 className="text-[14px] font-medium text-[#1d1d1f] uppercase">Nuevo Bloqueo</h3>
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Tipo de Bloqueo</label>
                <select 
                  name="tipo" 
                  value={bloqueoTipo}
                  onChange={(e) => setBloqueoTipo(e.target.value as "parcial" | "feriado")}
                  className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" 
                  required
                >
                  <option value="parcial">Bloqueo de Horario</option>
                  <option value="feriado">Día Feriado (Cerrado)</option>
                </select>
              </div>
              
              {bloqueoTipo === "parcial" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Hora Inicio</label>
                    <select name="hora_inicio" className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required>
                      {getAvailableHours().slice(0, -1).map(h => (
                        <option key={h} value={h}>{h} hs</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Hora Fin</label>
                    <select name="hora_fin" className="w-full p-3 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" required>
                      {getAvailableHours().slice(1).map(h => (
                        <option key={h} value={h}>{h} hs</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              <button type="submit" className="w-full bg-[#0066cc] text-white py-3 rounded-full font-medium hover:opacity-90 transition">
                {bloqueoTipo === "feriado" ? "Marcar como Feriado" : "Aplicar Bloqueo de Horario"}
              </button>
            </form>
          </div>
        ) : modalType === "detalle_turno" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-lg border border-[#e0e0e0]">
              <div className="w-12 h-12 bg-[#0066cc]/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-[#0066cc]" />
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-[#1d1d1f]">{selectedTurno?.pacientes?.nombre} {selectedTurno?.pacientes?.apellido}</h3>
                <p className="text-[12px] text-[#7a7a7a] uppercase font-medium tracking-wider">Paciente</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[#f5f5f7] rounded-lg border border-[#e0e0e0]">
                <p className="text-[10px] text-[#7a7a7a] font-medium uppercase mb-1">Fecha</p>
                <p className="text-[14px] text-[#1d1d1f]">{selectedTurno && new Date(selectedTurno.fecha_hora).toLocaleDateString()}</p>
              </div>
              <div className="p-3 bg-[#f5f5f7] rounded-lg border border-[#e0e0e0]">
                <p className="text-[10px] text-[#7a7a7a] font-medium uppercase mb-1">Hora</p>
                <p className="text-[14px] text-[#1d1d1f]">{selectedTurno && new Date(selectedTurno.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs</p>
              </div>
            </div>

            <div className="p-3 bg-[#f5f5f7] rounded-lg border border-[#e0e0e0]">
              <p className="text-[10px] text-[#7a7a7a] font-medium uppercase mb-1">Motivo de Consulta</p>
              <p className="text-[14px] text-[#1d1d1f]">{selectedTurno?.motivo || "Sin motivo especificado"}</p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[#e0e0e0]">
              <button 
                onClick={() => handleCancelTurno(selectedTurno.id)}
                className="flex-1 bg-[#f5f5f7] text-[#7a7a7a] py-3 rounded-full font-medium text-[14px] hover:bg-[#e0e0e0] transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button 
                onClick={() => handleOpenModal("editar_turno")}
                className="flex-1 bg-[#f5f5f7] text-[#1d1d1f] py-3 rounded-full font-medium text-[14px] hover:bg-[#e0e0e0] transition-colors"
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
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Nombre</label>
                  <input name="nombre" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.nombre : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Apellido</label>
                  <input name="apellido" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.apellido : ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">DNI</label>
                  <input name="dni" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.dni : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Fecha de Nacimiento</label>
                  <input name="fecha_nacimiento" type="date" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.fecha_nacimiento : ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Teléfono</label>
                  <input name="telefono" type="tel" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.telefono : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Email (Opcional)</label>
                  <input name="email" type="email" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.email : ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Obra Social</label>
                  <select name="obra_social_id" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.obra_social_id : ""} required>
                    <option value="" disabled>Seleccionar...</option>
                    {obrasSociales.map(os => (
                      <option key={os.id} value={os.id}>{os.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Nro Afiliado</label>
                  <input name="nro_afiliado" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_paciente" ? selectedPaciente?.nro_afiliado : ""} />
                </div>
              </div>
            </>
          ) : modalType === "turno" || modalType === "editar_turno" ? (
            <>
              <div className="space-y-1 relative" ref={pacienteDropdownRef}>
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Paciente</label>
                <input
                  type="text"
                  value={pacienteSearchQuery}
                  onChange={(e) => {
                    setPacienteSearchQuery(e.target.value);
                    setShowPacienteDropdown(true);
                  }}
                  onFocus={() => setShowPacienteDropdown(true)}
                  placeholder="Buscar por nombre, apellido o DNI..."
                  className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  autoComplete="off"
                />
                {showPacienteDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#e0e0e0] rounded-lg max-h-60 overflow-y-auto">
                    {filteredPacientesForTurno.length === 0 ? (
                      <div className="p-3 text-[14px] text-[#7a7a7a] text-center">
                        No hay coincidencias
                      </div>
                    ) : (
                      filteredPacientesForTurno.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPacienteForTurno(p);
                            setPacienteSearchQuery(`${p.nombre} ${p.apellido}`);
                            setShowPacienteDropdown(false);
                          }}
                          className={`w-full text-left p-3 text-[14px] hover:bg-[#f5f5f7] transition-colors ${selectedPacienteForTurno?.id === p.id ? 'bg-[#0066cc]/10' : ''}`}
                        >
                          <div className="font-medium text-[#1d1d1f]">
                            {p.nombre} {p.apellido}
                          </div>
                          <div className="text-[12px] text-[#7a7a7a]">
                            DNI: {p.dni}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Fecha</label>
                  <input name="fecha" type="date" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_turno" ? new Date(selectedTurno?.fecha_hora).toISOString().split('T')[0] : ""} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Hora</label>
                  <input name="hora" type="time" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_turno" ? new Date(selectedTurno?.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ""} required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Motivo</label>
                <textarea name="motivo" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" rows={3} defaultValue={modalType === "editar_turno" ? selectedTurno?.motivo : ""}></textarea>
              </div>
            </>
          ) : modalType === "obra_social" || modalType === "editar_obra_social" ? (
            <>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Nombre de la Obra Social</label>
                <input name="nombre" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_obra_social" ? selectedOS?.nombre : ""} placeholder="Ej: OSDE" required />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Código Nacional (Opcional)</label>
                <input name="codigo_nacional" type="text" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={modalType === "editar_obra_social" ? selectedOS?.codigo_nacional : ""} placeholder="Ej: 400302" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Paciente</label>
                <p className="text-[17px] font-semibold text-[#1d1d1f]">{selectedPaciente?.nombre} {selectedPaciente?.apellido}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Fecha de Evolución</label>
                <input name="fecha" type="date" className="w-full p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" defaultValue={new Date().toISOString().split('T')[0]} required />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Contenido de la Evolución</label>
                <textarea 
                  name="contenido"
                  className="w-full p-3 bg-[#f5f5f7] border-none rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]" 
                  rows={8} 
                  placeholder="Escribe aquí el desarrollo de la consulta..."
                  required
                ></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#7a7a7a] uppercase">Adjuntos (Opcional)</label>
                <input type="file" className="w-full text-[12px] text-[#7a7a7a] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[12px] file:font-medium file:bg-[#0066cc]/10 file:text-[#0066cc] hover:file:bg-[#0066cc]/20" multiple />
              </div>
            </>
          )}
          <button type="submit" className="w-full bg-[#0066cc] text-white py-3 rounded-full font-medium mt-4 hover:opacity-90 transition">
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



