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
const players = {};

io.on("connection", (socket) => {
    console.log("Connected", socket.id);

    socket.emit("requestName");

    socket.on("setName", ({ name }) => {
        players[socket.id] = { id: socket.id, name: name };
        socket.emit("setId", { id: socket.id, name });
        io.emit("updatePlayerList", Object.values(players));
    });

    socket.on("challengePlayer", (opponentId) => {
        const challenger = players[socket.id];
        io.to(opponentId).emit("challengeReceived", { challengerId: socket.id, challengerName: challenger.name });
    });

    socket.on("acceptChallenge", ({ challengerId }) => {
        const gameId = uuidv4();
        const challenger = players[challengerId];
        const opponent = players[socket.id];

        games[gameId] = {
            id: gameId,
            chess: new Chess(),
            whitePlayer: challengerId,
            blackPlayer: socket.id,
            spectators: [],
        };

        socket.join(gameId);
        io.to(challengerId).socketsJoin(gameId);

        io.to(challengerId).emit("gameStart", { gameId, role: "w", opponentName: opponent.name });
        io.to(socket.id).emit("gameStart", { gameId, role: "b", opponentName: challenger.name });
    });

    socket.on("move", ({ gameId, move }) => {
        const game = games[gameId];
        if (!game) return;
    
        const { chess, whitePlayer, blackPlayer } = game;
        const currentPlayer = chess.turn() === "w" ? whitePlayer : blackPlayer;
    
        // Check if it's the current player's turn
        if (socket.id !== currentPlayer) {
            return socket.emit("invalidMove", "It's not your turn!");
        }
    
        // Make the move on the chess board
        const result = chess.move(move);
        if (result) {
            // Emit move and board state to all clients in the game room
            io.to(gameId).emit("move", move);
            io.to(gameId).emit("boardState", chess.fen());
    
            // Check if the game has ended
            const gameOutcome = getGameOutcome(chess);
            if (gameOutcome !== "ongoing") {
                // Determine the winner or if it's a draw
                const winnerId = gameOutcome === "draw" ? null : (gameOutcome === "White-wins" ? whitePlayer : blackPlayer);
                io.to(gameId).emit("gameOver", { outcome: gameOutcome, winnerId });
            } else {
                // If the game is still ongoing, emit move or capture sound
                if (result.flags.includes("c")) {
                    io.to(gameId).emit("captureSound");
                } else {
                    io.to(gameId).emit("moveSound");
                }
            }
        } else {
            socket.emit("invalidMove", "Invalid move!");
        }
    });
    
    function getGameOutcome(chess) {
        if (chess.isCheckmate()) {
            return chess.turn() === "w" ? "Black-wins" : "White-wins";
        } else if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial()) {
            return "draw";
        }
        return "ongoing";
    }


    function emitGameOver(gameId, outcome) {
        io.to(gameId).emit("gameOver", outcome);
    }

    socket.on("disconnect", () => {
        console.log("Disconnected", socket.id);
        delete players[socket.id];
        io.emit("updatePlayerList", Object.values(players));

        for (const gameId in games) {
            const game = games[gameId];

            if (game.whitePlayer === socket.id || game.blackPlayer === socket.id) {
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
