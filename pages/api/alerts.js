const clientPromise = require('@/lib/mongodb');
const { ObjectId } = require('mongodb');

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db();
  const collection = db.collection('alerts');

  if (req.method === 'GET') {
    try {
      const alerts = await collection.find({}).toArray();
      res.status(200).json(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  } else if (req.method === 'POST') {
    try {
      const newAlert = req.body;
      const result = await collection.insertOne(newAlert);
      res.status(201).json({ ...newAlert, _id: result.insertedId });
    } catch (error) {
      console.error('Error creating alert:', error);
      res.status(500).json({ error: 'Failed to create alert' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      await collection.deleteOne({ _id: new ObjectId(id) });
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ error: 'Failed to delete alert' });
    }
  }
}
