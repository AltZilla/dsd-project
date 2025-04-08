import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const ApexChartsComponent = dynamic(() => import("react-apexcharts"), { ssr: false });
let ApexCharts;

if (typeof window !== "undefined") {
  ApexCharts = require("apexcharts");
}

export default function Home() {
  const [aggregatedData, setAggregatedData] = useState([]);
  const [recentPower, setRecentPower] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLimit, setTimeLimit] = useState(1);
  const [totalEnergy, setTotalEnergy] = useState(0);

  const timeRanges = [
    { label: "1H", value: 1 },
    { label: "6H", value: 6 },
    { label: "12H", value: 12 },
    { label: "1D", value: 24 },
    { label: "3D", value: 72 },
    { label: "1W", value: 168 },
  ];

  const fetchDailyData = async () => {
    try {
      const res = await fetch(`/api/power?limit=${timeLimit}`);
      const data = await res.json();
      setAggregatedData(data.aggregatedData);
      setRecentPower(data.recent || 0);
      setTotalEnergy(data.totalEnergy || 0);
      setLastUpdated(new Date());

      if (ApexCharts) {
        ApexCharts.exec("area-datetime", "updateSeries", [
          {
            name: "Avg Power (W)",
            data: data.aggregatedData.map((d) => [new Date(d.timestamp).getTime(), d.avgWatts]),
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchDailyData();
    const interval = setInterval(fetchDailyData, 2000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  const chartOptions = {
    chart: {
      id: "area-datetime",
      type: "area",
      height: 350,
      zoom: {
        enabled: false,
      },
      animations: {
        enabled: true,
        delay: 1000,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 2.5,
    },
    xaxis: {
      type: "datetime",
      labels: {
        formatter: function (value, timestamp) {
          const date = new Date(timestamp);
          if (timeLimit > 24) {
            return date.toLocaleString([], {
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
          } else {
            return date.toLocaleString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
          }
        },
        style: {
          colors: "#ffffff",
        },
      },
    },
    yaxis: {
      title: {
        text: "Avg Power (W)",
        style: {
          color: "#ffffff",
        },
      },
      labels: {
        formatter: function (value) {
          return value.toFixed(2);
        },
        style: {
          colors: "#ffffff",
        },
      },
      min: 0,
    },
    tooltip: {
      theme: "dark",
      style: {
        fontSize: "12px",
        fontFamily: undefined,
      },
      x: {
        format: "dd MMM yyyy HH:mm",
      },
      y: {
        formatter: function (value) {
          return value.toFixed(2);
        },
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.9,
        stops: [0, 100],
      },
    },
  };

  const chartSeries = aggregatedData.length
    ? [
        {
          name: "Avg Power (W)",
          data: aggregatedData.map((d) => [
            new Date(d.timestamp).getTime(),
            parseFloat(d.avgWatts.toFixed(2)),
          ]),
        },
      ]
    : [
        {
          name: "Avg Power (W)",
          data: [],
        },
      ];

  const displayedPeak = aggregatedData.length > 0 ? Math.max(...aggregatedData.map((d) => d.avgWatts)) : 0;

  return (
    <div className="dark min-h-screen bg-gray-800 transition-colors duration-500">
      <div className="container mx-auto p-4 space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
          <div className="flex flex-col space-y-1">
            <div className="text-sm text-gray-300">
              Last updated: {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-2">
                {timeRanges.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setTimeLimit(range.value)}
                    className={`px-4 py-2 rounded shadow ${
                      timeLimit === range.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    } transition-colors`}
                  >
                    {range.label}
                  </button>
                ))}
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
            <ApexChartsComponent
              options={chartOptions}
              series={chartSeries}
              type="area"
              height={350}
            />
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
                  value={recentPower}
                  text={`${recentPower ? recentPower.toFixed(0) : 0}W`}
                  styles={buildStyles({
                    pathColor: "#f88",
                    textColor: "#fff",
                    trailColor: "#555",
                    transition: "stroke-dashoffset 0.5s ease 0s",
                  })}
                />
              </div>
              <p className="text-sm text-gray-300">If no update in 10 seconds, it shows 0W.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300" title="Total Energy Used">
            <CardHeader>
              <CardTitle>Total Energy Used</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div style={{ width: 150, height: 150, transition: "all 0.5s ease-in-out" }}>
                <CircularProgressbar
                  value={totalEnergy}
                  text={`${totalEnergy ? totalEnergy.toFixed(2) : 0} kWh`}
                  styles={buildStyles({
                    pathColor: "#4caf50",
                    textColor: "#fff",
                    trailColor: "#555",
                    transition: "stroke-dashoffset 0.5s ease 0s",
                  })}
                />
              </div>
              <p className="text-sm text-gray-300">Total energy used in the selected time limit.</p>
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
