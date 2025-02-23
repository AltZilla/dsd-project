// pages/index.js
import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  // Data states
  const [aggregatedData, setAggregatedData] = useState([]); // full day's data (API returns UTC hours)
  const [recentPower, setRecentPower] = useState(0);
  const [avgPower10, setAvgPower10] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(24); // in hours (default: last 24 hours)
  const [darkMode, setDarkMode] = useState(false);
  const chartRef = useRef(null);

  // Helper: Get current time in IST (using Asia/Kolkata)
  const getISTDate = () =>
    new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  // Build date string "YYYY-MM-DD" from current IST date
  const getCurrentISTDateString = () => {
    const nowIST = getISTDate();
    const year = nowIST.getFullYear();
    const month = (nowIST.getMonth() + 1).toString().padStart(2, "0");
    const day = nowIST.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Fetch full day's data from API (which returns UTC-based hours)
  const fetchDailyData = async () => {
    const dateStr = getCurrentISTDateString();
    const res = await fetch(`/api/power?date=${dateStr}`);
    const data = await res.json();
    if (data.aggregatedData) {
      setAggregatedData(data.aggregatedData);
    }
    setRecentPower(data.recent);
    setAvgPower10(data.avg10);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchDailyData();
    const interval = setInterval(fetchDailyData, 5000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  // Convert current IST to UTC by subtracting 5.5 hours.
  const nowIST = getISTDate();
  const nowUTC = new Date(nowIST.getTime() - 5.5 * 3600 * 1000);
  const currentUTC_Hour = nowUTC.getHours();
  const lowerBoundUTC = Math.max(0, currentUTC_Hour - timeLimit + 1);

  // Filter the aggregated data (which is in UTC hours) to include only points from lowerBoundUTC to currentUTC_Hour.
  const displayedData = aggregatedData.filter(
    (d) => d.hour >= lowerBoundUTC && d.hour <= currentUTC_Hour
  );

  // Helper function: Add 5 hours and 30 minutes directly to a UTC hour and format it as IST.
  const formatISTTime = (utcHour) => {
    // Convert hour to minutes and add 330 minutes (5h30m)
    let totalMinutes = utcHour * 60 + 330;
    totalMinutes = totalMinutes % (24 * 60); // wrap around 24 hours if necessary
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    // Create a temporary date to format the time
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  };

  // Build chart labels by converting each UTC hour (from the API) to IST time by adding 5:30.
  const chartLabels = displayedData.map((d) => formatISTTime(d.hour));

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Avg Power (W)",
        data: displayedData.map((d) => parseFloat(d.avgWatts.toFixed(2))),
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

  // Compute peak power from the displayed data.
  const displayedPeak =
    displayedData.length > 0
      ? Math.max(...displayedData.map((d) => d.avgWatts))
      : 0;

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
                Last updated:{" "}
                {getISTDate().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                  timeZone: "Asia/Kolkata",
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
                  title="Load data for current time"
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
              <CardTitle>
                Power Usage (Last {timeLimit} Hours)
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

          {/* Peak Power Card */}
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
