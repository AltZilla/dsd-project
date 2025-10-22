import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Alert History API
 * GET: Fetch alert history with filtering and pagination
 * DELETE: Clear old history entries
 */

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const alertHistoryCollection = db.collection('alert_history');

    if (req.method === 'GET') {
      const { 
        alertId, 
        metric, 
        limit = 100, 
        skip = 0,
        startDate,
        endDate 
      } = req.query;

      // Build query filter
      const filter = {};
      
      if (alertId) {
        filter.alertId = new ObjectId(alertId);
      }
      
      if (metric) {
        filter.metric = metric;
      }

      // Date range filter
      if (startDate || endDate) {
        filter.triggeredAt = {};
        if (startDate) {
          filter.triggeredAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.triggeredAt.$lte = new Date(endDate);
        }
      }

      // Fetch history with pagination
      const history = await alertHistoryCollection
        .find(filter)
        .sort({ triggeredAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .toArray();

      // Get total count for pagination
      const total = await alertHistoryCollection.countDocuments(filter);

      // Get statistics
      const stats = await alertHistoryCollection.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$alertName',
            count: { $sum: 1 },
            lastTriggered: { $max: '$triggeredAt' }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray();

      return res.status(200).json({
        history,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        },
        stats
      });

    } else if (req.method === 'DELETE') {
      const { olderThan, alertId } = req.body;

      const filter = {};

      // Delete entries older than a specific date
      if (olderThan) {
        filter.triggeredAt = { $lt: new Date(olderThan) };
      }

      // Delete entries for a specific alert
      if (alertId) {
        filter.alertId = new ObjectId(alertId);
      }

      // Require at least one filter to prevent accidental deletion of all history
      if (Object.keys(filter).length === 0) {
        return res.status(400).json({ 
          error: 'Must specify olderThan date or alertId' 
        });
      }

      const result = await alertHistoryCollection.deleteMany(filter);

      return res.status(200).json({
        message: 'Alert history deleted',
        deletedCount: result.deletedCount
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error in alert history API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}