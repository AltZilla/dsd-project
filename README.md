# Power Grid Monitor

This is a real-time power grid monitoring application built with Next.js, Socket.io, and MongoDB. It simulates data from an ESP32 and displays it in a real-time dashboard.

## Features

*   **Real-time Data Visualization:** View real-time data for power, voltage, and current in a dynamic chart.
*   **Historical Data:** View historical data for different time ranges (1H, 6H, 12H, 24H, 3D, 7D).
*   **Data Aggregation:** Data is aggregated into hourly and daily summaries for efficient querying and long-term analysis.
*   **Cost Estimation:** Estimate the energy cost based on the price per kWh. The price is automatically set based on the user's location, but it can also be manually overridden.
*   **Alerts:** Set up alerts to be notified when a metric (power, voltage, or current) exceeds a certain threshold.
*   **CSV Export:** Export the data to a CSV file.
*   **Real-time Connection Status:** The UI displays the real-time connection status to the server.

## Tech Stack

*   **Frontend:** Next.js, React, ApexCharts, Tailwind CSS
*   **Backend:** Node.js, Socket.io, MongoDB
*   **Deployment:** Vercel

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You also need to create a `.env.local` file in the root of the project and add your MongoDB connection string:

```
MONGODB_URI=<your-mongodb-connection-string>
```

## How it Works

The application consists of three main parts:

1.  **ESP32 Simulator:** The `esp32-simulator.js` script simulates an ESP32 device that sends real-time power grid data to the server every 2 seconds.
2.  **Socket Server:** The `socket-server.js` script is a Node.js server that uses Socket.io to create a websocket connection. It receives the data from the ESP32 simulator, stores it in a MongoDB database, and broadcasts it to all connected clients.
3.  **Frontend:** The frontend is a Next.js application that displays the real-time data in a chart. It also allows users to view historical data, set up alerts, and export data to a CSV file.