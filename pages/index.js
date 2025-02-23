// pages/index.js
import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Helper to check if an hour is within a circular range (0–23)
function inHourRange(hour, start, end) {
  if (start <= end) {
    return hour >= start && hour <= end;
  } else {
    return hour >= start || hour <= end;
  }
}

export default function Home() {
  // Data states
  const [aggregatedData, setAggregatedData] = useState([]); // full day's data (API returns UTC hours)
  const [recentPower, setRecentPower] = useState(0);
  const [avgPower10, setAvgPower10] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(24); // in hours (default: last 24 hours)
  const [darkMode, setDarkMode] = useState(false);
  const chartRef = useRef(null);

  // Get current IST time using Asia/Kolkata timezone.
  const getISTDate = () =>
    new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  // Build a date string "YYYY-MM-DD" from the current IST date.
  const getCurrentISTDateString = () => {
    const nowIST = getISTDate();
    const year = nowIST.getFullYear();
    const month = (nowIST.getMonth() + 1).toString().padStart(2, "0");
    const day = nowIST.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Fetch full day's data from the API (which returns UTC-based hours)
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

  // --- Filtering and Labeling Logic ---

  // We assume that each data point’s d.hour is in UTC.
  // To get a “complete IST hour” label we add 6 hours (instead of 5.5) so that the aggregation
  // (which covers, say, 20:00–20:59 UTC) is labeled as 02:00 (since 20 + 6 = 26 mod 24 = 2).
  // This effectively shows the end time of that complete aggregation period.
  
  // Determine the current IST time.
  const nowIST = getISTDate();
  // For our purposes, define the "last complete hour" as follows:
  // If the current time is not exactly on the hour, assume the last complete hour ended at the current hour.
  // (For example, if now is 2:40, then the complete hour that ended is labeled "02:00".)
  const lastCompleteLabel = (nowIST.getMinutes() === 0 && nowIST.getSeconds() === 0)
    ? (nowIST.getHours() - 1 + 24) % 24
    : nowIST.getHours();

  // We want to display exactly timeLimit points.
  // Compute the start label (inclusive) in IST (as an integer 0–23).
  const startLabel = (lastCompleteLabel - timeLimit + 1 + 24) % 24;

  // For each data point, compute its IST label as an integer hour using our conversion:
  //   IST_label = (d.hour + 6) mod 24
  // Then filter to keep only those points whose label is within the window from startLabel to lastCompleteLabel.
  const displayedData = aggregatedData.filter(d => {
    const labelHour = (d.hour + 6) % 24;
    return inHourRange(labelHour, startLabel, lastCompleteLabel);
  });

  // Build chart labels as formatted strings ("HH:00") from the computed label.
  const chartLabels = displayedData.map(d => {
    const labelHour = (d.hour + 6) % 24;
    return labelHour.toString().padStart(2, "0") + ":00";
  });

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Avg Power (W)",
        data: displayedData.map(d => parseFloat(d.avgWatts.toFixed(2))),
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
      ? Math.max(...displayedData.map(d => d.avgWatts))
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
                Power Usage (Last {timeLimit} Hour{timeLimit > 1 ? "s" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Line data={chartData} options={chartOptions} ref={chartRef} />
            </CardContent>
          </Card>

          {/* Circular Meters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card
              className="hover:shadow-lg transition-shadow duration-300"
              title="Current Power Usage"
            >
              <CardHeader>
                <CardTitle>Current Power Usage</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                <div
                  style={{
                    width: 150,
                    height: 150,
                    transition: "all 0.5s ease-in-out",
                  }}
                >
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

            <Card
              className="hover:shadow-lg transition-shadow duration-300"
              title="10-Minute Average Power"
            >
              <CardHeader>
                <CardTitle>10-Minute Average Power</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                <div
                  style={{
                    width: 150,
                    height: 150,
                    transition: "all 0.5s ease-in-out",
                  }}
                >
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
