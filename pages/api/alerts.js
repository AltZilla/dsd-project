import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Alert conditions:
 * - gt: greater than
 * - lt: less than
 * - eq: equal to
 * - gte: greater than or equal
 * - lte: less than or equal
 * 
 * Alert metrics: power, voltage, current
 * Alert actions: email, webhook, notification
 */

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const alertsCollection = db.collection('alerts');
    const alertHistoryCollection = db.collection('alert_history');

    if (req.method === 'GET') {
      const { active, triggered, metric } = req.query;
      
      // Build query filter
      const filter = {};
      if (active !== undefined) filter.active = active === 'true';
      if (triggered !== undefined) filter.triggered = triggered === 'true';
      if (metric) filter.metric = metric;

      const alerts = await alertsCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      
      return res.status(200).json(alerts);

    } else if (req.method === 'POST') {
      const { 
        name, 
        metric, 
        condition, 
        value, 
        actions = [],
        cooldown = 300, // 5 minutes default cooldown
        message 
      } = req.body;

      // Validation
      if (!name || !metric || !condition || value === undefined) {
        return res.status(400).json({ 
          error: 'Missing required fields: name, metric, condition, value' 
        });
      }

      const validMetrics = ['power', 'voltage', 'current'];
      const validConditions = ['gt', 'lt', 'eq', 'gte', 'lte'];

      if (!validMetrics.includes(metric)) {
        return res.status(400).json({ 
          error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}` 
        });
      }

      if (!validConditions.includes(condition)) {
        return res.status(400).json({ 
          error: `Invalid condition. Must be one of: ${validConditions.join(', ')}` 
        });
      }

      const newAlert = {
        name,
        metric,
        condition,
        value: parseFloat(value),
        actions,
        cooldown: parseInt(cooldown),
        message: message || `${metric} ${condition} ${value}`,
        active: true,
        triggered: false,
        lastTriggered: null,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await alertsCollection.insertOne(newAlert);
      
      return res.status(201).json({ 
        ...newAlert, 
        _id: result.insertedId 
      });

    } else if (req.method === 'PUT') {
      const { id, ...updates } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Alert ID is required' });
      }

      // Remove fields that shouldn't be updated directly
      delete updates._id;
      delete updates.createdAt;
      delete updates.triggerCount;
      delete updates.lastTriggered;

      // Update the updatedAt timestamp
      updates.updatedAt = new Date();

      const result = await alertsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      const updatedAlert = await alertsCollection.findOne({ _id: new ObjectId(id) });
      return res.status(200).json(updatedAlert);

    } else if (req.method === 'DELETE') {
      const { id } = req.query.id ? req.query : req.body;

      if (!id) {
        return res.status(400).json({ error: 'Alert ID is required' });
      }

      const result = await alertsCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      return res.status(200).json({ message: 'Alert deleted successfully' });

    } else if (req.method === 'PATCH') {
      // Handle specific operations like toggle active/triggered
      const { id, operation } = req.body;

      if (!id || !operation) {
        return res.status(400).json({ error: 'ID and operation are required' });
      }

      let update = {};

      switch (operation) {
        case 'toggle':
          const alert = await alertsCollection.findOne({ _id: new ObjectId(id) });
          if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
          }
          update = { active: !alert.active, updatedAt: new Date() };
          break;

        case 'reset':
          update = { 
            triggered: false, 
            lastTriggered: null, 
            updatedAt: new Date() 
          };
          break;

        case 'acknowledge':
          update = { 
            triggered: false, 
            updatedAt: new Date() 
          };
          break;

        default:
          return res.status(400).json({ error: 'Invalid operation' });
      }

      const result = await alertsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      const updatedAlert = await alertsCollection.findOne({ _id: new ObjectId(id) });
      return res.status(200).json(updatedAlert);

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error in alerts API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

/**
 * Helper function to check alerts against current data
 * Call this from your power monitoring logic
 */
export async function checkAlerts(currentData) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const alertsCollection = db.collection('alerts');
    const alertHistoryCollection = db.collection('alert_history');

    // Get all active alerts
    const alerts = await alertsCollection.find({ active: true }).toArray();

    const now = new Date();
    const triggeredAlerts = [];

    for (const alert of alerts) {
      // Check cooldown period
      if (alert.lastTriggered) {
        const timeSinceLastTrigger = (now - new Date(alert.lastTriggered)) / 1000;
        if (timeSinceLastTrigger < alert.cooldown) {
          continue; // Skip if still in cooldown
        }
      }

      const currentValue = currentData[alert.metric];
      if (currentValue === undefined) continue;

      let shouldTrigger = false;

      // Check condition
      switch (alert.condition) {
        case 'gt':
          shouldTrigger = currentValue > alert.value;
          break;
        case 'lt':
          shouldTrigger = currentValue < alert.value;
          break;
        case 'gte':
          shouldTrigger = currentValue >= alert.value;
          break;
        case 'lte':
          shouldTrigger = currentValue <= alert.value;
          break;
        case 'eq':
          shouldTrigger = Math.abs(currentValue - alert.value) < 0.01;
          break;
      }

      if (shouldTrigger) {
        // Update alert
        await alertsCollection.updateOne(
          { _id: alert._id },
          {
            $set: {
              triggered: true,
              lastTriggered: now,
              updatedAt: now
            },
            $inc: { triggerCount: 1 }
          }
        );

        // Log to history
        await alertHistoryCollection.insertOne({
          alertId: alert._id,
          alertName: alert.name,
          metric: alert.metric,
          condition: alert.condition,
          threshold: alert.value,
          actualValue: currentValue,
          message: alert.message,
          triggeredAt: now,
          data: currentData
        });

        triggeredAlerts.push({
          ...alert,
          actualValue: currentValue
        });

        // Execute actions
        for (const action of alert.actions) {
          await executeAlertAction(action, alert, currentValue);
        }
      }
    }

    return triggeredAlerts;
  } catch (error) {
    console.error('Error checking alerts:', error);
    return [];
  }
}

/**
 * Execute alert actions (email, webhook, etc.)
 */
async function executeAlertAction(action, alert, actualValue) {
  try {
    switch (action.type) {
      case 'webhook':
        if (action.url) {
          await fetch(action.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alert: alert.name,
              metric: alert.metric,
              condition: alert.condition,
              threshold: alert.value,
              actualValue: actualValue,
              message: alert.message,
              timestamp: new Date()
            })
          });
        }
        break;

      case 'email':
        // Implement email sending logic
        console.log(`Email alert: ${alert.name} - ${alert.message}`);
        break;

      case 'notification':
        // Implement browser notification or push notification
        console.log(`Notification: ${alert.name} - ${alert.message}`);
        break;

      default:
        console.log(`Unknown action type: ${action.type}`);
    }
  } catch (error) {
    console.error('Error executing alert action:', error);
  }
}