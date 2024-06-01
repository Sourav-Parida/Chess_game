// api/socket.js
const { Server } = require("socket.io");

const ioHandler = (req, res) => {
    if (!res.socket.server.io) {
        console.log("New Socket.io server...");
        const io = new Server(res.socket.server);
        io.on("connection", (socket) => {
            console.log("Client connected");

            socket.on("disconnect", () => {
                console.log("Client disconnected");
            });

            // Add your custom events and handlers here
            socket.on("message", (msg) => {
                console.log("Message received: " + msg);
                socket.broadcast.emit("message", msg);
            });
        });
        res.socket.server.io = io;
    }
    res.end();
};

export default ioHandler;
