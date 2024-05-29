require("dotenv").config();

const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socket(server);
const PORT = process.env.PORT || 3000;

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
});

app.get("/favicon.png", (req, res) => {
    res.status(204).end();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

const games = {};

io.on("connection", (socket) => {
    console.log("Connected", socket.id);

    socket.on("joinGame", () => {
        let gameId;
        let playerRole;
        
        // Find a game with an available white player slot
        const availableGame = Object.values(games).find(game => !game.whitePlayer);

        if (availableGame) {
            gameId = availableGame.id;
            playerRole = "w";
            availableGame.whitePlayer = socket.id;
            socket.join(gameId);
        } else {
            // If no available game, create a new one
            gameId = uuidv4();
            playerRole = "b";
            games[gameId] = {
                id: gameId,
                chess: new Chess(),
                whitePlayer: null,
                blackPlayer: null,
                spectators: [],
            };
            games[gameId][playerRole + "Player"] = socket.id;
            socket.join(gameId);
        }
        
        socket.emit("playerRole", { role: playerRole, gameId });
        io.to(gameId).emit("playerJoined", { playerId: socket.id, role: playerRole });
        
        if (playerRole === "b") {
            io.to(gameId).emit("gameStart");
        }
    });

    socket.on("playerJoined", function ({ playerId, role }) {
        const playerInfo = document.createElement('div');
        playerInfo.innerText = `${role === "w" ? "White" : "Black"} Player: ${playerId}`;
        if (role === "w") {
            document.getElementById("whitePlayer").appendChild(playerInfo);
        } else {
            document.getElementById("blackPlayer").appendChild(playerInfo);
        }
    });

    socket.on("move", ({ gameId, move }) => {
        const game = games[gameId];
        if (!game) return;

        const { chess, whitePlayer, blackPlayer } = game;
        const currentPlayer = chess.turn() === "w" ? whitePlayer : blackPlayer;

        if (socket.id !== currentPlayer) {
            return socket.emit("invalidMove", "It's not your turn!");
        }

        const result = chess.move(move);
        if (result) {
            io.to(gameId).emit("move", move);
            io.to(gameId).emit("boardState", chess.fen());
        } else {
            socket.emit("invalidMove", "Invalid move!");
        }
    });

    socket.on("disconnect", () => {
        console.log("Disconnected", socket.id);

        for (const gameId in games) {
            const game = games[gameId];

            if (game.whitePlayer === socket.id) {
                game.whitePlayer = null;
                io.to(gameId).emit("playerDisconnected", "w");
            } else if (game.blackPlayer === socket.id) {
                game.blackPlayer = null;
                io.to(gameId).emit("playerDisconnected", "b");
            } else {
                const index = game.spectators.indexOf(socket.id);
                if (index !== -1) game.spectators.splice(index, 1);
            }

            if (!game.whitePlayer && !game.blackPlayer) {
                delete games[gameId];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log("Listening on port", PORT);
});
