import clientPromise from '@/lib/mongodb';

/**
 * Alert Checker Service
 * This runs periodically to check if any alerts should be triggered
 * based on the latest power data
 */

class AlertChecker {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 5000; // Check every 5 seconds
    this.intervalId = null;
  }

  async checkAlerts(currentData) {
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
          if (alert.actions && alert.actions.length > 0) {
            for (const action of alert.actions) {
              await this.executeAlertAction(action, alert, currentValue);
            }
          }
        }
      }

      return triggeredAlerts;
    } catch (error) {
      console.error('Error checking alerts:', error);
      return [];
    }
  }

  async executeAlertAction(action, alert, actualValue) {
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
            console.log(`Webhook sent for alert: ${alert.name}`);
          }
          break;

        case 'email':
          // Implement email sending logic using your preferred service
          // Example: SendGrid, AWS SES, Nodemailer, etc.
          console.log(`Email alert triggered: ${alert.name} - ${alert.message}`);
          
          // Uncomment and configure when you set up email service:
          /*
          await sendEmail({
            to: action.recipient,
            subject: `Alert: ${alert.name}`,
            body: `
              Alert: ${alert.name}
              Metric: ${alert.metric}
              Condition: ${alert.condition} ${alert.value}
              Current Value: ${actualValue}
              Message: ${alert.message}
              Time: ${new Date().toISOString()}
            `
          });
          */
          break;

        case 'sms':
          console.log(`SMS alert triggered: ${alert.name}`);
          // Implement SMS via Twilio, AWS SNS, etc.
          break;

        case 'log':
          console.log(`[ALERT] ${alert.name}: ${alert.metric} ${alert.condition} ${alert.value} (current: ${actualValue})`);
          break;

        default:
          console.log(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error('Error executing alert action:', error);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('Alert checker is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting alert checker service...');

    this.intervalId = setInterval(async () => {
      try {
        const client = await clientPromise;
        const db = client.db();
        
        // Get the latest power data
        const latestData = await db.collection('power_realtime')
          .find()
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray();

        if (latestData.length > 0) {
          await this.checkAlerts(latestData[0]);
        }
      } catch (error) {
        console.error('Error in alert checker loop:', error);
      }
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Alert checker service stopped');
  }

  setCheckInterval(milliseconds) {
    this.checkInterval = milliseconds;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Singleton instance
let alertCheckerInstance = null;

export function getAlertChecker() {
  if (!alertCheckerInstance) {
    alertCheckerInstance = new AlertChecker();
  }
  return alertCheckerInstance;
}

export default AlertChecker;