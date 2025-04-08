import clientPromise from '@/lib/mongodb';

let recent = 0;
let recent_date = new Date();

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db();

  if (req.method === 'POST') {
    try {
      const { watts } = req.body;
      const now = new Date();
      let energy = watts / (3600 * 1000);
      
      const newEntry = {
        watts: Number(watts),
        timestamp: now,
        energy,
      };

      recent = Number(watts);
      recent_date = now;

      const lastEntry = await db
        .collection('power')
        .findOne({}, { sort: { timestamp: -1 } });

      if (lastEntry) {
        const lastTime = new Date(lastEntry.timestamp);
        let timeDiffSeconds = (now - lastTime) / 1000;

        timeDiffSeconds = Math.min(timeDiffSeconds, 120);

        energy = (watts * timeDiffSeconds) / (3600 * 1000); 

        if (Math.floor(lastTime.getTime() / 60000) === Math.floor(now.getTime() / 60000)) {
        
          const updatedWatts = (lastEntry.watts + Number(watts)) / 2;
          await db.collection('power').updateOne(
            { _id: lastEntry._id },
            {
              $set: { watts: updatedWatts, timestamp: now },
              $inc: { energy }, 
            }
          );

          return res.status(200).json({ success: true });
        }
      }

      await db.collection('power').insertOne(newEntry);

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("POST /api/power error:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'GET') {
    try {
      if (req.query.limit) {
        const limitHours = Number(req.query.limit);
        const now = new Date();
        const startTime = new Date(now.getTime() - limitHours * 3600000);

        const records = await db.collection('power')
          .find({ timestamp: { $gte: startTime } })
          .sort({ timestamp: 1 })
          .toArray();

        let aggregatedData;
        let interval = 1;

        if (records.length > 1000) {
          interval = 10;
        } else if (records.length > 500) {
          interval = 5;
        }

        if (interval > 1) {
          const grouped = {};
          records.forEach(entry => {
            const date = new Date(entry.timestamp);
            const key = Math.floor(date.getTime() / (interval * 60 * 1000));
            if (!grouped[key]) {
              grouped[key] = { sum: 0, count: 0, timestamp: date };
            }
            grouped[key].sum += entry.watts;
            grouped[key].count++;
          });

          aggregatedData = Object.keys(grouped).map(key => ({
            avgWatts: grouped[key].sum / grouped[key].count,
            timestamp: grouped[key].timestamp
          }));
        } else {
          aggregatedData = records.map(entry => ({
            avgWatts: entry.watts,
            timestamp: entry.timestamp
          }));
        }

        let recentPower = 0;
        const diffSec = (new Date() - recent_date) / 1000;
        if (diffSec < 10) recentPower = recent;

        const totalEnergy = records.reduce((sum, entry) => sum + (entry.energy || 0), 0);

        return res.status(200).json({ aggregatedData, recent: recentPower, totalEnergy });
      } else {
        res.status(400).json({ error: 'Limit parameter is required' });
      }
    } catch (error) {
      console.error("GET /api/power error:", error);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}