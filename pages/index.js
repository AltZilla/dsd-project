// pages/index.js
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Home() {
  const [powerData, setPowerData] = useState([]);
  const [recentPower, setRecentPower] = useState(0);
  const [avgPower10, setAvgPower10] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/power');
      const data = await res.json();
      // data returned as { powerData, recent, avg10 }
      setPowerData(data.powerData);
      setRecentPower(data.recent);
      setAvgPower10(data.avg10);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Build dynamic labels for the line chart based on the timestamps
  const chartData = {
    labels: powerData.map(d =>
      new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ),
    datasets: [
      {
        label: 'Power Usage (W)',
        data: powerData.map(d => d.watts),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.1,
      },
    ],
  };

  // Optionally, adjust chart options dynamically based on data length.
  const chartOptions = {
    responsive: true,
    scales: {
      x: {
        // If you prefer a time scale, you can enable this (requires appropriate date adapter)
        // type: 'time',
        // time: { unit: 'minute' }
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  // Define maximum values for the circular meters (you may adjust these based on your context)
  const maxPowerValue = 5000; // for example, the meter scales up to 5000W
  const percentRecent = Math.min((recentPower / maxPowerValue) * 100, 100);
  const percentAvg = Math.min((avgPower10 / maxPowerValue) * 100, 100);

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Line Chart Card */}
      <Card>
        <CardHeader>
          <CardTitle>Power Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Line data={chartData} options={chartOptions} />
        </CardContent>
      </Card>

      {/* Circular Meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Current Power Meter */}
        <Card>
          <CardHeader>
            <CardTitle>Current Power Usage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div style={{ width: 150, height: 150 }}>
              <CircularProgressbar
                value={percentRecent}
                text={`${recentPower ? recentPower.toFixed(0) : 0}W`}
                styles={buildStyles({
                  pathColor: '#f88',
                  textColor: '#333',
                })}
              />
            </div>
            <p className="text-sm">If no update in 10 seconds, it shows 0W.</p>
          </CardContent>
        </Card>

        {/* 10-Minute Average Meter */}
        <Card>
          <CardHeader>
            <CardTitle>10-Minute Average Power</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div style={{ width: 150, height: 150 }}>
              <CircularProgressbar
                value={percentAvg}
                text={`${avgPower10 ? avgPower10.toFixed(0) : 0}W`}
                styles={buildStyles({
                  pathColor: '#4caf50',
                  textColor: '#333',
                })}
              />
            </div>
            <p className="text-sm">Average computed from the last 10 minutes.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
