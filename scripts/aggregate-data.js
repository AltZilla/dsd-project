require('dotenv').config();
const clientPromise = require('../lib/mongodb');

async function aggregateData() {
  try {
    const client = await clientPromise;
    const db = client.db();

    // Hourly Aggregation
    const hourlyAggregation = await db.collection('power_realtime').aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" },
          },
          powerSum: { $sum: "$power" },
          voltageSum: { $sum: "$voltage" },
          currentSum: { $sum: "$current" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          timestamp: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
              hour: "$_id.hour",
            },
          },
          summary: {
            powerSum: "$powerSum",
            voltageSum: "$voltageSum",
            currentSum: "$currentSum",
            count: "$count",
          },
        },
      },
      {
        $merge: {
          into: "power_hourly",
          on: "timestamp",
          whenMatched: "replace",
          whenNotMatched: "insert",
        },
      },
    ]).toArray();

    // Daily Aggregation
    const dailyAggregation = await db.collection('power_hourly').aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
          },
          powerSum: { $sum: "$summary.powerSum" },
          voltageSum: { $sum: "$summary.voltageSum" },
          currentSum: { $sum: "$summary.currentSum" },
          count: { $sum: "$summary.count" },
        },
      },
      {
        $project: {
          _id: 0,
          timestamp: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          summary: {
            powerSum: "$powerSum",
            voltageSum: "$voltageSum",
            currentSum: "$currentSum",
            count: "$count",
          },
        },
      },
      {
        $merge: {
          into: "power_daily",
          on: "timestamp",
          whenMatched: "replace",
          whenNotMatched: "insert",
        },
      },
    ]).toArray();

    console.log("Data aggregation complete.");

  } catch (error) {
    console.error("Error aggregating data:", error);
  } finally {
    // The script is running in a separate process, so we need to close the connection.
    const client = await clientPromise;
    await client.close();
  }
}

aggregateData();
