const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();
const routes = require('./routes.cjs');
const setupSocket = require('./socket.cjs');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('MyCam Backend Running');
});

app.use('/api', routes);

// Initialize Socket.io
setupSocket(server);

// Global Error Handler to allow JSON response instead of HTML
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
