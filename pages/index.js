import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import io from 'socket.io-client';

const ApexChartsComponent = dynamic(() => import("react-apexcharts"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] glassmorphism-card">
      <div className="loading-spinner"></div>
    </div>
  )
});

let ApexCharts;
if (typeof window !== "undefined") {
  ApexCharts = require("apexcharts");
}

export default function Home() {
  const [aggregatedData, setAggregatedData] = useState([]);
  const [recentPower, setRecentPower] = useState(0);
  const [voltage, setVoltage] = useState(0);
  const [current, setCurrent] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(1);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const timeRanges = [
    { label: "1H", value: 1 },
    { label: "6H", value: 6 },
    { label: "12H", value: 12 },
    { label: "1D", value: 24 },
    { label: "3D", value: 72 },
    { label: "1W", value: 168 },
  ];

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

  useEffect(() => {
    const socket = io();

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setIsLoading(false);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('data', (data) => {
      setRecentPower(parseFloat(data.power));
      setVoltage(parseFloat(data.voltage));
      setCurrent(parseFloat(data.current));
      setLastUpdated(new Date());

      const newAggregatedData = [...aggregatedData, {
        avgWatts: parseFloat(data.power),
        avgVoltage: parseFloat(data.voltage),
        timestamp: new Date(data.timestamp),
      }];

      // Keep the data within the time limit
      const now = new Date().getTime();
      const limit = now - timeLimit * 3600 * 1000;
      const filteredData = newAggregatedData.filter(d => new Date(d.timestamp).getTime() > limit);
      setAggregatedData(filteredData);

      if (ApexCharts) {
        ApexCharts.exec("glassmorphism-chart", "updateSeries", [
          {
            name: "Power Usage",
            data: filteredData.map(d => [
              new Date(d.timestamp).getTime(), 
              parseFloat(d.avgWatts.toFixed(2))
            ]),
          },
          {
            name: "Voltage",
            data: filteredData.map(d => [
              new Date(d.timestamp).getTime(), 
              parseFloat(d.avgVoltage.toFixed(2))
            ]),
          },
        ]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [aggregatedData, timeLimit]);

  const chartOptions = useMemo(() => ({
    chart: {
      id: "glassmorphism-chart",
      type: "line",
      height: 400,
      background: 'transparent',
      fontFamily: '"SF Pro Display", system-ui, sans-serif',
      zoom: { enabled: false },
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth",
      width: [3, 2],
      colors: ['rgba(99, 102, 241, 0.8)', 'rgba(245, 158, 11, 0.8)'],
      dashArray: [0, 5],
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.3,
        gradientToColors: ['rgba(139, 92, 246, 0.4)', 'transparent'],
        inverseColors: false,
        opacityFrom: [0.7, 0.1],
        opacityTo: [0.1, 0.1],
        stops: [0, 90, 100],
      },
    },
    grid: {
      show: true,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      strokeDashArray: 1,
      xaxis: { lines: { show: false } },
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
        style: { 
          colors: "rgba(255, 255, 255, 0.6)", 
          fontSize: '11px',
          fontWeight: 500 
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      {
        seriesName: 'Power Usage',
        labels: {
          formatter: value => `${value.toFixed(0)}W`,
          style: { 
            colors: "rgba(255, 255, 255, 0.6)", 
            fontSize: '11px',
            fontWeight: 500 
          },
        },
        min: 0,
      },
      {
        seriesName: 'Voltage',
        opposite: true,
        labels: {
          formatter: value => `${value.toFixed(0)}V`,
          style: { 
            colors: "rgba(255, 255, 255, 0.6)", 
            fontSize: '11px',
            fontWeight: 500 
          },
        },
        min: 200,
        max: 250,
      },
    ],
    tooltip: {
      enabled: true,
      theme: 'dark',
      x: {
        format: 'dd MMM yyyy HH:mm',
      },
    },
    legend: { 
      show: true,
      position: 'top',
      horizontalAlign: 'right',
      floating: true,
      offsetY: -25,
      offsetX: -5,
      labels: {
        colors: 'rgba(255, 255, 255, 0.7)',
      },
    },
    annotations: {
      yaxis: [
        {
          y: averagePower,
          borderColor: '#00E396',
          label: {
            borderColor: '#00E396',
            style: {
              color: '#fff',
              background: '#00E396',
            },
            text: `Avg: ${averagePower.toFixed(1)}W`,
          },
        },
      ],
      points: [
        {
          x: new Date(aggregatedData[aggregatedData.length - 1]?.timestamp).getTime(),
          y: displayedPeak,
          marker: {
            size: 8,
            fillColor: '#FF4560',
            strokeColor: '#fff',
            radius: 2,
          },
          label: {
            borderColor: '#FF4560',
            offsetY: 0,
            style: {
              color: '#fff',
              background: '#FF4560',
            },
            text: `Peak: ${displayedPeak.toFixed(1)}W`,
          },
        },
      ],
    },
  }), [timeLimit, averagePower, displayedPeak, aggregatedData]);

  const chartSeries = useMemo(() => 
    [
      {
        name: "Power Usage",
        data: aggregatedData.map(d => [
          new Date(d.timestamp).getTime(),
          parseFloat(d.avgWatts.toFixed(2)),
        ]),
      },
      {
        name: "Voltage",
        data: aggregatedData.map(d => [
          new Date(d.timestamp).getTime(),
          parseFloat(d.avgVoltage.toFixed(2)),
        ]),
      },
    ],
    [aggregatedData]
  );

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow-x: hidden;
        }

        .glassmorphism-bg {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          position: relative;
        }

        .glassmorphism-bg::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><g fill="rgba(255,255,255,0.03)" fill-opacity="0.4"><circle cx="30" cy="30" r="1.5"/></g></svg>');
          pointer-events: none;
        }

        .floating-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          animation: float 6s ease-in-out infinite;
          pointer-events: none;
        }

        .floating-orb:nth-child(1) {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
          top: 10%;
          left: 10%;
          animation-delay: 0s;
        }

        .floating-orb:nth-child(2) {
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
          top: 60%;
          right: 20%;
          animation-delay: 2s;
        }

        .floating-orb:nth-child(3) {
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
          bottom: 20%;
          left: 30%;
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(120deg); }
          66% { transform: translateY(10px) rotate(240deg); }
        }

        .glassmorphism-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glassmorphism-card:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .glassmorphism-button {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }

        .glassmorphism-button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .glassmorphism-button.active {
          background: rgba(99, 102, 241, 0.3);
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
        }

        .metric-value {
          font-family: 'Inter', monospace;
          font-weight: 700;
          font-size: 2.5rem;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-connected { background: #10b981; }
        .status-connecting { background: #f59e0b; }
        .status-disconnected { background: #ef4444; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.2);
          border-top: 3px solid rgba(99, 102, 241, 0.8);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .circular-progress-glass {
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        }

        .insight-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .insight-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-3px);
        }

        .glass-text-primary {
          color: rgba(255, 255, 255, 0.95);
          font-weight: 600;
        }

        .glass-text-secondary {
          color: rgba(255, 255, 255, 0.7);
        }

        .glass-text-muted {
          color: rgba(255, 255, 255, 0.5);
        }
      `}</style>

      <div className="glassmorphism-bg">
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        
        <div className="relative z-10 container mx-auto p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-6xl font-bold glass-text-primary">
              Power Monitor
            </h1>
            <div className="flex items-center justify-center space-x-6 glass-text-secondary">
              <div className="flex items-center space-x-2">
                <div className={`status-dot status-${connectionStatus}`}></div>
                <span className="text-sm font-medium capitalize">{connectionStatus}</span>
              </div>
              <div className="text-sm">
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit", minute: "2-digit", second: "2-digit"
                })}
              </div>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex justify-center mb-8">
            <div className="glassmorphism-card rounded-2xl p-2">
              <div className="flex space-x-2">
                {timeRanges.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setTimeLimit(range.value)}
                    className={`glassmorphism-button px-6 py-3 rounded-xl font-medium text-white transition-all ${
                      timeLimit === range.value ? 'active' : ''
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Chart */}
          <div className="glassmorphism-card rounded-3xl p-8 mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold glass-text-primary text-center">
                Power Usage Timeline
              </h2>
              <p className="glass-text-muted text-center mt-2">
                Last {timeLimit} hour{timeLimit > 1 ? "s" : ""}
              </p>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="loading-spinner"></div>
              </div>
            ) : (
              <ApexChartsComponent
                options={chartOptions}
                series={chartSeries}
                type="area"
                height={400}
              />
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current Power */}
            <div className="glassmorphism-card rounded-3xl p-8 text-center">
              <div className="mb-4">
                <h3 className="glass-text-secondary text-lg font-medium mb-2">Current Power</h3>
                <div className="circular-progress-glass mx-auto" style={{ width: 120, height: 120 }}>
                  <CircularProgressbar
                    value={Math.min((recentPower / 150) * 100, 100)}
                    styles={buildStyles({
                      pathColor: "rgba(239, 68, 68, 0.8)",
                      textColor: "rgba(255, 255, 255, 0.95)",
                      trailColor: "rgba(255, 255, 255, 0.1)",
                      pathTransitionDuration: 1,
                    })}
                  />
                </div>
              </div>
              <div className="metric-value">{recentPower.toFixed(0)}W</div>
              <p className="glass-text-muted text-sm mt-2">Real-time consumption</p>
            </div>

            {/* Voltage */}
            <div className="glassmorphism-card rounded-3xl p-8 text-center">
              <div className="mb-4">
                <h3 className="glass-text-secondary text-lg font-medium mb-2">Voltage</h3>
                <div className="circular-progress-glass mx-auto" style={{ width: 120, height: 120 }}>
                  <CircularProgressbar
                    value={Math.min((voltage / 240) * 100, 100)}
                    styles={buildStyles({
                      pathColor: "rgba(16, 185, 129, 0.8)",
                      textColor: "rgba(255, 255, 255, 0.95)",
                      trailColor: "rgba(255, 255, 255, 0.1)",
                      pathTransitionDuration: 1,
                    })}
                  />
                </div>
              </div>
              <div className="metric-value">{voltage.toFixed(2)}V</div>
              <p className="glass-text-muted text-sm mt-2">Line voltage</p>
            </div>

            {/* Current */}
            <div className="glassmorphism-card rounded-3xl p-8 text-center">
              <div className="mb-4">
                <h3 className="glass-text-secondary text-lg font-medium mb-2">Current</h3>
                <div className="circular-progress-glass mx-auto" style={{ width: 120, height: 120 }}>
                  <CircularProgressbar
                    value={Math.min((current / 10) * 100, 100)}
                    styles={buildStyles({
                      pathColor: "rgba(245, 158, 11, 0.8)",
                      textColor: "rgba(255, 255, 255, 0.95)",
                      trailColor: "rgba(255, 255, 255, 0.1)",
                      pathTransitionDuration: 1,
                    })}
                  />
                </div>
              </div>
              <div className="metric-value">{current.toFixed(2)}A</div>
              <p className="glass-text-muted text-sm mt-2">Amperage draw</p>
            </div>

            {/* Average Power */}
            <div className="glassmorphism-card rounded-3xl p-8 text-center">
              <div className="mb-4">
                <h3 className="glass-text-secondary text-lg font-medium mb-2">Average Power</h3>
                <div className="circular-progress-glass mx-auto" style={{ width: 120, height: 120 }}>
                  <CircularProgressbar
                    value={Math.min((averagePower / 100) * 100, 100)}
                    styles={buildStyles({
                      pathColor: "rgba(99, 102, 241, 0.8)",
                      textColor: "rgba(255, 255, 255, 0.95)",
                      trailColor: "rgba(255, 255, 255, 0.1)",
                      pathTransitionDuration: 1,
                    })}
                  />
                </div>
              </div>
              <div className="metric-value">{averagePower.toFixed(1)}W</div>
              <p className="glass-text-muted text-sm mt-2">Mean consumption</p>
            </div>
          </div>

          {/* Insights */}
          {aggregatedData.length > 0 && (
            <div className="glassmorphism-card rounded-3xl p-8">
              <h2 className="text-2xl font-semibold glass-text-primary text-center mb-8">
                System Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="insight-card text-center">
                  <div className="text-4xl font-bold glass-text-primary mb-2">
                    {averagePower > 0 ? Math.min(((100 - averagePower/2) / 100 * 100), 100).toFixed(0) : 0}%
                  </div>
                  <div className="glass-text-secondary font-medium">Efficiency Score</div>
                </div>
                <div className="insight-card text-center">
                  <div className="text-4xl font-bold glass-text-primary mb-2">
                    {aggregatedData.length}
                  </div>
                  <div className="glass-text-secondary font-medium">Data Points</div>
                </div>
                <div className="insight-card text-center">
                  <div className="text-4xl font-bold glass-text-primary mb-2">
                    {aggregatedData.length > 1 
                      ? (aggregatedData[aggregatedData.length - 1].avgWatts > aggregatedData[0].avgWatts ? "↗" : "↘")
                      : "→"
                    }
                  </div>
                  <div className="glass-text-secondary font-medium">Trend</div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="glassmorphism-card rounded-3xl p-6 border-red-500/30">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-red-400 text-2xl">⚠</span>
                <span className="glass-text-primary">Connection Error: {error}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
      }
