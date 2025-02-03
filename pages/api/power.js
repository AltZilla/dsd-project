let powerData = [];
let recent = 0;

export default function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // Add new entry with server-side timestamp
      const newEntry = {
        watts: req.body.watts,
        timestamp: new Date()
      };

      var re = 0;
      if (powerData.length > 0) {
        var endTime = new Date();
        var startTime = powerData[powerData.length - 1]["timestamp"];  // Access the last element correctly
        var difference = endTime.getTime() - startTime.getTime(); // Difference in milliseconds
        var resultInMinutes = Math.round(difference / 60000); // Convert milliseconds to minutes

        if (resultInMinutes === 0) {
          // If the new entry is within the same minute, average the watts
          powerData[powerData.length - 1]["watts"] = (powerData[powerData.length - 1]["watts"] + req.body.watts) / 2;
          re = 1;
        }
      }

      if (re === 0) {
        // If no existing entry for the same minute, add the new entry
        powerData.push(newEntry);
      }

      // Keep only the last hour of data to prevent memory issues
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      powerData = powerData.filter(entry => new Date(entry.timestamp) >= oneHourAgo);
      recent = req.body.watts;
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'GET') {
    res.status(200).json([powerData, recent]);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
