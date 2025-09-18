const { Server } = require('socket.io');

let io;

function init(server) {
  io = new Server(server, {
    cors: { origin: '*' }
  });
  return io;
}

function getIo() {
  if (!io) {
    throw new Error('socket.io not initialized');
  }
  return io;
}

module.exports = { init, getIo };
