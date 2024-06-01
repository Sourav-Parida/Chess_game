const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socket(server, {
    cors: {
        origin: "*", // Allow all origins, adjust this based on your security requirements
        methods: ["GET", "POST"],
        credentials: true
    }
});
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

    socket.emit("setId", socket.id);

    socket.on("setName", ({ name }) => {
        players[socket.id] = { id: socket.id, name: name };
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

        io.to(challengerId).emit("gameStart", { gameId, role: "w" });
        io.to(socket.id).emit("gameStart", { gameId, role: "b" });
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
