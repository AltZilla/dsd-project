
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const clientPromise = require('./lib/mongodb');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const MONGODB_URI = 'mongodb+srv://sunil300904:sunil300904@cluster0.fcfll4b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
process.env.MONGODB_URI = MONGODB_URI;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });

  const io = new Server(server);

  io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('esp32-data', async (data) => {
      io.emit('data', data);

      try {
        const client = await clientPromise;
        const db = client.db();
        await db.collection('power_realtime').insertOne(data);
      } catch (error) {
        console.error('Error saving to MongoDB:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
  });
});
