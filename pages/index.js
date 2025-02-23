// pages/index.js
import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Home() {
  // Data states
  const [aggregatedData, setAggregatedData] = useState([]); // Full day's aggregated view
  const [recentPower, setRecentPower] = useState(0);
  const [avgPower10, setAvgPower10] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(24); // time limit in hours (default 24)
  const [darkMode, setDarkMode] = useState(false);
  const chartRef = useRef(null);

  // Build date string "YYYY-MM-DD" from selectedDate.
  const getDateString = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch daily aggregated data (API always returns the full day’s data)
  const fetchDailyData = async () => {
    const dateStr = getDateString(selectedDate);
    const res = await fetch(`/api/power?date=${dateStr}`);
    const data = await res.json();
    if (data.aggregatedData) {
      setAggregatedData(data.aggregatedData);
    }
    setRecentPower(data.recent);
    setAvgPower10(data.avg10);
    setLastUpdated(new Date());
  };

  // Auto-update every 5 seconds.
  useEffect(() => {
    fetchDailyData();
    const interval = setInterval(fetchDailyData, 5000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Filter the full aggregatedData to get only the last 'timeLimit' hours.
  const displayedData =
    aggregatedData.length > timeLimit
      ? aggregatedData.slice(-timeLimit)
      : aggregatedData;

  // Compute peak power from the displayed (limited) data.
  const displayedPeak =
    displayedData.length > 0
      ? Math.max(...displayedData.map(d => d.avgWatts))
      : 0;

  // Build chart data and options for the limited daily aggregated view.
  const chartData = {
    labels: displayedData.map(d => `${d.hour}:00`),
    datasets: [{
      label: 'Avg Power (W)',
      data: displayedData.map(d => parseFloat(d.avgWatts.toFixed(2))),
      borderColor: darkMode ? '#4fd1c5' : 'rgb(75, 192, 192)',
      backgroundColor: 'transparent',
      tension: 0.3,
    }],
  };

  const chartOptions = {
    responsive: true,
    scales: { y: { beginAtZero: true } },
    animation: { duration: 1000 },
  };

  // Circular meter settings.
  const maxPowerValue = 5000;
  const percentRecent = Math.min((recentPower / maxPowerValue) * 100, 100);
  const percentAvg = Math.min((avgPower10 / maxPowerValue) * 100, 100);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 transition-colors duration-500">
        <div className="container mx-auto p-4 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
            <div className="flex flex-col space-y-1">
              <div className="text-sm text-gray-500 dark:text-gray-300">
                Last updated:{" "}
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                  timeZone: "Asia/Kolkata"
                })}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-300">Select Date:</span>
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    dateFormat="yyyy/MM/dd"
                    className="p-2 rounded shadow border"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-300">Time Limit (hours):</span>
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
                  title="Load data for the selected date"
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

          {/* Line Chart Card */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Daily Power Usage</CardTitle>
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

          {/* Peak Power Card (computed from the limited data) */}
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
