import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db();

  if (req.method === 'GET') {
    try {
      if (req.query.limit) {
        const limitHours = Number(req.query.limit);
        const now = new Date();
        const startTime = new Date(now.getTime() - limitHours * 3600000);

        const records = await db.collection('power_realtime')
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
              grouped[key] = { voltage: 0, current: 0, power: 0, count: 0, timestamp: date };
            }
            grouped[key].voltage += Number(entry.voltage);
            grouped[key].current += Number(entry.current);
            grouped[key].power += Number(entry.power);
            grouped[key].count++;
          });

          aggregatedData = Object.keys(grouped).map(key => ({
            avgVoltage: grouped[key].voltage / grouped[key].count,
            avgCurrent: grouped[key].current / grouped[key].count,
            avgWatts: grouped[key].power / grouped[key].count,
            timestamp: grouped[key].timestamp
          }));
        } else {
          aggregatedData = records.map(entry => ({
            avgVoltage: Number(entry.voltage),
            avgCurrent: Number(entry.current),
            avgWatts: Number(entry.power),
            timestamp: entry.timestamp
          }));
        }

        const latestRecord = await db.collection('power_realtime').findOne({}, { sort: { timestamp: -1 } });

        return res.status(200).json({ aggregatedData, recent: latestRecord });
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