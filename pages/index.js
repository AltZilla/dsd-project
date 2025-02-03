import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Home() {
  const [powerData, setPowerData] = useState([]);
  const [recentPower, setRecentPower] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/power');
      const data = await res.json();
      setPowerData(data[0]);
      setRecentPower(data[1]);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: powerData.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [{ label: 'Power Usage (W)', data: powerData.map(d => d.watts), borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)' }]
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <Card>
        <CardHeader><CardTitle>Power Usage Over Time</CardTitle></CardHeader>
        <CardContent><Line data={chartData} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Current Power Meter</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center">
          <div className="text-4xl font-bold">{powerData.length ? recentPower : 0} Watts</div>
        </CardContent>
      </Card>
    </div>
  );
}
