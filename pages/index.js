import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

ChartJS.register(...registerables, zoomPlugin);

export default function Home() {
  const [aggregatedData, setAggregatedData] = useState([]);
  const [recentPower, setRecentPower] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(1); 
  const [totalEnergy, setTotalEnergy] = useState(0);
  const chartRef = useRef(null);

  const fetchDailyData = async () => {
    try {
      const res = await fetch(`/api/power?limit=${timeLimit}`);
      const data = await res.json();
      setAggregatedData(data.aggregatedData);
      setRecentPower(data.recent);
      setTotalEnergy(data.totalEnergy);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchDailyData();
    const interval = setInterval(fetchDailyData, 2000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  const chartData = {
    labels: aggregatedData.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }),
    datasets: [
      {
        label: "Avg Power (W)",
        data: aggregatedData.map(d => parseFloat(d.avgWatts.toFixed(2))),
        borderColor: "#4fd1c5",
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          callback: function(value, index, values) {
            const totalLabels = values.length;
            let step = 1;
            let formatOptions = { hour: "2-digit", minute: "2-digit", hour12: true };

            if (timeLimit > 6) {
              if (totalLabels > 40) {
                step = Math.ceil(totalLabels / 20);
                formatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true };
              } else if (totalLabels > 20) {
                step = 2;
                formatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true };
              } else if (totalLabels > 10) {
                formatOptions = { day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true };
              }
            } else {
              if (totalLabels > 40) {
                step = Math.ceil(totalLabels / 20);
              } else if (totalLabels > 20) {
                step = 2;
              }
            }

            if (index % step === 0) {
              const date = new Date(aggregatedData[index].timestamp);
              return date.toLocaleString([], formatOptions);
            }
            return '';
          }
        }
      }
    },
    animation: { duration: 1000 },
    plugins: {
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Avg Power: ${context.raw} W`;
          }
        }
      }
    },
  };

  const displayedPeak = aggregatedData.length > 0 ? Math.max(...aggregatedData.map(d => d.avgWatts)) : 0;
  const maxPowerValue = 5000;
  const percentRecent = Math.min((recentPower / maxPowerValue) * 100, 100);

  return (
    <div className="dark min-h-screen bg-gray-800 transition-colors duration-500">
      <div className="container mx-auto p-4 space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
          <div className="flex flex-col space-y-1">
            <div className="text-sm text-gray-300">
              Last updated: {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex flex-col">
                <span className="text-sm text-gray-300">
                  Time Limit (hours):
                </span>
                <select
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="p-2 rounded shadow border"
                >
                  <option value={1}>Last 1 Hour</option>
                  <option value={6}>Last 6 Hours</option>
                  <option value={12}>Last 12 Hours</option>
                  <option value={24}>Last 24 Hours</option>
                  <option value={72}>Last 3 Days</option>
                  <option value={168}>Last 1 Week</option>
                </select>
              </div>
              <button
                onClick={fetchDailyData}
                className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition-colors"
              >
                Load Data
              </button>
            </div>
          </div>
        </div>

        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>
              Power Usage (Last {timeLimit} Hour{timeLimit > 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Line data={chartData} options={chartOptions} ref={chartRef} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="hover:shadow-lg transition-shadow duration-300" title="Current Power Usage">
            <CardHeader>
              <CardTitle>Current Power Usage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div style={{ width: 150, height: 150, transition: "all 0.5s ease-in-out" }}>
                <CircularProgressbar
                  value={percentRecent}
                  text={`${recentPower ? recentPower.toFixed(0) : 0}W`}
                  styles={buildStyles({
                    pathColor: "#f88",
                    textColor: "#fff",
                    trailColor: "#555",
                    transition: "stroke-dashoffset 0.5s ease 0s",
                  })}
                />
              </div>
              <p className="text-sm text-gray-300">
                If no update in 10 seconds, it shows 0W.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300" title="Total Energy Used">
            <CardHeader>
              <CardTitle>Total Energy Used</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div style={{ width: 150, height: 150, transition: "all 0.5s ease-in-out" }}>
                <CircularProgressbar
                  value={Math.min((totalEnergy / maxPowerValue) * 100, 100)}
                  text={`${totalEnergy ? totalEnergy.toFixed(2) : 0} kWh`}
                  styles={buildStyles({
                    pathColor: "#4caf50",
                    textColor: "#fff",
                    trailColor: "#555",
                    transition: "stroke-dashoffset 0.5s ease 0s",
                  })}
                />
              </div>
              <p className="text-sm text-gray-300">
                Total energy used in the selected time limit.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="hover:shadow-lg transition-shadow duration-300" title="Peak Power Usage">
          <CardHeader>
            <CardTitle>Peak Power Usage</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {displayedPeak ? displayedPeak.toFixed(0) : 0}W
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
