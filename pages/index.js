import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  const [aggregatedData, setAggregatedData] = useState([]);
  const [recentPower, setRecentPower] = useState(0);
  const [avgPower10, setAvgPower10] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(1); // Default to 1 hour
  const [darkMode, setDarkMode] = useState(false);
  const chartRef = useRef(null);

  // Fetch data using the rolling window approach.
  const fetchDailyData = async () => {
    try {
      const res = await fetch(`/api/power?limit=${timeLimit}`);
      const data = await res.json();
      setAggregatedData(data.aggregatedData);
      setRecentPower(data.recent);
      setAvgPower10(data.avg10);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchDailyData();
    const interval = setInterval(fetchDailyData, 5000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  // Build chart labels from the API's "label" property.
  const chartLabels = aggregatedData.map(d => {
    const date = new Date(d.timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  });

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Avg Power (W)",
        data: aggregatedData.map(d => parseFloat(d.avgWatts.toFixed(2))),
        borderColor: darkMode ? "#4fd1c5" : "rgb(75, 192, 192)",
        backgroundColor: "transparent",
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    scales: { y: { beginAtZero: true } },
    animation: { duration: 1000 },
  };

  const displayedPeak = aggregatedData.length > 0 ? Math.max(...aggregatedData.map(d => d.avgWatts)) : 0;
  const maxPowerValue = 5000;
  const percentRecent = Math.min((recentPower / maxPowerValue) * 100, 100);
  const percentAvg = Math.min((avgPower10 / maxPowerValue) * 100, 100);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 transition-colors duration-500">
        <div className="container mx-auto p-4 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
            <div className="flex flex-col space-y-1">
              <div className="text-sm text-gray-500 dark:text-gray-300">
                Last updated: {new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-300">
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
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition-colors"
              >
                {darkMode ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>

          {/* Line Chart */}
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

          {/* Circular Meters */}
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
                      textColor: darkMode ? "#fff" : "#333",
                      trailColor: darkMode ? "#555" : "#d6d6d6",
                      transition: "stroke-dashoffset 0.5s ease 0s",
                    })}
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  If no update in 10 seconds, it shows 0W.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300" title="10-Minute Average Power">
              <CardHeader>
                <CardTitle>10-Minute Average Power</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                <div style={{ width: 150, height: 150, transition: "all 0.5s ease-in-out" }}>
                  <CircularProgressbar
                    value={percentAvg}
                    text={`${avgPower10 ? avgPower10.toFixed(0) : 0}W`}
                    styles={buildStyles({
                      pathColor: "#4caf50",
                      textColor: darkMode ? "#fff" : "#333",
                      trailColor: darkMode ? "#555" : "#d6d6d6",
                      transition: "stroke-dashoffset 0.5s ease 0s",
                    })}
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  Average computed from the last 10 minutes.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Peak Power */}
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
    </div>
  );
}
