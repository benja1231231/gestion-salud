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
        // El rpc devuelve [{mes: '2024-05', cantidad: 10}, ...]
        // Invertimos para que el tiempo fluya de izquierda a derecha
        setData(stats.reverse());
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los reportes.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [medicoId]);

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

  const chartData = {
    labels: data.map(d => d.mes),
    datasets: [
      {
        label: "Obras Sociales Utilizadas",
        data: data.map(d => d.cantidad),
        backgroundColor: "#0066cc",
        borderRadius: 8,
        barThickness: 40,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Obras Sociales por Mes",
        font: {
          size: 17,
          weight: 'bold' as const,
        },
        color: "#1d1d1f",
        padding: { bottom: 30 },
      },
      tooltip: {
        backgroundColor: "#1d1d1f",
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        displayColors: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: "#f5f5f7",
        },
        ticks: {
          stepSize: 1,
          color: "#7a7a7a",
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#7a7a7a",
        }
      }
    },
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-[#e0e0e0]">
          <p className="text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider mb-1">Total Mes Actual</p>
          <h3 className="text-[28px] font-semibold text-[#1d1d1f]">
            {data.length > 0 ? data[data.length - 1].cantidad : 0}
          </h3>
        </div>
      </div>

      <div className="bg-white p-8 rounded-lg border border-[#e0e0e0]">
        <div className="h-[400px] flex items-center justify-center">
          {data.length > 0 ? (
            <Bar data={chartData} options={options} />
          ) : (
            <div className="text-center space-y-2">
              <p className="text-[#7a7a7a] text-[14px]">No hay datos suficientes para mostrar el gráfico.</p>
              <p className="text-[#d2d2d7] text-[12px]">Los datos se actualizan al registrar turnos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
