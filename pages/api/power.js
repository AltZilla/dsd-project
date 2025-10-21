import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const client = await clientPromise;
      const db = client.db();
      const collection = db.collection('power_realtime');

      const data = {
        power: parseFloat(req.body.power) || 0,
        voltage: parseFloat(req.body.voltage) || 0,
        current: parseFloat(req.body.current) || 0,
        timestamp: new Date(),
      };

      await collection.insertOne(data);
      return res.status(201).json({ message: 'Data inserted', data });
    } catch (error) {
      console.error('Error in /api/power POST:', error);
      return res.status(500).json({ error: 'Failed to insert power data', details: error.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const client = await clientPromise;
      const db = client.db();

      const timeLimit = req.query.timeLimit ? parseInt(req.query.timeLimit) : null;

      // Real-time mode - fetch latest single data point
      if (!timeLimit || timeLimit === 'realtime') {
        const latestData = await db.collection('power_realtime')
          .find()
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray();
        
        if (latestData.length === 0) {
          return res.status(200).json({ 
            power: 0, 
            voltage: 0, 
            current: 0, 
            timestamp: new Date() 
          });
        }

        return res.status(200).json(latestData[0]);
      }

      const startTime = new Date(Date.now() - timeLimit * 3600 * 1000);

      let data = [];

      if (timeLimit <= 1) {
        // Fetch granular data from the last hour
        data = await db.collection('power_realtime')
          .find({ timestamp: { $gte: startTime } })
          .sort({ timestamp: 1 })
          .toArray();

        // If no data in power_realtime, return empty array
        if (data.length === 0) {
          return res.status(200).json([]);
        }

      } else if (timeLimit <= 24) {
        // Try to fetch hourly aggregated data
        const hourlyData = await db.collection('power_hourly')
          .find({ timestamp: { $gte: startTime } })
          .sort({ timestamp: 1 })
          .toArray();

        if (hourlyData.length > 0) {
          data = hourlyData.map(d => ({
            timestamp: d.timestamp,
            power: d.summary.powerSum / d.summary.count,
            voltage: d.summary.voltageSum / d.summary.count,
            current: d.summary.currentSum / d.summary.count,
          }));
        } else {
          // Fallback to realtime data if hourly aggregation doesn't exist
          const realtimeData = await db.collection('power_realtime')
            .find({ timestamp: { $gte: startTime } })
            .sort({ timestamp: 1 })
            .toArray();
          
          if (realtimeData.length > 0) {
            // Sample data to reduce points (take every Nth point)
            const sampleRate = Math.max(1, Math.floor(realtimeData.length / 100));
            data = realtimeData.filter((_, index) => index % sampleRate === 0);
          }
        }

      } else {
        // Try to fetch daily aggregated data
        const dailyData = await db.collection('power_daily')
          .find({ timestamp: { $gte: startTime } })
          .sort({ timestamp: 1 })
          .toArray();

        if (dailyData.length > 0) {
          data = dailyData.map(d => ({
            timestamp: d.timestamp,
            power: d.summary.powerSum / d.summary.count,
            voltage: d.summary.voltageSum / d.summary.count,
            current: d.summary.currentSum / d.summary.count,
          }));
        } else {
          // Fallback to realtime data with heavy sampling
          const realtimeData = await db.collection('power_realtime')
            .find({ timestamp: { $gte: startTime } })
            .sort({ timestamp: 1 })
            .toArray();
          
          if (realtimeData.length > 0) {
            // Sample heavily for long time ranges
            const sampleRate = Math.max(1, Math.floor(realtimeData.length / 200));
            data = realtimeData.filter((_, index) => index % sampleRate === 0);
          }
        }
      }

      res.status(200).json(data);

    } catch (error) {
      console.error('Error in /api/power GET:', error);
      res.status(500).json({ error: 'Failed to fetch power data', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}