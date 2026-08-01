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
      const targetId = id === 'broadcaster' ? broadcaster : id;
      if (targetId) {
        socket.to(targetId).emit("candidate", socket.id, message);
      }
    });

    socket.on("change-quality", (quality) => {
      if (broadcaster) {
        socket.to(broadcaster).emit("change-quality", quality);
      }
    });

    socket.on("motion-detected", (data) => {
      console.log(`[Socket] Motion detected from ${socket.id}:`, data);
      io.emit("smart-alert", {
        type: "motion",
        cameraId: data?.cameraId || "CAM-MOBILE",
        timestamp: new Date().toISOString(),
        message: "Activity / Motion detected on camera feed!"
      });
    });

    socket.on("trigger-alert", (alertData) => {
      io.emit("smart-alert", alertData);
    });

    socket.on("schedule-trigger", (scheduleData) => {
      console.log(`[Socket] Schedule trigger emitted:`, scheduleData);
      io.emit("schedule-trigger", scheduleData);
    });

    socket.on("disconnect", () => {
      if (broadcaster) {
        socket.to(broadcaster).emit("disconnectPeer", socket.id);
      }
    });
  });

  return io;
};

module.exports = setupSocket;
