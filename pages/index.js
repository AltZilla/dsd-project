import React, { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Dynamic imports for better performance
const ApexChartsComponent = dynamic(() => import("react-apexcharts"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[350px] bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-lg">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent"></div>
    </div>
  )
});

let ApexCharts;
if (typeof window !== "undefined") {
  ApexCharts = require("apexcharts");
}

// Premium color palette
const COLORS = {
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  accent: "#06d6a0",
  warning: "#f59e0b",
  danger: "#ef4444",
  success: "#10b981",
  background: {
    primary: "from-slate-900 via-slate-800 to-slate-900",
    card: "from-slate-800/80 to-slate-700/80",
    glass: "rgba(255, 255, 255, 0.05)",
  }
};

// Custom hooks for better performance
const useInterval = (callback, delay) => {
  useEffect(() => {
    if (delay === null) return;
    const interval = setInterval(callback, delay);
    return () => clearInterval(interval);
  }, [callback, delay]);
};

export default function Home() {
  const [aggregatedData, setAggregatedData] = useState([]);
  const [recentPower, setRecentPower] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(1);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');

  const timeRanges = [
    { label: "1H", value: 1, icon: "🕐" },
    { label: "6H", value: 6, icon: "🕕" },
    { label: "12H", value: 12, icon: "🕙" },
    { label: "1D", value: 24, icon: "📅" },
    { label: "3D", value: 72, icon: "📊" },
    { label: "1W", value: 168, icon: "📈" },
  ];

  // Memoized calculations for performance
  const displayedPeak = useMemo(() => 
    aggregatedData.length > 0 ? Math.max(...aggregatedData.map(d => d.avgWatts)) : 0,
    [aggregatedData]
  );

  const averagePower = useMemo(() =>
    aggregatedData.length > 0 
      ? aggregatedData.reduce((sum, d) => sum + d.avgWatts, 0) / aggregatedData.length
      : 0,
    [aggregatedData]
  );

  const fetchDailyData = useCallback(async () => {
    try {
      setError(null);
      setConnectionStatus('connecting');
      
      const res = await fetch(`/api/power?limit=${timeLimit}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      setAggregatedData(data.aggregatedData || []);
      setRecentPower(data.recent || 0);
      setTotalEnergy(data.totalEnergy || 0);
      setLastUpdated(new Date());
      setConnectionStatus('connected');

      if (ApexCharts && data.aggregatedData?.length > 0) {
        ApexCharts.exec("area-datetime", "updateSeries", [
          {
            name: "Power (W)",
            data: data.aggregatedData.map(d => [
              new Date(d.timestamp).getTime(), 
              parseFloat(d.avgWatts.toFixed(2))
            ]),
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  }, [timeLimit]);

  // Auto-refresh every 2 seconds
  useInterval(fetchDailyData, 2000);

  useEffect(() => {
    fetchDailyData();
  }, [timeLimit, fetchDailyData]);

  const chartOptions = useMemo(() => ({
    chart: {
      id: "area-datetime",
      type: "area",
      height: 380,
      background: 'transparent',
      fontFamily: 'Inter, system-ui, sans-serif',
      zoom: { enabled: true },
      toolbar: {
        show: true,
        tools: {
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        }
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth",
      width: 3,
      colors: [COLORS.primary],
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.5,
        gradientToColors: [COLORS.secondary],
        inverseColors: false,
        opacityFrom: 0.8,
        opacityTo: 0.1,
        stops: [0, 100],
      },
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      strokeDashArray: 3,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: "datetime",
      labels: {
        formatter: (value, timestamp) => {
          const date = new Date(timestamp);
          return timeLimit > 24 
            ? date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
            : date.toLocaleString([], { hour: "2-digit", minute: "2-digit" });
        },
        style: { colors: "#e2e8f0", fontSize: '12px' },
      },
      axisBorder: { color: 'rgba(255, 255, 255, 0.2)' },
    },
    yaxis: {
      title: {
        text: "Power (W)",
        style: { color: "#e2e8f0", fontSize: '14px', fontWeight: 600 },
      },
      labels: {
        formatter: value => `${value.toFixed(1)}W`,
        style: { colors: "#e2e8f0", fontSize: '12px' },
      },
      min: 0,
    },
    tooltip: {
      theme: "dark",
      style: { fontSize: "14px" },
      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
        const value = series[seriesIndex][dataPointIndex];
        const timestamp = w.globals.seriesX[seriesIndex][dataPointIndex];
        return `
          <div class="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
            <div class="text-slate-300 text-sm">${new Date(timestamp).toLocaleString()}</div>
            <div class="text-blue-400 font-semibold text-lg">${value.toFixed(2)}W</div>
          </div>
        `;
      }
    },
    legend: { show: false },
  }), [timeLimit]);

  const chartSeries = useMemo(() => 
    aggregatedData.length ? [{
      name: "Power (W)",
      data: aggregatedData.map(d => [
        new Date(d.timestamp).getTime(),
        parseFloat(d.avgWatts.toFixed(2)),
      ]),
    }] : [{ name: "Power (W)", data: [] }],
    [aggregatedData]
  );

  // Status indicator component
  const StatusIndicator = () => (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
        connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
        'bg-red-500'
      }`} />
      <span className="text-sm text-slate-300 capitalize">{connectionStatus}</span>
    </div>
  );

  // Premium metric card component
  const MetricCard = ({ title, value, unit, color, icon, subtitle, progress }) => (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-slate-800/90 to-slate-700/90 backdrop-blur-sm hover:from-slate-800 hover:to-slate-700 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-200 text-lg font-semibold">{title}</CardTitle>
          <span className="text-2xl">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex flex-col items-center space-y-4">
          <div style={{ width: 140, height: 140 }}>
            <CircularProgressbar
              value={progress || value}
              text={`${value}${unit}`}
              styles={buildStyles({
                pathColor: color,
                textColor: "#f8fafc",
                trailColor: "rgba(255, 255, 255, 0.1)",
                textSize: "14px",
                pathTransitionDuration: 0.8,
              })}
            />
          </div>
          {subtitle && (
            <p className="text-sm text-slate-400 text-center leading-relaxed">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-10 opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" />
        </div>
      </div>

      <div className="relative container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-6 lg:space-y-0">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Power Monitor
            </h1>
            <div className="flex items-center space-x-6">
              <div className="text-sm text-slate-400">
                Last updated: {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit", minute: "2-digit", second: "2-digit"
                })}
              </div>
              <StatusIndicator />
            </div>
          </div>

          {/* Time range selector */}
          <div className="flex flex-wrap gap-2">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeLimit(range.value)}
                className={`group relative px-4 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                  timeLimit === range.value
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25"
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white backdrop-blur-sm"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>{range.icon}</span>
                  <span>{range.label}</span>
                </span>
                {timeLimit === range.value && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 opacity-20 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error handling */}
        {error && (
          <Card className="border-red-500/50 bg-red-900/20">
            <CardContent className="flex items-center space-x-3 p-4">
              <span className="text-red-500 text-xl">⚠️</span>
              <span className="text-red-300">Error loading data: {error}</span>
            </CardContent>
          </Card>
        )}

        {/* Main chart */}
        <Card className="border-0 bg-gradient-to-br from-slate-800/90 to-slate-700/90 backdrop-blur-sm shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-semibold text-white flex items-center space-x-2">
                <span>📊</span>
                <span>Power Usage Timeline</span>
              </CardTitle>
              <div className="text-slate-400 text-sm">
                Last {timeLimit} hour{timeLimit > 1 ? "s" : ""}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[380px]">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            ) : (
              <ApexChartsComponent
                options={chartOptions}
                series={chartSeries}
                type="area"
                height={380}
              />
            )}
          </CardContent>
        </Card>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <MetricCard
            title="Current Power"
            value={recentPower.toFixed(0)}
            unit="W"
            color={COLORS.danger}
            icon="⚡"
            subtitle="Real-time power consumption"
            progress={Math.min((recentPower / 100) * 100, 100)}
          />
          
          <MetricCard
            title="Total Energy"
            value={totalEnergy.toFixed(2)}
            unit=" kWh"
            color={COLORS.success}
            icon="🔋"
            subtitle={`Energy used in last ${timeLimit}h`}
            progress={Math.min((totalEnergy / 10) * 100, 100)}
          />
          
          <MetricCard
            title="Peak Power"
            value={displayedPeak.toFixed(0)}
            unit="W"
            color={COLORS.warning}
            icon="📈"
            subtitle="Maximum power in period"
            progress={Math.min((displayedPeak / 150) * 100, 100)}
          />
          
          <MetricCard
            title="Average Power"
            value={averagePower.toFixed(1)}
            unit="W"
            color={COLORS.primary}
            icon="📊"
            subtitle="Mean consumption rate"
            progress={Math.min((averagePower / 100) * 100, 100)}
          />
        </div>

        {/* Data insights */}
        {aggregatedData.length > 0 && (
          <Card className="border-0 bg-gradient-to-br from-slate-800/90 to-slate-700/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white flex items-center space-x-2">
                <span>💡</span>
                <span>Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 rounded-lg bg-slate-700/30">
                  <div className="text-slate-300">Efficiency Score</div>
                  <div className="text-2xl font-bold text-green-400">
                    {averagePower > 0 ? Math.min(((100 - averagePower) / 100 * 100), 100).toFixed(0) : 0}%
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-700/30">
                  <div className="text-slate-300">Data Points</div>
                  <div className="text-2xl font-bold text-blue-400">{aggregatedData.length}</div>
                </div>
                <div className="p-4 rounded-lg bg-slate-700/30">
                  <div className="text-slate-300">Trend</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {aggregatedData.length > 1 
                      ? (aggregatedData[aggregatedData.length - 1].avgWatts > aggregatedData[0].avgWatts ? "📈" : "📉")
                      : "➖"
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
      }
