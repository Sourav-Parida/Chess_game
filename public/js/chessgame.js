const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");
const labelBar = document.getElementById("labelBar");
const rowLabels = document.getElementById("rowLabels");
const playerListElement = document.getElementById("playerList");

const captureSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3");
const moveSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3");


let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let gameId = null;
let playerId = null;
let playerName = null;
let opponentName = null;

document.getElementById("nameForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("nameInput").value;
    playerName = name;
    socket.emit("setName", { name: playerName });
    document.getElementById("nameModal").classList.add("hidden");
});

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
    
                pieceElement.addEventListener("touchstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareIndex };
                        e.preventDefault();
                    }
                });
    
                pieceElement.addEventListener("touchend", (e) => {
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
    
            squareElement.addEventListener("touchmove", function (e) {
                e.preventDefault();
            });
    
            squareElement.addEventListener("touchend", function (e) {
                if (draggedPiece) {
                    const touch = e.changedTouches[0];
                    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (targetElement && targetElement.classList.contains("square")) {
                        const targetSquare = {
                            row: parseInt(targetElement.dataset.row),
                            col: parseInt(targetElement.dataset.col)
                        };
                        handleMove(sourceSquare, targetSquare);
                    }
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
        // Emit "move" event to inform the server about the move
        socket.emit("move", { gameId, move });
        renderBoard();
    } else {
        console.error("Invalid move", move);
    }
};
    // Listen for move sound event
    socket.on("moveSound", function() {
        playMoveSound();
    });

    // Listen for capture sound event
    socket.on("captureSound", function() {
        playCaptureSound();
    });

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
});

socket.on("updatePlayerList", function (players) {
    playerListElement.innerHTML = "";
    players.forEach(player => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add("user");
        playerDiv.innerText = player.id === playerId ? `${player.name} (You)` : player.name;
        if (player.id !== playerId) {
            playerDiv.onclick = function () {
                showPlayerOptions(player.id, player.name);
            };
        }
        playerListElement.appendChild(playerDiv);
    });
});

function showPlayerOptions(playerId, playerName) {
    const playerOptions = document.createElement("div");
    playerOptions.classList.add("player-options");

    const challengeButton = document.createElement("button");
    challengeButton.classList.add("p-2", "bg-blue-500", "text-white", "rounded", "m-2");
    challengeButton.innerText = "Challenge";
    challengeButton.onclick = function () {
        socket.emit("challengePlayer", playerId);
        document.body.removeChild(playerOptions);
    };

    const spectateButton = document.createElement("button");
    spectateButton.classList.add("p-2", "bg-green-500", "text-white", "rounded", "m-2");
    spectateButton.innerText = "Spectate";
    spectateButton.onclick = function () {
        alert("Spectate feature coming soon!");
        document.body.removeChild(playerOptions);
    };

    playerOptions.appendChild(challengeButton);
    playerOptions.appendChild(spectateButton);

    playerOptions.style.position = "absolute";
    playerOptions.style.top = "50%";
    playerOptions.style.left = "50%";
    playerOptions.style.transform = "translate(-50%, -50%)";
    playerOptions.style.backgroundColor = "#333";
    playerOptions.style.padding = "20px";
    playerOptions.style.borderRadius = "10px";
    document.body.appendChild(playerOptions);
}

socket.on("challengeReceived", function ({ challengerId, challengerName }) {
    const challengeModal = document.createElement("div");
    challengeModal.classList.add("modal", "flex");

    const modalContent = document.createElement("div");
    modalContent.classList.add("modal-content");

    const challengerText = document.createElement("p");
    challengerText.classList.add("text-white", "mb-4");
    challengerText.innerText = `${challengerName} has challenged you to a game. Do you accept?`;

    const acceptButton = document.createElement("button");
    acceptButton.classList.add("p-2", "bg-green-500", "text-white", "rounded", "mr-2");
    acceptButton.innerText = "Accept";
    acceptButton.onclick = function () {
        socket.emit("acceptChallenge", { challengerId });
        document.body.removeChild(challengeModal);
    };

    const declineButton = document.createElement("button");
    declineButton.classList.add("p-2", "bg-red-500", "text-white", "rounded");
    declineButton.innerText = "Decline";
    declineButton.onclick = function () {
        document.body.removeChild(challengeModal);
    };

    modalContent.appendChild(challengerText);
    modalContent.appendChild(acceptButton);
    modalContent.appendChild(declineButton);
    challengeModal.appendChild(modalContent);
    document.body.appendChild(challengeModal);
});

socket.on("gameStart", function ({ gameId: id, role, opponentName: oppName }) {
    gameId = id;
    playerRole = role;
    opponentName = oppName;
    renderBoard();
    updatePlayerNames();
});

function updatePlayerNames() {
    const whitePlayer = playerRole === "w" ? playerName : opponentName;
    const blackPlayer = playerRole === "b" ? playerName : opponentName;
    document.getElementById("curr_playerName").innerText = playerName;
    document.getElementById("opponentName").innerText = opponentName;
}

socket.on("boardState", function (fen) {
    chess.load(fen);
    renderBoard();
});

socket.on("move", function (move) {
    chess.move(move);
    renderBoard();
});

// Handle the "gameOver" event
socket.on("gameOver", ({ outcome, winnerId }) => {
    let message;
    if (outcome === "draw") {
        message = "The game ended in a draw!";
    } else if (winnerId === playerId) {
        message = `Congratulations ${playerName}! You won!`;
    } else {
        message = `You lost! ${opponentName} won! Better luck next time!`;
    }

    // Display the outcome message
    const outcomeElement = document.createElement("div");
    outcomeElement.classList.add("outcome");
    outcomeElement.textContent = message;
    document.body.appendChild(outcomeElement);

    // Reload the page after a delay
    setTimeout(() => {
        location.reload();
    }, 10000); // Reload after 10 seconds (adjust as needed)
});




socket.on("requestName", function () {
    document.getElementById("nameModal").classList.remove("hidden");
});
