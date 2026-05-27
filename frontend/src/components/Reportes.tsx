"use client"

import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { AlertCircle, Loader2 } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ReportesProps {
  medicoId: string;
}

export default function ReportesTab({ medicoId }: ReportesProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchStats = async () => {
      if (!medicoId) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/reportes/obras-sociales-mensual?medico_id=${medicoId}`);
        if (!res.ok) throw new Error("Error al cargar estadísticas");
        const stats = await res.json();
        // Recibimos [{mes: '2024-05', obra_social: 'OSDE', cantidad: 5}, ...]
        setData(stats);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los reportes.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [medicoId]);

  const formatMonthYear = (mesStr: string) => {
    const [year, month] = mesStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const nombreMes = date.toLocaleString('es-ES', { month: 'long' });
    return `${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ${year}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-lg border border-[#e0e0e0]">
        <Loader2 className="w-8 h-8 text-[#0066cc] animate-spin mb-2" />
        <p className="text-[14px] text-[#7a7a7a]">Generando reportes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-lg border border-[#e0e0e0] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-[#ff6666] mb-4" />
        <h3 className="text-[17px] font-semibold text-[#1d1d1f]">{error}</h3>
        <p className="text-[14px] text-[#7a7a7a] mt-1">Asegúrate de tener turnos registrados con pacientes que posean obra social.</p>
      </div>
    );
  }

  // Procesar datos para el gráfico (Stacked Bar Chart por Mes)
  const meses = Array.from(new Set(data.map(d => d.mes))).reverse();
  const obrasSociales = Array.from(new Set(data.map(d => d.obra_social)));

  const colors = [
    "#0066cc", "#5e5ce6", "#64d2ff", "#32ade6", "#007aff", 
    "#5856d6", "#af52de", "#ff2d55", "#ff3b30", "#ff9500"
  ];

  const chartData = {
    labels: meses.map(m => formatMonthYear(m)),
    datasets: obrasSociales.map((os, index) => ({
      label: os,
      data: meses.map(m => {
        const item = data.find(d => d.mes === m && d.obra_social === os);
        return item ? item.cantidad : 0;
      }),
      backgroundColor: colors[index % colors.length],
      borderRadius: 4,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 }
        }
      },
      title: {
        display: true,
        text: "Uso de Obras Sociales por Mes",
        font: { size: 17, weight: 'bold' as const },
        color: "#1d1d1f",
        padding: { bottom: 20 },
      },
      tooltip: {
        backgroundColor: "#1d1d1f",
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
      }
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
        ticks: { color: "#7a7a7a" }
      }
    },
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-lg border border-[#e0e0e0]">
        <div className="h-[500px]">
          {data.length > 0 ? (
            <Bar data={chartData} options={options} />
          ) : (
            <div className="flex items-center justify-center h-full text-center space-y-2">
              <div>
                <p className="text-[#7a7a7a] text-[14px]">No hay datos suficientes para mostrar el gráfico.</p>
                <p className="text-[#d2d2d7] text-[12px]">Los datos se actualizan al registrar turnos.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
