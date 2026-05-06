"use client"

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Calendar, Lock, Mail, Loader2, User } from "lucide-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [matricula, setMatricula] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isRegister) {
      // Registro
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre,
            apellido,
            matricula,
            especialidad,
          },
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        setMessage("¡Registro exitoso! Revisa tu email para confirmar (si está habilitado) o inicia sesión.");
        setLoading(false);
        setIsRegister(false);
      }
    } else {
      // Login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError("Credenciales inválidas o error de conexión.");
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
        <div className="p-8">
          <div className="flex flex-col items-center mb-10">
            <div className="w-12 h-12 bg-[#0066cc] rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
              {isRegister ? "Crear Cuenta" : "Bienvenido"}
            </h1>
            <p className="text-[14px] text-[#7a7a7a] mt-1">
              {isRegister ? "Regístrate como profesional de salud" : "Acceso para profesionales de salud"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase ml-1">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc] transition-all"
                      placeholder="Juan"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase ml-1">Apellido</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                    <input
                      type="text"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc] transition-all"
                      placeholder="Pérez"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {isRegister && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase ml-1">Matrícula</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                    <input
                      type="text"
                      value={matricula}
                      onChange={(e) => setMatricula(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc] transition-all"
                      placeholder="M.N. 12345"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-[#7a7a7a] uppercase ml-1">Especialidad</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                    <input
                      type="text"
                      value={especialidad}
                      onChange={(e) => setEspecialidad(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc] transition-all"
                      placeholder="Pediatría"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[#7a7a7a] uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc] transition-all"
                  placeholder="doctor@ejemplo.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[#7a7a7a] uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a7a]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc] transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[#1d1d1f] text-[12px] font-medium">
                {error}
              </div>
            )}

            {message && (
              <div className="p-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[#1d1d1f] text-[12px] font-medium">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0066cc] text-white py-3.5 rounded-full font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                isRegister ? "Registrarse" : "Iniciar Sesión"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setMessage(null);
              }}
              className="text-[12px] font-medium text-[#0066cc] hover:underline"
            >
              {isRegister ? "¿Ya tienes cuenta? Inicia Sesión" : "¿No tienes cuenta? Regístrate aquí"}
            </button>
          </div>
        </div>
        <div className="p-6 bg-[#f5f5f7] border-t border-[#e0e0e0] text-center">
          <p className="text-[12px] text-[#7a7a7a]">
            Sistema de Gestión Médica Profesional 🦴
          </p>
        </div>
      </div>
    </div>
  );
}
