require("dotenv").config();

const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();

app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
});

app.get("/favicon.png", (req, res) => {
    res.status(204).end();
});

const server = http.createServer(app);
const io = socket(server);
const chess = new Chess();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

let players = [];

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
    console.log("Connected", socket.id);

    if (players.length < 2) {
        players.push(socket.id);
        const role = players.length === 1 ? "w" : "b";
        socket.emit("playerRole", role);
    } else {
        socket.emit("spectatorRole");
        socket.emit("boardState", chess.fen());
    }

    socket.on("disconnect", () => {
        console.log("Disconnected", socket.id);
        const index = players.indexOf(socket.id);
        if (index !== -1) {
            players.splice(index, 1);
            io.emit("playerDisconnected", index === 0 ? "w" : "b");
        }
    });

    socket.on("move", (move) => {
        try {
            const playerIndex = players.indexOf(socket.id);
            if (playerIndex === -1 || (chess.turn() === "w" && playerIndex !== 0) || (chess.turn() === "b" && playerIndex !== 1)) {
                return;
            }

            const result = chess.move(move);
            if (result) {
                io.emit("move", move);
                io.emit("boardState", chess.fen());
            } else {
                console.log("Invalid Move:", move);
                socket.emit("invalidMove", move);
            }
        } catch (err) {
            console.error(err);
            socket.emit("invalidMove", move);
        }
    });
});

server.listen(PORT, () => {
    console.log("Listening on port", PORT);
});
