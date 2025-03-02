let palavraCorreta = "";
const linhas = 5;
const colunas = 5;
let linhaAtual = 0;
let colunaAtual = 0;
let palpite = "";

const socket = io();
let currentRoom = null;

// Eventos do menu
document.getElementById('createRoom').onclick = () => {
    socket.emit('createRoom');
};

document.getElementById('joinRoom').onclick = () => {
    const roomId = document.getElementById('roomId').value;
    socket.emit('joinRoom', roomId);
};

// Eventos do Socket
socket.on('roomCreated', (roomId) => {
    currentRoom = roomId;
    document.getElementById('menu').style.display = 'none';
    alert(`Sala criada! Código: ${roomId}`);
    console.log(`Host: Sala criada com ID ${roomId}, currentRoom: ${currentRoom}`);
});

socket.on('gameStart', (palavra) => {
    palavraCorreta = palavra;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'grid';
    document.getElementById('keyboard').style.display = 'flex';
    console.log(`Jogo iniciado! currentRoom: ${currentRoom}`); // Removido palavraCorreta do log
});

socket.on('joinRoomSuccess', (roomId) => {
    currentRoom = roomId;
    console.log(`Oponente: Entrou na sala com ID ${roomId}, currentRoom: ${currentRoom}`);
});

socket.on('opponentGuess', ({ palpite, linha }) => {
    console.log(`Palpite do oponente recebido: ${palpite}, Linha: ${linha}, currentRoom: ${currentRoom}`);
    for (let i = 0; i < colunas; i++) {
        const cell = document.getElementById(`opponent-cell-${linha}-${i}`);
        if (palpite[i] === palavraCorreta[i]) {
            cell.classList.add("correct");
        } else if (palavraCorreta.includes(palpite[i])) {
            cell.classList.add("present");
        } else {
            cell.classList.add("absent");
        }
    }
});

socket.on('gameResult', ({ result, message }) => {
    console.log(`Resultado do jogo: ${result}, Mensagem: ${message}`);

    // Cria a overlay
    const overlay = document.createElement('div');
    overlay.classList.add('result-overlay');

    // Cria o contêiner para a mensagem e o botão
    const content = document.createElement('div');
    content.classList.add('result-content');

    // Cria a mensagem
    const messageElement = document.createElement('div');
    messageElement.classList.add('result-message', 'glow-beat');
    messageElement.textContent = message;
    content.appendChild(messageElement);

    // Cria o botão de revanche
    const rematchButton = document.createElement('button');
    rematchButton.classList.add('rematch-button');
    rematchButton.textContent = 'Revancha';
    rematchButton.onclick = () => {
        socket.emit('requestRematch', currentRoom);
        rematchButton.disabled = true;
        rematchButton.textContent = 'Aguardando oponente...';
    };
    content.appendChild(rematchButton);

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Desativa o teclado
    disableKeyboard();

    // Inicia o fade-out após 10 segundos
    setTimeout(() => {
        overlay.classList.add('fade-out');
    }, 10000);

    // Remove a overlay após o fade-out
    setTimeout(() => {
        overlay.remove();
    }, 11000);
});

socket.on('rematchRequested', (message) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
});

socket.on('gameRestart', (newPalavra) => {
    // Reinicia o estado do jogo
    palavraCorreta = newPalavra;
    linhaAtual = 0;
    colunaAtual = 0;
    palpite = "";

    // Limpa as grades
    for (let i = 0; i < linhas; i++) {
        for (let j = 0; j < colunas; j++) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            const opponentCell = document.getElementById(`opponent-cell-${i}-${j}`);
            cell.textContent = "";
            cell.classList.remove("correct", "present", "absent", "typed");
            opponentCell.textContent = "";
            opponentCell.classList.remove("correct", "present", "absent", "typed");
        }
    }

    // Limpa mensagens e reativa o teclado
    document.getElementById('message').textContent = "";
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = false;
    });

    console.log(`Jogo reiniciado.`); // Removido palavraCorreta do log
});

socket.on('waitingOpponent', (message) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    disableKeyboard();
});

// Cria a grade do jogo
const game = document.getElementById("game");
for (let i = 0; i < linhas; i++) {
    for (let j = 0; j < colunas; j++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.id = `cell-${i}-${j}`;
        game.appendChild(cell);
    }
}

// Create containers for grids
const gridsContainer = document.createElement("div");
gridsContainer.classList.add("grids-container");
document.body.insertBefore(gridsContainer, document.getElementById("keyboard"));

// Player container
const playerContainer = document.createElement("div");
playerContainer.classList.add("player-container");
const playerLabel = document.createElement("div");
playerLabel.classList.add("container-label");
playerLabel.textContent = "Você";
playerContainer.appendChild(playerLabel);
playerContainer.appendChild(game);

// Opponent container
const opponentContainer = document.createElement("div");
opponentContainer.classList.add("opponent-container");
const opponentLabel = document.createElement("div");
opponentLabel.classList.add("container-label");
opponentLabel.textContent = "Oponente";
opponentContainer.appendChild(opponentLabel);

// Create opponent's grid
const opponentGame = document.createElement("div");
opponentGame.id = "opponent-game";
opponentGame.classList.add("game-container");
for (let i = 0; i < linhas; i++) {
    for (let j = 0; j < colunas; j++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.id = `opponent-cell-${i}-${j}`;
        opponentGame.appendChild(cell);
    }
}
opponentContainer.appendChild(opponentGame);

// Add both containers to grids container
gridsContainer.appendChild(playerContainer);
gridsContainer.appendChild(opponentContainer);

// Cria o teclado
const keyboard = document.getElementById("keyboard");
const teclas = [
    "Q W E R T Y U I O P",
    "A S D F G H J K L",
    "Z X C V B N M"
];
teclas.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.classList.add("keyboard-row");
    row.split(" ").forEach(key => {
        const button = document.createElement("button");
        button.textContent = key;
        button.classList.add("key");
        button.onclick = () => handleKey(key);
        rowDiv.appendChild(button);
    });

    if (row === teclas[teclas.length - 1]) {
        const enterButton = document.createElement("button");
        enterButton.textContent = "ENTER";
        enterButton.classList.add("key", "enter");
        enterButton.onclick = () => handleKey("ENTER");
        rowDiv.appendChild(enterButton);

        const backspaceButton = document.createElement("button");
        backspaceButton.textContent = "⌫";
        backspaceButton.classList.add("key", "backspace");
        backspaceButton.onclick = () => handleKey("BACKSPACE");
        rowDiv.appendChild(backspaceButton);
    }

    keyboard.appendChild(rowDiv);
});

// Lógica de entrada de teclas
function handleKey(key) {
    if (!palavraCorreta) return;
    const message = document.getElementById("message");

    if (key === "ENTER") {
        if (palpite.length !== 5) {
            message.textContent = "Digite uma palavra com 5 letras!";
            return;
        }
        checkGuess();
    } else if (key === "BACKSPACE") {
        if (colunaAtual > 0) {
            colunaAtual--;
            palpite = palpite.slice(0, -1);
            const cell = document.getElementById(`cell-${linhaAtual}-${colunaAtual}`);
            cell.textContent = "";
        }
    } else if (colunaAtual < colunas && key.length === 1) {
        const cell = document.getElementById(`cell-${linhaAtual}-${colunaAtual}`);
        cell.textContent = key;
        cell.classList.add("typed");
        palpite += key;
        colunaAtual++;
    }
}

// Verifica o palpite
function checkGuess() {
    const message = document.getElementById("message");

    for (let i = 0; i < colunas; i++) {
        const cell = document.getElementById(`cell-${linhaAtual}-${i}`);
        if (palpite[i] === palavraCorreta[i]) {
            cell.classList.add("correct");
        } else if (palavraCorreta.includes(palpite[i])) {
            cell.classList.add("present");
        } else {
            cell.classList.add("absent");
        }
    }

    if (currentRoom) {
        console.log(`Enviando palpite para o oponente: ${palpite}, Linha: ${linhaAtual}, Room: ${currentRoom}`);
        socket.emit('guess', {
            roomId: currentRoom,
            palpite: palpite,
            linha: linhaAtual
        });
    }

    if (palpite === palavraCorreta) {
        if (currentRoom) {
            socket.emit('gameWin', currentRoom);
        }
    } else if (linhaAtual < linhas - 1) {
        linhaAtual++;
        colunaAtual = 0;
        palpite = "";
        message.textContent = "";
    } else {
        message.textContent = `Suas tentativas acabaram! A palavra era: [oculta]`; // Palavra oculta no cliente
        if (currentRoom) {
            socket.emit('gameLose', currentRoom);
        }
    }
}

// Desativa o teclado ao fim do jogo
function disableKeyboard() {
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = true;
    });
}

// Suporte a teclado físico
document.addEventListener("keydown", (event) => {
    const key = event.key.toUpperCase();
    if (/^[A-Z]$/.test(key) || key === "ENTER" || key === "BACKSPACE") {
        handleKey(key);
    }
});