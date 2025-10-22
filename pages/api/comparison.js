import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection('power_realtime');

    const now = new Date();
    
    // Helper function to calculate total energy (kWh) for a time range
    const calculateEnergy = async (startDate, endDate) => {
      const data = await collection
        .find({
          timestamp: {
            $gte: startDate,
            $lt: endDate
          }
        })
        .sort({ timestamp: 1 })
        .toArray();

      if (data.length === 0) return 0;

      // Calculate energy using trapezoidal rule (more accurate)
      let totalEnergy = 0;
      for (let i = 1; i < data.length; i++) {
        const power1 = data[i - 1].power || 0;
        const power2 = data[i].power || 0;
        const time1 = new Date(data[i - 1].timestamp).getTime();
        const time2 = new Date(data[i].timestamp).getTime();
        
        const avgPower = (power1 + power2) / 2; // Average power between two points
        const timeHours = (time2 - time1) / (1000 * 3600); // Time difference in hours
        
        totalEnergy += (avgPower / 1000) * timeHours; // Energy in kWh
      }

      return totalEnergy;
    };

    // Get start of today (00:00:00)
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Get start of yesterday
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    // Get start of this week (Monday)
    const startOfThisWeek = new Date(now);
    const dayOfWeek = startOfThisWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
    startOfThisWeek.setDate(startOfThisWeek.getDate() + diff);
    startOfThisWeek.setHours(0, 0, 0, 0);

    // Get start of last week
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    
    const endOfLastWeek = new Date(startOfThisWeek);

    // Get start of this month
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get start of last month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(startOfThisMonth);

    // Calculate energy for each period
    const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth] = await Promise.all([
      calculateEnergy(startOfToday, now),
      calculateEnergy(startOfYesterday, startOfToday),
      calculateEnergy(startOfThisWeek, now),
      calculateEnergy(startOfLastWeek, endOfLastWeek),
      calculateEnergy(startOfThisMonth, now),
      calculateEnergy(startOfLastMonth, endOfLastMonth)
    ]);

    res.status(200).json({
      today,
      yesterday,
      thisWeek,
      lastWeek,
      thisMonth,
      lastMonth,
      calculatedAt: now.toISOString()
    });

  } catch (error) {
    console.error('Error in /api/comparison:', error);
    res.status(500).json({ 
      error: 'Failed to fetch comparison data', 
      details: error.message 
    });
  }
}