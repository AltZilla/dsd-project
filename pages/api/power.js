import clientPromise from '@/lib/mongodb';

let recent = 0;
let recent_date = new Date();

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

      // Update global recent variables
      recent = Number(watts);
      recent_date = now;

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
      // If a "limit" parameter is provided, do a rolling window aggregation.
      if (req.query.limit) {
        const limitHours = Number(req.query.limit);
        const now = new Date();
        const startTime = new Date(now.getTime() - limitHours * 3600000);

        // Query all records with timestamp >= startTime
        const records = await db.collection('power')
          .find({ timestamp: { $gte: startTime } })
          .toArray();

        // Group records by minute
        const grouped = {};
        records.forEach(entry => {
          const date = new Date(entry.timestamp);
          const key = date.getHours().toString().padStart(2, '0') + ":" +
                      date.getMinutes().toString().padStart(2, '0');
          if (!grouped[key]) {
            grouped[key] = { sum: 0, count: 0, timestamp: date };
          }
          grouped[key].sum += entry.watts;
          grouped[key].count++;
        });

        const aggregatedData = Object.keys(grouped)
          .map(key => ({
            label: key,
            avgWatts: grouped[key].sum / grouped[key].count,
            timestamp: grouped[key].timestamp
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        // Compute recent reading (if the last record was within 10 seconds)
        let recentPower = 0;
        const diffSec = (new Date() - recent_date) / 1000;
        if (diffSec < 10) recentPower = recent;

        // Compute 10-minute average using records from the last 10 minutes
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentEntries = records.filter(entry => new Date(entry.timestamp) >= tenMinsAgo);
        let avg10 = 0;
        if (recentEntries.length > 0) {
          avg10 = recentEntries.reduce((sum, entry) => sum + entry.watts, 0) / recentEntries.length;
        }

        return res.status(200).json({ aggregatedData, recent: recentPower, avg10 });
      } else {
        // Otherwise, use the existing daily aggregated view.
        let { date, hour } = req.query;
        let startDate;
        if (date) {
          startDate = new Date(date);
        } else {
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
        }

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

          const lastEntry = await db
            .collection('power')
            .findOne({}, { sort: { timestamp: -1 } });
          let recentPower = 0;
          const diffSec = (new Date() - recent_date) / 1000;
          if (diffSec < 10) recentPower = recent;

          const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
          const recentEntries = powerData.filter(entry => new Date(entry.timestamp) >= tenMinsAgo);
          let avg10 = 0;
          if (recentEntries.length > 0) {
            avg10 = recentEntries.reduce((sum, entry) => sum + entry.watts, 0) / recentEntries.length;
          }
          return res.status(200).json({ powerData, recent: recentPower, avg10 });
        } else {
          // Daily aggregated view (one value per hour in IST)
          let dayStart = new Date(startDate);
          dayStart.setHours(0, 0, 0, 0);
          let dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const allData = await db
            .collection('power')
            .find({ timestamp: { $gte: dayStart, $lt: dayEnd } })
            .toArray();

          const aggregatedData = [];
          for (let hr = 0; hr < 24; hr++) {
            const records = allData.filter(entry => {
              const istHour = Number(
                new Date(entry.timestamp)
                  .toLocaleString("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
              );
              return istHour === hr;
            });
            const avgWatts =
              records.length > 0
                ? records.reduce((sum, rec) => sum + rec.watts, 0) / records.length
                : 0;
            aggregatedData.push({ hour: hr, avgWatts });
          }

          const lastEntry = await db
            .collection('power')
            .findOne({}, { sort: { timestamp: -1 } });
          let recentPower = 0;
          const diffSec = (new Date() - recent_date) / 1000;
          if (diffSec < 10) recentPower = recent;

          const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
          const recentEntries = allData.filter(
            entry => new Date(entry.timestamp) >= tenMinsAgo
          );
          let avg10 = 0;
          if (recentEntries.length > 0) {
            avg10 = recentEntries.reduce((sum, entry) => sum + entry.watts, 0) / recentEntries.length;
          }
          return res.status(200).json({ aggregatedData, recent: recentPower, avg10 });
        }
      }
    } catch (error) {
      console.error("GET /api/power error:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
