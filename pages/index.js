import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import AlertsModal from '../components/AlertsModal';

const ApexChartsComponent = dynamic(() => import('react-apexcharts'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[400px]"><div className="premium-loader"></div></div>
});

// Indian electricity pricing structure (example: typical urban domestic tariff)
// Rates vary by state - this represents a typical structure
const indianElectricitySlabs = [
  { limit: 100, rate: 3.50 },    // 0-100 units: ₹3.50/unit
  { limit: 200, rate: 4.50 },    // 101-200 units: ₹4.50/unit
  { limit: 300, rate: 6.00 },    // 201-300 units: ₹6.00/unit
  { limit: 400, rate: 7.00 },    // 301-400 units: ₹7.00/unit
  { limit: Infinity, rate: 8.00 } // Above 400 units: ₹8.00/unit
];

const FIXED_MONTHLY_CHARGE = 50; // ₹50 fixed charge per month
const USD_TO_INR = 83; // Current approximate exchange rate

export default function Home() {
  const [data, setData] = useState([]);
  const [timeLimit, setTimeLimit] = useState('realtime');
  const [showModal, setShowModal] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [showAlertPopup, setShowAlertPopup] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState(0);

  // Fetch alerts on mount and poll for updates
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const response = await fetch('/api/alerts');
        if (response.ok) {
          const allAlerts = await response.json();
          setAlerts(allAlerts);
          
          // Check for triggered alerts
          const triggered = allAlerts.filter(a => a.triggered && a.active);
          
          console.log('Triggered alerts:', triggered.length, triggered);
          
          if (triggered.length > 0) {
            const hasNewAlerts = triggered.some(t => 
              !activeAlerts.find(a => a._id === t._id)
            );
            
            setActiveAlerts(triggered);
            
            if (hasNewAlerts || (triggered.length > 0 && activeAlerts.length === 0)) {
              const now = Date.now();
              if (now - lastAlertTime > 5000) {
                console.log('Showing alert popup');
                setShowAlertPopup(true);
                setLastAlertTime(now);
              } else {
                console.log('Alert popup throttled, wait', 5 - (now - lastAlertTime) / 1000, 'seconds');
              }
            }
          } else {
            if (activeAlerts.length > 0) {
              setActiveAlerts([]);
              setShowAlertPopup(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    }
    
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  // Real-time data fetching
  useEffect(() => {
    if (timeLimit !== 'realtime') return;

    const fetchData = async () => {
      try {
        const response = await fetch('/api/power');
        if (response.ok) {
          const newData = await response.json();
          setData(prevData => {
            const updated = [...prevData, newData];
            return updated.slice(-100);
          });
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.error('Error fetching real-time data:', error);
        setConnectionStatus('disconnected');
      }
    };

    fetchData();
    
    const intervalId = setInterval(fetchData, 2000);

    return () => clearInterval(intervalId);
  }, [timeLimit]);

  // Historical data fetching
  useEffect(() => {
    setData([]);
    setIsLoading(true);
    
    async function fetchInitialData() {
      if (timeLimit === 'realtime') {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/power?timeLimit=${timeLimit}`);
        if (response.ok) {
          const initialData = await response.json();
          setData(Array.isArray(initialData) ? initialData : []);
        } else {
          console.error('Failed to fetch data:', response.status);
          setData([]);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchInitialData();
  }, [timeLimit]);

  const filteredData = useMemo(() => {
    return data;
  }, [data]);

  const latestData = useMemo(() => 
    filteredData.length > 0 ? filteredData[filteredData.length - 1] : { power: 0, voltage: 0, current: 0 }, 
    [filteredData]
  );

  const averagePower = useMemo(() => 
    filteredData.length > 0 ? filteredData.reduce((sum, d) => sum + (d.power || 0), 0) / filteredData.length : 0, 
    [filteredData]
  );

  const durationInHours = useMemo(() => {
    if (filteredData.length < 2) {
      return 0;
    }
    const firstTimestamp = new Date(filteredData[0].timestamp).getTime();
    const lastTimestamp = new Date(filteredData[filteredData.length - 1].timestamp).getTime();
    return (lastTimestamp - firstTimestamp) / (1000 * 3600);
  }, [filteredData]);

  const totalEnergyKwh = useMemo(() => {
    if (timeLimit === 'realtime') {
      return (averagePower / 1000) * durationInHours;
    }
    return (averagePower / 1000) * timeLimit;
  }, [averagePower, timeLimit, durationInHours]);

  // Calculate cost using Indian slab-based pricing
  const calculateIndianCost = (units) => {
    let cost = 0;
    let remainingUnits = units;
    let previousLimit = 0;

    for (const slab of indianElectricitySlabs) {
      const slabUnits = Math.min(remainingUnits, slab.limit - previousLimit);
      if (slabUnits <= 0) break;
      
      cost += slabUnits * slab.rate;
      remainingUnits -= slabUnits;
      previousLimit = slab.limit;
      
      if (remainingUnits <= 0) break;
    }

    return cost;
  };

  const costBreakdown = useMemo(() => {
    const energyCost = calculateIndianCost(totalEnergyKwh);
    const fixedCharge = FIXED_MONTHLY_CHARGE;
    const totalInr = energyCost + fixedCharge;
    const totalUsd = totalInr / USD_TO_INR;

    return {
      energyCost,
      fixedCharge,
      totalInr,
      totalUsd
    };
  }, [totalEnergyKwh]);

  const handleExportCsv = () => {
    if (filteredData.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['timestamp', 'power_W', 'voltage_V', 'current_A'];
    const csvRows = [
      headers.join(','),
      ...filteredData.map(d => 
        [
          new Date(d.timestamp).toISOString(), 
          d.power || 0, 
          d.voltage || 0, 
          d.current || 0
        ].join(',')
      )
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `power_data_${new Date().toISOString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const mainChartOptions = useMemo(() => {
    const powerAlert = alerts.find(alert => alert.metric === 'power' && alert.condition === 'gt');

    return {
      chart: { 
        id: "chart-main", 
        type: "area", 
        height: 350, 
        background: 'transparent', 
        animations: { enabled: true, easing: 'easeinout', speed: 800 }, 
        toolbar: { show: true, tools: { download: true } } 
      },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 2, colors: ['#FBBF24'] },
      fill: { 
        type: "gradient", 
        gradient: { 
          shade: 'dark', 
          type: 'vertical', 
          shadeIntensity: 0.5, 
          gradientToColors: ['#121828'], 
          inverseColors: false, 
          opacityFrom: 0.6, 
          opacityTo: 0.1, 
          stops: [0, 95, 100] 
        } 
      },
      grid: { show: true, borderColor: '#374151', strokeDashArray: 4 },
      xaxis: { 
        type: "datetime", 
        labels: { 
          style: { colors: "#9CA3AF", fontFamily: 'Inter' },
          datetimeUTC: false
        } 
      },
      yaxis: { 
        labels: { 
          formatter: value => `${value.toFixed(0)}W`, 
          style: { colors: "#9CA3AF", fontFamily: 'Inter' } 
        }, 
        min: 0 
      },
      tooltip: { 
        theme: 'dark', 
        style: { fontFamily: 'Inter' },
        x: { format: 'dd MMM HH:mm:ss' }
      },
      legend: { show: false },
      annotations: {
        yaxis: powerAlert ? [
          {
            y: powerAlert.value,
            borderColor: '#ff0000',
            label: {
              borderColor: '#ff0000',
              style: {
                color: '#fff',
                background: '#ff0000',
              },
              text: `Alert: > ${powerAlert.value}W`,
            },
          },
        ] : [],
      },
    };
  }, [alerts]);

  const brushChartOptions = useMemo(() => ({
    chart: { 
      id: "chart-brush", 
      type: "line", 
      height: 100, 
      background: 'transparent', 
      brush: { enabled: true, target: 'chart-main' }, 
      selection: { 
        enabled: true, 
        xaxis: { 
          min: filteredData.length > 0 ? new Date(filteredData[0].timestamp).getTime() : undefined, 
          max: filteredData.length > 0 ? new Date(filteredData[filteredData.length - 1].timestamp).getTime() : undefined 
        } 
      },
      toolbar: { show: false }
    },
    colors: ['#FBBF24'],
    stroke: { width: 1 },
    xaxis: { 
      type: 'datetime', 
      labels: { 
        style: { colors: "#9CA3AF", fontFamily: 'Inter' } 
      } 
    },
    yaxis: { 
      tickAmount: 2, 
      labels: { 
        style: { colors: "#9CA3AF", fontFamily: 'Inter' } 
      } 
    },
    tooltip: { enabled: false }
  }), [filteredData]);

  const chartSeries = useMemo(() => [
    { 
      name: "Power", 
      data: filteredData.map(d => [new Date(d.timestamp).getTime(), d.power || 0]) 
    }
  ], [filteredData]);

  const timeRanges = [1, 6, 12, 24, 72, 168];

  const dismissAlertPopup = () => {
    setShowAlertPopup(false);
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, operation: 'acknowledge' })
      });

      if (response.ok) {
        const updatedAlert = await response.json();
        setAlerts(alerts.map(a => a._id === alertId ? updatedAlert : a));
        setActiveAlerts(activeAlerts.filter(a => a._id !== alertId));
        if (activeAlerts.length <= 1) {
          setShowAlertPopup(false);
        }
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #121828; color: #E5E7EB; margin: 0; padding: 0; }
        .animated-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%); overflow: hidden; }
        .premium-panel { background: rgba(26, 32, 53, 0.7); backdrop-filter: blur(10px); border: 1px solid #374151; border-radius: 1rem; transition: all 0.3s ease; }
        .premium-panel:hover { background: rgba(26, 32, 53, 0.9); border-color: #4B5563; }
        .premium-button { background: transparent; border: 1px solid #4B5563; color: #E5E7EB; transition: all 0.3s ease; cursor: pointer; }
        .premium-button:hover { background: #FBBF24; color: #121828; border-color: #FBBF24; box-shadow: 0 0 15px rgba(251, 191, 36, 0.5); }
        .premium-button.active { background: #FBBF24; color: #121828; border-color: #FBBF24; }
        .metric-value { font-size: 2.25rem; font-weight: 700; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; animation: pulse 1.5s infinite; }
        .status-connected { background: #34D399; } 
        .status-connecting, .status-reconnecting { background: #FBBF24; } 
        .status-disconnected { background: #F87171; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .premium-loader { width: 40px; height: 40px; border: 2px solid #4B5563; border-top-color: #FBBF24; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .premium-input { background: rgba(55, 65, 81, 0.5); border: 1px solid #4B5563; border-radius: 0.5rem; padding: 0.5rem 1rem; width: 100%; color: #E5E7EB; }
        .premium-input:focus { outline: none; border-color: #FBBF24; }
        .alert-popup { position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px; animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .alert-badge { position: absolute; top: -8px; right: -8px; background: #EF4444; color: white; font-size: 0.75rem; font-weight: bold; padding: 0.25rem 0.5rem; border-radius: 9999px; min-width: 20px; text-align: center; }
      `}</style>

      <div className="animated-bg"></div>

      {/* Alert Popup */}
      {showAlertPopup && activeAlerts.length > 0 && (
        <div className="alert-popup">
          <div className="premium-panel p-4 border-2 border-red-500 shadow-lg shadow-red-500/50">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-bold text-red-400">⚠️ Alert Triggered!</h3>
              </div>
              <button 
                onClick={dismissAlertPopup}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeAlerts.map(alert => (
                <div key={alert._id} className="bg-gray-800 p-3 rounded border border-red-900">
                  <p className="text-white font-semibold">{alert.name}</p>
                  <p className="text-sm text-gray-300 mt-1">
                    {alert.metric}: {alert.condition} {alert.value}
                  </p>
                  {alert.message && (
                    <p className="text-sm text-yellow-400 mt-1">{alert.message}</p>
                  )}
                  <button
                    onClick={() => acknowledgeAlert(alert._id)}
                    className="mt-2 text-xs px-3 py-1 bg-green-900 text-green-300 rounded hover:bg-green-800 transition"
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-8 space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-white">Power Grid Monitor</h1>
          {timeLimit === 'realtime' && (
            <div className="flex items-center justify-center space-x-2">
              <div className={`status-dot status-${connectionStatus}`}></div>
              <span className="text-sm text-gray-400 capitalize">{connectionStatus}</span>
            </div>
          )}
        </header>

        <div className="flex justify-center items-center space-x-4 flex-wrap gap-2">
          <div className="premium-panel p-2 flex space-x-2 flex-wrap gap-2">
            <button 
              onClick={() => setTimeLimit('realtime')} 
              className={`premium-button px-4 py-2 rounded-md font-medium ${timeLimit === 'realtime' ? 'active' : ''}`}
            >
              Real-time
            </button>
            {timeRanges.map(range => (
              <button 
                key={range} 
                onClick={() => setTimeLimit(range)} 
                className={`premium-button px-4 py-2 rounded-md font-medium ${timeLimit === range ? 'active' : ''}`}
              >
                {range < 24 ? `${range}H` : `${range / 24}D`}
              </button>
            ))}
          </div>
          <button onClick={handleExportCsv} className="premium-button px-4 py-2 rounded-md font-medium">
            Export CSV
          </button>
          <button 
            onClick={() => setShowModal(true)} 
            className={`premium-button px-4 py-2 rounded-md font-medium relative ${
              activeAlerts.length > 0 ? 'border-red-500 text-red-400 hover:bg-red-900' : ''
            }`}
          >
            Alerts
            {activeAlerts.length > 0 && (
              <span className="alert-badge">{activeAlerts.length}</span>
            )}
          </button>
        </div>

        {showModal && <AlertsModal alerts={alerts} setAlerts={setAlerts} onClose={() => setShowModal(false)} />}

        <div className="premium-panel p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-[450px]">
              <div className="premium-loader"></div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-[450px] text-gray-400">
              No data available. {timeLimit === 'realtime' ? 'Waiting for data...' : 'Try a different time range.'}
            </div>
          ) : (
            <>
              <ApexChartsComponent options={mainChartOptions} series={chartSeries} type="area" height={350} />
              <ApexChartsComponent options={brushChartOptions} series={chartSeries} type="line" height={100} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="premium-panel p-6 md:col-span-1">
             <h3 className="text-gray-400 font-medium mb-4 uppercase tracking-widest text-center">Key Metrics</h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Real-Time Power</span>
                  <span className="metric-value text-xl text-red-400">{(latestData.power || 0).toFixed(1)} W</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Grid Voltage</span>
                  <span className="metric-value text-xl text-blue-400">{(latestData.voltage || 0).toFixed(1)} V</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Current</span>
                  <span className="metric-value text-xl text-yellow-400">{(latestData.current || 0).toFixed(1)} A</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Average Power</span>
                  <span className="metric-value text-xl text-green-400">{averagePower.toFixed(1)} W</span>
                </div>
             </div>
          </div>
          <div className="premium-panel p-6 md:col-span-2">
            <h3 className="text-gray-400 font-medium mb-4 uppercase tracking-widest text-center">Energy & Cost Analysis (India)</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Energy Consumed</span>
                <span className="metric-value text-2xl text-white">{totalEnergyKwh.toFixed(2)} kWh</span>
              </div>
              
              <div className="border-t border-gray-700 pt-3 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Energy Cost (Slab-based)</span>
                  <span className="text-gray-200">₹{costBreakdown.energyCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Fixed Monthly Charge</span>
                  <span className="text-gray-200">₹{costBreakdown.fixedCharge.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-semibold">Total Cost (INR)</span>
                  <span className="metric-value text-2xl text-green-400">₹{costBreakdown.totalInr.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400 text-sm">Approx. USD</span>
                  <span className="text-gray-300">${costBreakdown.totalUsd.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-gray-800 p-3 rounded text-xs text-gray-400 mt-3">
                <p className="mb-1">💡 <strong>Slab Rates:</strong></p>
                <p>0-100 units: ₹3.50 | 101-200: ₹4.50 | 201-300: ₹6.00 | 301-400: ₹7.00 | 400+: ₹8.00</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}