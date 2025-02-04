// pages/api/power.js
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db(); // specify your database if needed

  if (req.method === 'POST') {
    try {
      const { watts } = req.body;
      const now = new Date();
      const newEntry = {
        watts: Number(watts),
        timestamp: now,
      };

      // Find the latest entry (if any)
      const lastEntry = await db
        .collection("power")
        .findOne({}, { sort: { timestamp: -1 } });

      // If the last entry was recorded in the same minute, average the values.
      if (lastEntry) {
        const lastTime = new Date(lastEntry.timestamp);
        if (
          Math.floor(lastTime.getTime() / 60000) ===
          Math.floor(now.getTime() / 60000)
        ) {
          const updatedWatts = (lastEntry.watts + Number(watts)) / 2;
          await db
            .collection("power")
            .updateOne(
              { _id: lastEntry._id },
              { $set: { watts: updatedWatts, timestamp: now } }
            );
          return res.status(200).json({ success: true });
        }
      }

      // Otherwise, insert a new reading.
      await db.collection("power").insertOne(newEntry);

      // Optional: you could also remove very old entries here if needed.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      await db
        .collection("power")
        .deleteMany({ timestamp: { $lt: oneHourAgo } });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("POST /api/power error:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'GET') {
    try {
      // Get all data for the last hour for the line chart.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const powerData = await db
        .collection("power")
        .find({ timestamp: { $gte: oneHourAgo } })
        .sort({ timestamp: 1 })
        .toArray();

      // Get the most recent reading.
      const lastEntry = await db
        .collection("power")
        .findOne({}, { sort: { timestamp: -1 } });
      let recent = 0;
      if (lastEntry) {
        const diffSec = (new Date() - new Date(lastEntry.timestamp)) / 1000;
        if (diffSec < 10) {
          recent = lastEntry.watts;
        }
      }

      // Calculate the average power for the last 10 minutes.
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentEntries = await db
        .collection("power")
        .find({ timestamp: { $gte: tenMinsAgo } })
        .toArray();
      let avg10 = 0;
      if (recentEntries.length > 0) {
        const total = recentEntries.reduce(
          (acc, entry) => acc + entry.watts,
          0
        );
        avg10 = total / recentEntries.length;
      }

      res.status(200).json({ powerData, recent, avg10 });
    } catch (error) {
      console.error("GET /api/power error:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
