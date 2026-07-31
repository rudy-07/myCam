const { Server } = require("socket.io");

let broadcaster;

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Adjust for production
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("New socket connection:", socket.id);

    socket.on("broadcaster", () => {
      broadcaster = socket.id;
      socket.broadcast.emit("broadcaster");
    });

    socket.on("watcher", () => {
      socket.to(broadcaster).emit("watcher", socket.id);
    });

    socket.on("offer", (id, message) => {
      socket.to(id).emit("offer", socket.id, message);
    });

    socket.on("answer", (id, message) => {
      socket.to(id).emit("answer", socket.id, message);
    });

    socket.on("candidate", (id, message) => {
      socket.to(id).emit("candidate", socket.id, message);
    });

    socket.on("disconnect", () => {
      socket.to(broadcaster).emit("disconnectPeer", socket.id);
    });
  });

  return io;
};

module.exports = setupSocket;
