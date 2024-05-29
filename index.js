require("dotenv").config();

const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);
const chess = new Chess();
const PORT = process.env.PORT || 3000;

// Set the views directory
app.set("views", path.join(__dirname, "views"));

// Set the view engine
app.set("view engine", "ejs");

// Ignore favicon requests
app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
});

app.get("/favicon.png", (req, res) => {
    res.status(204).end();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

let whitePlayer = null;
let blackPlayer = null;

app.get("/", (req, res) => {
    // Render the "index" view
    res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
    console.log("Connected", socket.id);

    // Assign players based on availability
    if (!whitePlayer) {
        whitePlayer = socket.id;
        socket.emit("playerRole", "w");
    } else if (!blackPlayer) {
        blackPlayer = socket.id;
        socket.emit("playerRole", "b");
        io.emit("gameStart"); // Notify both players that the game has started
    } else {
        socket.emit("spectatorRole");
        socket.emit("boardState", chess.fen());
    }

    socket.on("disconnect", () => {
        console.log("Disconnected", socket.id);
        if (socket.id === whitePlayer) {
            whitePlayer = null;
        } else if (socket.id === blackPlayer) {
            blackPlayer = null;
        }
        io.emit("playerDisconnected");
    });

    socket.on("move", (move) => {
        try {
            // Ensure only the player whose turn it is can make a move
            const currentPlayer = chess.turn() === "w" ? whitePlayer : blackPlayer;
            if (socket.id !== currentPlayer) {
                return socket.emit("invalidMove", "It's not your turn!");
            }

            const result = chess.move(move);
            if (result) {
                io.emit("move", move);
                io.emit("boardState", chess.fen());
            } else {
                socket.emit("invalidMove", "Invalid move!");
            }
        } catch (err) {
            console.error(err);
            socket.emit("invalidMove", "An error occurred while processing your move.");
        }
    });
});

server.listen(PORT, () => {
    console.log("Listening on port", PORT);
});
