const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to server');

  setInterval(() => {
    const voltage = 220 + Math.random() * 10 - 5; // Simulate voltage around 220V
    const current = 5 + Math.random() * 5 - 2.5; // Simulate current around 5A
    const power = voltage * current;

    const data = {
      voltage: voltage.toFixed(2),
      current: current.toFixed(2),
      power: power.toFixed(2),
      timestamp: new Date(),
    };

    socket.emit('esp32-data', data);
  }, 2000);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
