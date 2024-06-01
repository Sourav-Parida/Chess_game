const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");
const labelBar = document.getElementById("labelBar");
const rowLabels = document.getElementById("rowLabels");
const playerListElement = document.getElementById("playerList");
const currentPlayerElement = document.getElementById("currentPlayer");
const whitePlayerElement = document.getElementById("whitePlayer");
const blackPlayerElement = document.getElementById("blackPlayer");

const captureSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3");
const moveSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let gameId = null;
let playerId = null;
let playerName = null;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    labelBar.innerHTML = "";
    rowLabels.innerHTML = "";
    const letters = 'ABCDEFGH';
    const numbers = '87654321';

    const colLabels = playerRole === "b" ? letters.split("").reverse() : letters.split("");
    const rowLabelsArr = playerRole === "b" ? numbers.split("").reverse() : numbers.split("");

    for (let i = 0; i < 8; i++) {
        const labelElement = document.createElement('div');
        labelElement.innerText = colLabels[i];
        labelBar.appendChild(labelElement);
    }

    for (let i = 0; i < 8; i++) {
        const labelElement = document.createElement('div');
        labelElement.innerText = rowLabelsArr[i];
        rowLabels.appendChild(labelElement);
    }

    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square",
                (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                );
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareIndex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });
                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                });
                squareElement.appendChild(pieceElement);
            }
            squareElement.addEventListener("dragover", function (e) {
                e.preventDefault();
            });
            squareElement.addEventListener("drop", function (e) {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });
            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === "b") {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: "q",
    };

    const result = chess.move(move);
    if (result) {
        socket.emit("move", { gameId, move });
        renderBoard();
        if (result.flags.includes("c")) {
            playCaptureSound();
        } else {
            playMoveSound();
        }
    } else {
        console.error("Invalid move", move);
    }
};

function playCaptureSound() {
    captureSound.currentTime = 0;
    captureSound.play();
}

function playMoveSound() {
    moveSound.currentTime = 0;
    moveSound.play();
}

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        r: "♖",
        R: "♜",
        n: "♘",
        N: "♞",
        b: "♗",
        B: "♝",
        q: "♕",
        Q: "♛",
        k: "♔",
        K: "♚",
        p: "♙",
        P: "♟︎",
    };
    return unicodePieces[piece.type] || "";
};

socket.on("setId", function ({ id, name }) {
    playerId = id;
    playerName = name;
    currentPlayerElement.innerText = `Current Player: ${name}`;
});

socket.on("updatePlayerList", function (players) {
    playerListElement.innerHTML = "";
    players.forEach(player => {
        if (player.id !== playerId) {
            const playerDiv = document.createElement("div");
            playerDiv.classList.add("user");
            playerDiv.innerText = player.name;
            if (player.name !== playerName) {
                playerDiv.onclick = function () {
                    socket.emit("challengePlayer", player.id);
                };
            }
            playerListElement.appendChild(playerDiv);
        }
    });
});

socket.on("challengeReceived", function ({ challengerId, challengerName }) {
    const acceptChallenge = confirm(`${challengerName} has challenged you to a game. Do you accept?`);
    if (acceptChallenge) {
        socket.emit("acceptChallenge", { challengerId });
    }
});

socket.on("gameStart", function ({ gameId: id, role }) {
    gameId = id;
    playerRole = role;
    // No need to call socket.join(gameId) on client-side, it's a server-side operation.
    renderBoard();
});

socket.on("boardState", function (fen) {
    chess.load(fen);
    renderBoard();
});

socket.on("move", function (move) {
    chess.move(move);
    renderBoard();
});

socket.on("gameOver", function (message) {
    alert(message);
    window.location.reload();
});

// Prompt for the user's name and send it to the server
playerName = prompt("Enter your name:");
socket.emit("setName", { name: playerName });
