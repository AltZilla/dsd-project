// pages/api/power.js
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db(); // adjust if you need a specific database name

  if (req.method === 'POST') {
    try {
      const { watts } = req.body;
      const now = new Date();
      const newEntry = {
        watts: Number(watts),
        timestamp: now,
      };

      // Check if the last entry is in the same minute
      const lastEntry = await db
        .collection('power')
        .findOne({}, { sort: { timestamp: -1 } });
      if (lastEntry) {
        const lastTime = new Date(lastEntry.timestamp);
        if (Math.floor(lastTime.getTime() / 60000) === Math.floor(now.getTime() / 60000)) {
          const updatedWatts = (lastEntry.watts + Number(watts)) / 2;
          await db.collection('power').updateOne(
            { _id: lastEntry._id },
            { $set: { watts: updatedWatts, timestamp: now } }
          );
          return res.status(200).json({ success: true });
        }
      }

      // Otherwise, insert a new reading.
      await db.collection('power').insertOne(newEntry);

      // Optionally, remove entries older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db.collection('power').deleteMany({ timestamp: { $lt: oneDayAgo } });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("POST /api/power error:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'GET') {
    try {
      // Get the date parameter (format: YYYY-MM-DD). Default to today.
      let { date, hour } = req.query;
      let startDate;
      if (date) {
        startDate = new Date(date);
      } else {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      }

      // If an hour is provided, return detailed records for that hour.
      if (hour !== undefined) {
        const hourNumber = parseInt(hour, 10);
        let hourStart = new Date(startDate);
        hourStart.setHours(hourNumber, 0, 0, 0);
        let hourEnd = new Date(hourStart);
        hourEnd.setHours(hourNumber + 1);

        const powerData = await db
          .collection('power')
          .find({ timestamp: { $gte: hourStart, $lt: hourEnd } })
          .sort({ timestamp: 1 })
          .toArray();

        // Compute recent reading and 10-minute average as before.
        const lastEntry = await db
          .collection('power')
          .findOne({}, { sort: { timestamp: -1 } });
        let recent = 0;
        if (lastEntry) {
          const diffSec = (new Date() - new Date(lastEntry.timestamp)) / 1000;
          if (diffSec < 10) recent = lastEntry.watts;
        }
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentEntries = powerData.filter(entry => new Date(entry.timestamp) >= tenMinsAgo);
        let avg10 = 0;
        if (recentEntries.length > 0) {
          avg10 = recentEntries.reduce((sum, entry) => sum + entry.watts, 0) / recentEntries.length;
        }

        return res.status(200).json({ powerData, recent, avg10 });
      } else {
        // Daily aggregated view: we want one value per hour (0 to 23) in IST.
        let dayStart = new Date(startDate);
        dayStart.setHours(0, 0, 0, 0);
        let dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const allData = await db
          .collection('power')
          .find({ timestamp: { $gte: dayStart, $lt: dayEnd } })
          .toArray();

        // Aggregate data by hour in IST.
        const aggregatedData = [];
        for (let hr = 0; hr < 24; hr++) {
          const records = allData.filter(entry => {
            // Convert the entry timestamp to IST and extract the hour.
            const istHour = Number(
              new Date(entry.timestamp)
                .toLocaleString("en-US", { hour: "2-digit", hour12: false })
            );
            return istHour === hr;
          });
          const avgWatts =
            records.length > 0
              ? records.reduce((sum, rec) => sum + rec.watts, 0) / records.length
              : 0;
          aggregatedData.push({ hour: hr, avgWatts });
        }

        // Compute the recent reading (global) and 10-minute average.
        const lastEntry = await db
          .collection('power')
          .findOne({}, { sort: { timestamp: -1 } });
        let recent = 0;
        if (lastEntry) {
          const diffSec = (new Date() - new Date(lastEntry.timestamp)) / 1000;
          if (diffSec < 10) recent = lastEntry.watts;
        }
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentEntries = allData.filter(
          entry => new Date(entry.timestamp) >= tenMinsAgo
        );
        let avg10 = 0;
        if (recentEntries.length > 0) {
          avg10 = recentEntries.reduce((sum, entry) => sum + entry.watts, 0) / recentEntries.length;
        }

        return res.status(200).json({ aggregatedData, recent, avg10 });
      }
    } catch (error) {
      console.error("GET /api/power error:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}