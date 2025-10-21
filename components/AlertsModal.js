import React, { useState } from 'react';

const AlertsModal = ({ alerts, setAlerts, onClose }) => {
  const [metric, setMetric] = useState('power');
  const [condition, setCondition] = useState('gt');
  const [value, setValue] = useState('');

  const handleAddAlert = async () => {
    if (!value) return;
    const newAlert = { metric, condition, value: parseFloat(value) };
    const response = await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newAlert),
    });
    if (response.ok) {
      const createdAlert = await response.json();
      setAlerts([...alerts, createdAlert]);
      setMetric('power');
      setCondition('gt');
      setValue('');
    }
  };

  const handleDeleteAlert = async (id) => {
    const response = await fetch('/api/alerts', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      setAlerts(alerts.filter(alert => alert._id !== id));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1a2035] p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-4">Manage Alerts</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="premium-input mt-1 block w-full"
            >
              <option value="power">Power</option>
              <option value="voltage">Voltage</option>
              <option value="current">Current</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="premium-input mt-1 block w-full"
            >
              <option value="gt">Greater Than</option>
              <option value="lt">Less Than</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="premium-input mt-1 block w-full"
            />
          </div>
          <button
            onClick={handleAddAlert}
            className="premium-button w-full py-2 rounded-md font-medium"
          >
            Add Alert
          </button>
        </div>
        <div className="mt-6">
          <h3 className="text-lg font-medium text-white">Existing Alerts</h3>
          <ul className="mt-2 space-y-2">
            {alerts.map((alert) => (
              <li key={alert._id} className="flex justify-between items-center bg-[#2a3045] p-2 rounded-md">
                <span className="text-white">
                  {alert.metric} {alert.condition === 'gt' ? '>' : '<'} {alert.value}
                </span>
                <button
                  onClick={() => handleDeleteAlert(alert._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={onClose}
          className="premium-button w-full py-2 rounded-md font-medium mt-6"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AlertsModal;
