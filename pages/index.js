// pages/index.js
import React, { useEffect, useState, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Home() {
  // Data states
  const [aggregatedData, setAggregatedData] = useState([]); // Day-level aggregated view
  const [detailedData, setDetailedData] = useState([]); // Hour-level detailed view
  const [recentPower, setRecentPower] = useState(0);
  const [avgPower10, setAvgPower10] = useState(0);
  const [peakPower, setPeakPower] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // For one-day selection
  const [selectedDate, setSelectedDate] = useState(new Date());

  // For hour-level view (if set, we are drilling down)
  const [selectedHour, setSelectedHour] = useState(null);

  // For theming (dark/light mode)
  const [darkMode, setDarkMode] = useState(false);

  // For client-only rendering of time (avoid server/client mismatch)
  const [mounted, setMounted] = useState(false);
  const [clientTimeZone, setClientTimeZone] = useState('UTC');

  // When mounted, record client timezone.
  useEffect(() => {
    setMounted(true);
    setClientTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // Reference to the chart instance (used for click handling in daily view)
  const chartRef = useRef(null);

  // Build date string "YYYY-MM-DD" from selectedDate.
  const getDateString = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch daily aggregated data.
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

    // Compute peak power from aggregated data.
    if (data.aggregatedData && data.aggregatedData.length) {
      const peak = Math.max(...data.aggregatedData.map(d => d.avgWatts));
      setPeakPower(peak);
    } else {
      setPeakPower(0);
    }
  };

  // Fetch detailed data for a specific hour.
  const fetchHourlyData = async (hour) => {
    const dateStr = getDateString(selectedDate);
    const res = await fetch(`/api/power?date=${dateStr}&hour=${hour}`);
    const data = await res.json();
    if (data.powerData) {
      setDetailedData(data.powerData);
    }
    setRecentPower(data.recent);
    setAvgPower10(data.avg10);
    setLastUpdated(new Date());

    // Compute peak power from detailed records.
    if (data.powerData && data.powerData.length) {
      const peak = Math.max(...data.powerData.map(d => d.watts));
      setPeakPower(peak);
    } else {
      setPeakPower(0);
    }
  };

  // Auto-update every 5 seconds.
  useEffect(() => {
    const updateFunc = selectedHour === null
      ? fetchDailyData
      : () => fetchHourlyData(selectedHour);
    updateFunc(); // Initial call
    const interval = setInterval(updateFunc, 5000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedHour]);

  // Build chart data and options.
  let chartData, chartOptions;
  if (selectedHour === null) {
    // Daily aggregated view: one bar per hour.
    chartData = {
      labels: aggregatedData.map(d => {
        const hour = d.hour;
        const hour12 = (hour % 12) || 12;
        const ampm = hour >= 12 ? 'pm' : 'am';
        return `${hour12}:00 ${ampm}`;
      }),
      datasets: [
        {
          label: 'Avg Power (W)',
          data: aggregatedData.map(d => parseFloat(d.avgWatts.toFixed(2))),
          backgroundColor: darkMode ? '#4fd1c5' : 'rgb(75, 192, 192)',
        },
      ],
    };

    chartOptions = {
      responsive: true,
      // onClick is defined only in daily view.
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          // Retrieve the hour corresponding to the clicked bar.
          const hour = aggregatedData[index].hour;
          setSelectedHour(hour);
        }
      },
      scales: {
        y: { beginAtZero: true },
      },
      animation: { duration: 1000 },
    };
  } else {
    // Hour-level detailed view: one bar per record.
    chartData = {
      labels: detailedData.map(d =>
        // Render time only after mount to use the clientTimeZone.
        mounted
          ? new Date(d.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZone: clientTimeZone
            })
          : ''
      ),
      datasets: [
        {
          label: `Power Usage for ${selectedHour}:00`,
          data: detailedData.map(d => d.watts),
          backgroundColor: darkMode ? '#f6ad55' : 'rgb(255, 159, 64)',
        },
      ],
    };

    // No onClick callback in the hourly view.
    chartOptions = {
      responsive: true,
      scales: {
        y: { beginAtZero: true },
      },
      animation: { duration: 1000 },
    };
  }

  // Circular meter settings (for current and 10-minute average power).
  const maxPowerValue = 5000;
  const percentRecent = Math.min((recentPower / maxPowerValue) * 100, 100);
  const percentAvg = Math.min((avgPower10 / maxPowerValue) * 100, 100);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 transition-colors duration-500">
        <div className="container mx-auto p-4 space-y-8">
          {/* Header with date picker, last updated indicator, and dark/light toggle */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
            <div className="flex flex-col space-y-1">
              <div className="text-sm text-gray-500 dark:text-gray-300">
                Last updated:{" "}
                {mounted
                  ? lastUpdated.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                      timeZone: clientTimeZone,
                    })
                  : "Loading..."}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-300">
                    Select Date:
                  </span>
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => {
                      setSelectedDate(date);
                      setSelectedHour(null); // Reset to daily view when date changes.
                    }}
                    dateFormat="yyyy/MM/dd"
                    className="p-2 rounded shadow border"
                  />
                </div>
                <button
                  onClick={() => {
                    // Manual data reload.
                    if (selectedHour === null) {
                      fetchDailyData();
                    } else {
                      fetchHourlyData(selectedHour);
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition-colors"
                  title="Load data for the selected date/hour"
                >
                  Load Data
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {selectedHour !== null && (
                <button
                  onClick={() => setSelectedHour(null)}
                  className="px-4 py-2 bg-green-500 text-white rounded shadow hover:bg-green-600 transition-colors"
                >
                  Back to Daily View
                </button>
              )}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition-colors"
              >
                {darkMode ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>

          {/* Bar Chart Card */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>
                {selectedHour === null
                  ? "Daily Power Usage (Averaged by Hour)"
                  : `Power Usage Details for ${selectedHour}:00`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Bar data={chartData} options={chartOptions} ref={chartRef} />
            </CardContent>
          </Card>

          {/* Circular Meters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Current Power Meter */}
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

            {/* 10-Minute Average Meter */}
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

          {/* Additional Visualization: Peak Power Card */}
          <Card className="hover:shadow-lg transition-shadow duration-300" title="Peak Power Usage">
            <CardHeader>
              <CardTitle>Peak Power Usage</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {peakPower ? peakPower.toFixed(0) : 0}W
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
