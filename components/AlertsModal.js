import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Power, AlertTriangle, Bell, BellOff, Check } from 'lucide-react';

export default function AlertsModal({ alerts, setAlerts, onClose }) {
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
  const [alertHistory, setAlertHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    metric: 'power',
    condition: 'gt',
    value: '',
    cooldown: 300,
    message: '',
    actions: []
  });

  // Fetch alert history when tab changes
  useEffect(() => {
    if (activeTab === 'history') {
      fetchAlertHistory();
    }
  }, [activeTab]);

  const fetchAlertHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/alert-history?limit=50');
      if (response.ok) {
        const data = await response.json();
        setAlertHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching alert history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.value) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          value: parseFloat(formData.value),
          actions: [{ type: 'log' }] // Default action
        })
      });

      if (response.ok) {
        const newAlert = await response.json();
        setAlerts([...alerts, newAlert]);
        setFormData({
          name: '',
          metric: 'power',
          condition: 'gt',
          value: '',
          cooldown: 300,
          message: '',
          actions: []
        });
        setIsCreating(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating alert:', error);
      alert('Failed to create alert');
    }
  };

  const handleDeleteAlert = async (id) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      const response = await fetch('/api/alerts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        setAlerts(alerts.filter(a => a._id !== id));
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleToggleAlert = async (id) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operation: 'toggle' })
      });

      if (response.ok) {
        const updatedAlert = await response.json();
        setAlerts(alerts.map(a => a._id === id ? updatedAlert : a));
      }
    } catch (error) {
      console.error('Error toggling alert:', error);
    }
  };

  const handleAcknowledgeAlert = async (id) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operation: 'acknowledge' })
      });

      if (response.ok) {
        const updatedAlert = await response.json();
        setAlerts(alerts.map(a => a._id === id ? updatedAlert : a));
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const getConditionLabel = (condition) => {
    const labels = {
      'gt': '>',
      'lt': '<',
      'gte': '≥',
      'lte': '≤',
      'eq': '='
    };
    return labels[condition] || condition;
  };

  const getMetricUnit = (metric) => {
    const units = {
      'power': 'W',
      'voltage': 'V',
      'current': 'A'
    };
    return units[metric] || '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Bell className="text-yellow-400" size={24} />
            <h2 className="text-2xl font-bold text-white">Alert Management</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 px-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-3 font-medium transition ${
              activeTab === 'active' 
                ? 'text-yellow-400 border-b-2 border-yellow-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Active Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 font-medium transition ${
              activeTab === 'history' 
                ? 'text-yellow-400 border-b-2 border-yellow-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            History
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'active' ? (
            <div className="space-y-4">
              {/* Create Alert Button */}
              {!isCreating && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full premium-button px-4 py-3 rounded-lg font-medium flex items-center justify-center space-x-2"
                >
                  <Plus size={20} />
                  <span>Create New Alert</span>
                </button>
              )}

              {/* Create Alert Form */}
              {isCreating && (
                <form onSubmit={handleCreateAlert} className="premium-panel p-4 space-y-4">
                  <h3 className="text-lg font-semibold text-white mb-2">New Alert</h3>
                  
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Alert Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="premium-input"
                      placeholder="e.g., High Power Warning"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Metric *</label>
                      <select
                        value={formData.metric}
                        onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                        className="premium-input"
                      >
                        <option value="power">Power</option>
                        <option value="voltage">Voltage</option>
                        <option value="current">Current</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Condition *</label>
                      <select
                        value={formData.condition}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        className="premium-input"
                      >
                        <option value="gt">Greater Than (&gt;)</option>
                        <option value="lt">Less Than (&lt;)</option>
                        <option value="gte">Greater or Equal (≥)</option>
                        <option value="lte">Less or Equal (≤)</option>
                        <option value="eq">Equal (=)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Value *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className="premium-input"
                        placeholder="1000"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Cooldown (seconds)</label>
                    <input
                      type="number"
                      value={formData.cooldown}
                      onChange={(e) => setFormData({ ...formData, cooldown: parseInt(e.target.value) })}
                      className="premium-input"
                      placeholder="300"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Custom Message (optional)</label>
                    <input
                      type="text"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="premium-input"
                      placeholder="Custom alert message"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <button type="submit" className="premium-button active px-4 py-2 rounded-lg flex-1">
                      Create Alert
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="premium-button px-4 py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Alert List */}
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bell size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No alerts configured yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert._id}
                      className={`premium-panel p-4 ${
                        alert.triggered ? 'border-l-4 border-red-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-white">{alert.name}</h4>
                            {alert.active ? (
                              <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded-full">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                            {alert.triggered && (
                              <span className="px-2 py-1 bg-red-900 text-red-300 text-xs rounded-full flex items-center space-x-1">
                                <AlertTriangle size={12} />
                                <span>Triggered</span>
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-300 mb-2">
                            <span className="capitalize">{alert.metric}</span>{' '}
                            <span className="text-yellow-400 font-mono">{getConditionLabel(alert.condition)}</span>{' '}
                            <span className="font-semibold">{alert.value}</span>{' '}
                            <span className="text-gray-400">{getMetricUnit(alert.metric)}</span>
                          </p>
                          
                          <div className="text-sm text-gray-400 space-y-1">
                            {alert.message && <p>Message: {alert.message}</p>}
                            <p>Cooldown: {alert.cooldown}s</p>
                            {alert.triggerCount > 0 && (
                              <p>Triggered {alert.triggerCount} time(s)</p>
                            )}
                            {alert.lastTriggered && (
                              <p>Last: {new Date(alert.lastTriggered).toLocaleString()}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex space-x-2 ml-4">
                          {alert.triggered && (
                            <button
                              onClick={() => handleAcknowledgeAlert(alert._id)}
                              className="p-2 text-green-400 hover:bg-green-900 rounded transition"
                              title="Acknowledge"
                            >
                              <Check size={20} />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleAlert(alert._id)}
                            className={`p-2 rounded transition ${
                              alert.active 
                                ? 'text-yellow-400 hover:bg-yellow-900' 
                                : 'text-gray-400 hover:bg-gray-700'
                            }`}
                            title={alert.active ? 'Disable' : 'Enable'}
                          >
                            {alert.active ? <Bell size={20} /> : <BellOff size={20} />}
                          </button>
                          <button
                            onClick={() => handleDeleteAlert(alert._id)}
                            className="p-2 text-red-400 hover:bg-red-900 rounded transition"
                            title="Delete"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // History Tab
            <div>
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <div className="premium-loader"></div>
                </div>
              ) : alertHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertTriangle size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No alert history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertHistory.map((entry) => (
                    <div key={entry._id} className="premium-panel p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-white font-semibold">{entry.alertName}</h4>
                          <p className="text-gray-300 text-sm mt-1">
                            {entry.metric} {getConditionLabel(entry.condition)} {entry.threshold}{' '}
                            {getMetricUnit(entry.metric)}
                          </p>
                          <p className="text-yellow-400 text-sm">
                            Actual value: {entry.actualValue?.toFixed(2)} {getMetricUnit(entry.metric)}
                          </p>
                          {entry.message && (
                            <p className="text-gray-400 text-sm mt-1">{entry.message}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.triggeredAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}