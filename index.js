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

        // Find a game that has less than 2 players
        const availableGame = Object.values(games).find(game => !game.blackPlayer || !game.whitePlayer);

        if (availableGame) {
            gameId = availableGame.id;
            if (!availableGame.whitePlayer) {
                playerRole = "w";
                availableGame.whitePlayer = socket.id;
            } else if (!availableGame.blackPlayer) {
                playerRole = "b";
                availableGame.blackPlayer = socket.id;
            }
            socket.join(gameId);
        } else {
            // If no available game, create a new one
            gameId = uuidv4();
            playerRole = "w"; // First player is always white
            games[gameId] = {
                id: gameId,
                chess: new Chess(),
                whitePlayer: socket.id,
                blackPlayer: null,
                spectators: [],
            };
            socket.join(gameId);
        }

        socket.emit("playerRole", { role: playerRole, gameId });
        io.to(gameId).emit("playerJoined", { playerId: socket.id, role: playerRole });

        // If both players have joined, start the game
        if (games[gameId].whitePlayer && games[gameId].blackPlayer) {
            io.to(gameId).emit("gameStart");
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

            if (game.whitePlayer === socket.id || game.blackPlayer === socket.id) {
                // Delete the whole game if either player disconnects
                io.to(gameId).emit("gameOver", "A player disconnected. Game over.");
                delete games[gameId];
            } else {
                const index = game.spectators.indexOf(socket.id);
                if (index !== -1) game.spectators.splice(index, 1);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log("Listening on port", PORT);
});
