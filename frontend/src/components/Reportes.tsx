"use client"

import { useState, useEffect } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { AlertCircle, Loader2, Calendar, TrendingUp, FileText } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ReportesProps {
  medicoId: string;
}

export default function ReportesTab({ medicoId }: ReportesProps) {
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [error, setError] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const colors = [
    "#0066cc", "#5e5ce6", "#64d2ff", "#32ade6", "#007aff", 
    "#5856d6", "#af52de", "#ff2d55", "#ff3b30", "#ff9500"
  ];

  useEffect(() => {
    const fetchMonthlyStats = async () => {
      if (!medicoId) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/reportes/obras-sociales-mensual?medico_id=${medicoId}`);
        if (!res.ok) throw new Error("Error al cargar estadísticas mensuales");
        const stats = await res.json();
        setMonthlyData(stats);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los reportes.");
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyStats();
  }, [medicoId]);

  useEffect(() => {
    const fetchDailyStats = async () => {
      if (!medicoId || !selectedMonth) return;
      setLoadingDaily(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/reportes/obras-sociales-diario?medico_id=${medicoId}&mes=${selectedMonth}`);
        if (!res.ok) throw new Error("Error al cargar estadísticas diarias");
        const stats = await res.json();
        setDailyData(stats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDaily(false);
      }
    };

    fetchDailyStats();
  }, [medicoId, selectedMonth]);

  const formatMonthYear = (mesStr: string) => {
    const [year, month] = mesStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const nombreMes = date.toLocaleString('es-ES', { month: 'long' });
    return `${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ${year}`;
  };

  // Procesar datos para la tabla resumen y el gráfico diario
  const obrasSociales = Array.from(new Set(dailyData.map(d => d.obra_social)));
  const diasDelMes = Array.from(new Set(dailyData.map(d => d.dia)));

  // Totales por OS para el mes seleccionado
  const osSummary = obrasSociales.map(os => {
    const total = dailyData
      .filter(d => d.obra_social === os)
      .reduce((acc, curr) => acc + curr.cantidad, 0);
    return { obra_social: os, total };
  }).sort((a, b) => b.total - a.total);

  const totalGeneralMes = osSummary.reduce((acc, curr) => acc + curr.total, 0);

  const dailyChartData = {
    labels: diasDelMes.map(d => {
      const date = new Date(d);
      const day = date.getDate();
      const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' });
      return `${weekday} ${day}`;
    }),
    datasets: obrasSociales.map((os, index) => ({
      label: os,
      data: diasDelMes.map(dia => {
        const item = dailyData.find(d => d.dia === dia && d.obra_social === os);
        return item ? item.cantidad : 0;
      }),
      backgroundColor: colors[index % colors.length],
      borderRadius: 4,
      barPercentage: 0.8,
      categoryPercentage: 0.9,
    })),
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { 
        position: 'bottom' as const, 
        labels: { 
          usePointStyle: true, 
          font: { size: 11 },
          padding: 20
        } 
      },
      tooltip: { 
        backgroundColor: "#1d1d1f", 
        padding: 12,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 },
        callbacks: {
          title: (tooltipItems: any) => {
            return `Día: ${tooltipItems[0].label}`;
          },
          label: (context: any) => {
            return ` ${context.dataset.label}: ${context.parsed.y} atenciones`;
          }
        }
      },
    },
    scales: {
      y: { 
        stacked: true,
        beginAtZero: true, 
        grid: { color: "#f5f5f7" }, 
        ticks: { stepSize: 1, color: "#7a7a7a" } 
      },
      x: { 
        stacked: true,
        grid: { display: false }, 
        ticks: { 
          color: "#7a7a7a",
          font: { size: 10 }
        } 
      }
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-lg border border-[#e0e0e0]">
        <Loader2 className="w-8 h-8 text-[#0066cc] animate-spin mb-2" />
        <p className="text-[14px] text-[#7a7a7a]">Analizando datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header con Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg border border-[#e0e0e0]">
        <div>
          <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">Reporte Operativo</h2>
          <p className="text-[14px] text-[#7a7a7a]">Análisis diario y cierre de facturación.</p>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-[#7a7a7a]" />
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-2.5 bg-[#f5f5f7] border-none rounded-full text-[14px] font-medium focus:ring-2 focus:ring-[#0066cc] outline-none"
          >
            {/* Generar últimos 12 meses */}
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const val = d.toISOString().slice(0, 7);
              return <option key={val} value={val}>{formatMonthYear(val)}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gráfico de Tendencia Diaria */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-[#e0e0e0]">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-[#0066cc]" />
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Tendencia de Consumo Diario</h3>
            </div>
            <div className="h-[400px]">
              {loadingDaily ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#d2d2d7]" /></div>
              ) : dailyData.length > 0 ? (
                <Bar data={dailyChartData} options={barOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-[#7a7a7a] text-[14px]">No hay actividad registrada para este mes.</div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla Resumen / Cierre Mensual */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-[#e0e0e0] h-full">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-[#0066cc]" />
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Cierre Mensual</h3>
            </div>
            
            <div className="space-y-4">
              <div className="bg-[#f5f5f7] p-4 rounded-lg">
                <p className="text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider">Total Atenciones</p>
                <h4 className="text-[28px] font-semibold text-[#1d1d1f]">{totalGeneralMes}</h4>
              </div>

              <div className="overflow-hidden rounded-lg border border-[#e0e0e0]">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#f5f5f7] text-[#7a7a7a] border-b border-[#e0e0e0]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Obra Social</th>
                      <th className="px-3 py-2 font-medium text-right">Cant.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0e0e0]">
                    {osSummary.map((os, i) => (
                      <tr key={i} className="hover:bg-[#fafafa]">
                        <td className="px-3 py-2.5 font-medium text-[#1d1d1f]">{os.obra_social}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#0066cc]">{os.total}</td>
                      </tr>
                    ))}
                    {osSummary.length === 0 && (
                      <tr><td colSpan={2} className="px-3 py-8 text-center text-[#7a7a7a]">Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <p className="text-[11px] text-[#7a7a7a] italic">
                * Resumen basado en turnos finalizados y pendientes. Excluye cancelados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
