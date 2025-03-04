let palavraCorreta = "";
const linhas = 5;
const colunas = 5;
let linhaAtual = 0;
let colunaAtual = 0;
let palpite = "";
let absentLetters = new Set();  // Conjunto para rastrear letras ausentes

const socket = io();
let currentRoom = null;

// Referência ao label do oponente será definida depois que o elemento for criado
let opponentLabel; // Definimos como variável global, mas só atribuiremos o valor mais tarde

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

    // Alterar o texto do label para "Aguardando Oponente ..." e desabilitar o teclado
    opponentLabel.textContent = "Aguardando Oponente ...";
    disableKeyboard();

    console.log(`Host: Sala criada com ID ${roomId}, currentRoom: ${currentRoom}`);
});

socket.on('gameStart', (palavra) => {
    palavraCorreta = palavra;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'grid';
    document.getElementById('keyboard').style.display = 'flex';

    // Alterar o texto do label para "Oponente" e reativar o teclado
    opponentLabel.textContent = "Oponente";
    enableKeyboard();

    console.log(`Jogo iniciado! currentRoom: ${currentRoom}`);
});

socket.on('joinRoomSuccess', (roomId) => {
    currentRoom = roomId;
    console.log(`Oponente: Entrou na sala com ID ${roomId}, currentRoom: ${currentRoom}`);
});

socket.on('opponentGuess', ({ palpite, linha }) => {
    console.log(`Palpite do oponente recebido: ${palpite}, Linha: ${linha}, currentRoom: ${currentRoom}`);
    const palavraArr = palavraCorreta.split('');
    const palpiteArr = palpite.split('');
    const letterStates = new Array(5).fill('absent');
    const usedPositions = new Set();

    // Primeiro, verifica as letras corretas (posição exata)
    for (let i = 0; i < colunas; i++) {
        if (palpiteArr[i] === palavraArr[i]) {
            letterStates[i] = 'correct';
            usedPositions.add(i);
        }
    }

    // Depois, verifica as letras presentes em posições diferentes
    for (let i = 0; i < colunas; i++) {
        if (letterStates[i] !== 'correct') {
            for (let j = 0; j < colunas; j++) {
                if (!usedPositions.has(j) && palpiteArr[i] === palavraArr[j]) {
                    letterStates[i] = 'present';
                    usedPositions.add(j);
                    break;
                }
            }
        }
    }

    // Aplica apenas as classes de cor e garante que não há texto
    for (let i = 0; i < colunas; i++) {
        const cell = document.getElementById(`opponent-cell-${linha}-${i}`);
        cell.textContent = ''; // Garante que não há texto
        cell.classList.remove('typed'); // Remove a classe typed se existir
        cell.classList.add(letterStates[i]);
    }
});

socket.on('gameResult', ({ result, message, attempts }) => {
    console.log(`Resultado do jogo: ${result}, Mensagem: ${message}`);

    const overlay = document.createElement('div');
    overlay.classList.add('result-overlay');

    const content = document.createElement('div');
    content.classList.add('result-content');

    const messageElement = document.createElement('div');
    messageElement.classList.add('result-message', 'glow-beat');
    messageElement.textContent = message;
    
    // Não adicionar o número de tentativas se já estiver incluído na mensagem
    if (attempts && !message.includes('tentativas')) {
        messageElement.textContent += ` (${attempts} tentativas)`;
    }
    content.appendChild(messageElement);

    const rematchButton = document.createElement('button');
    rematchButton.classList.add('rematch-button');
    rematchButton.textContent = 'Revanche?';
    rematchButton.onclick = () => {
        socket.emit('requestRematch', currentRoom);
        rematchButton.disabled = true;
        rematchButton.textContent = 'Aguardando oponente...';
    };
    content.appendChild(rematchButton);

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    disableKeyboard();

    setTimeout(() => {
        overlay.classList.add('fade-out');
    }, 10000);

    setTimeout(() => {
        overlay.remove();
    }, 11000);
});

socket.on('rematchRequested', (message) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
});

socket.on('gameRestart', (newPalavra) => {
    palavraCorreta = newPalavra;
    linhaAtual = 0;
    colunaAtual = 0;
    palpite = "";
    absentLetters.clear();  // Limpa o conjunto de letras ausentes

    for (let i = 0; i < linhas; i++) {
        for (let j = 0; j < colunas; j++) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            const opponentCell = document.getElementById(`opponent-cell-${i}-${j}`);
            cell.textContent = "";
            cell.classList.remove("correct", "present", "absent", "typed");
            opponentCell.textContent = ""; // Garante que não há texto
            opponentCell.classList.remove("correct", "present", "absent", "typed");
        }
    }

    // Reseta todas as teclas ao estado inicial
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = false;
        key.classList.remove("absent-key", "correct-key", "present-key");
    });

    // Garante que o teclado seja exibido corretamente em dispositivos móveis
    document.getElementById('keyboard').style.display = 'flex';

    document.getElementById('message').textContent = "";
    console.log(`Jogo reiniciado.`);
});

socket.on('waitingOpponent', (message) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    disableKeyboard();
});

socket.on('playerLeft', (playerId) => {
    if (playerId !== socket.id) {
        opponentLabel.textContent = "Oponente saiu";
        setTimeout(() => {
            location.reload();
        }, 5000);
    }
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
opponentLabel = document.createElement("div"); // Atribuímos o elemento criado diretamente à variável opponentLabel
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
        button.setAttribute('data-letter', key); // Adiciona data-letter
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
    const palavraArr = palavraCorreta.split('');
    const palpiteArr = palpite.split('');
    const letterStates = new Array(5).fill('absent');
    const usedPositions = new Set();

    // Primeiro, verifica as letras corretas (posição exata)
    for (let i = 0; i < colunas; i++) {
        if (palpiteArr[i] === palavraArr[i]) {
            letterStates[i] = 'correct';
            usedPositions.add(i);
        }
    }

    // Depois, verifica as letras presentes em posições diferentes
    for (let i = 0; i < colunas; i++) {
        if (letterStates[i] !== 'correct') {
            for (let j = 0; j < colunas; j++) {
                if (!usedPositions.has(j) && palpiteArr[i] === palavraArr[j]) {
                    letterStates[i] = 'present';
                    usedPositions.add(j);
                    break;
                }
            }
        }
    }

    // Aplica as classes correspondentes e atualiza o teclado
    for (let i = 0; i < colunas; i++) {
        const cell = document.getElementById(`cell-${linhaAtual}-${i}`);
        cell.classList.add(letterStates[i]);
        
        const letter = palpiteArr[i];
        const key = document.querySelector(`.key:not(.enter):not(.backspace)[data-letter="${letter}"]`);
        
        if (key) {
            if (letterStates[i] === 'correct') {
                key.classList.remove('absent-key', 'present-key');
                key.classList.add('correct-key');
                key.disabled = false;
            } else if (letterStates[i] === 'present') {
                if (!key.classList.contains('correct-key')) {
                    key.classList.remove('absent-key');
                    key.classList.add('present-key');
                    key.disabled = false;
                }
            } else if (letterStates[i] === 'absent' && !palavraCorreta.includes(letter)) {
                if (!key.classList.contains('correct-key') && !key.classList.contains('present-key')) {
                    key.classList.add('absent-key');
                    key.disabled = true;
                }
            }
        }
    }

    // Resto da função continua igual
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
            socket.emit('gameWin', {
                roomId: currentRoom,
                attempts: linhaAtual + 1
            });
        }
    } else if (linhaAtual < linhas - 1) {
        linhaAtual++;
        colunaAtual = 0;
        palpite = "";
        message.textContent = "";
    } else {
        if (currentRoom) {
            socket.emit('gameLose', currentRoom);
        }
    }
}

// Desativa o teclado ao fim do jogo ou enquanto o oponente não entra
function disableKeyboard() {
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = true;
    });
}

// Reativa o teclado quando o jogo começa
function enableKeyboard() {
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = false;
    });
}

// Suporte a teclado físico
document.addEventListener("keydown", (event) => {
    const key = event.key.toUpperCase();
    if (/^[A-Z]$/.test(key) || key === "ENTER" || key === "BACKSPACE") {
        handleKey(key);
    }
});

socket.on('opponentFinished', (message) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
});