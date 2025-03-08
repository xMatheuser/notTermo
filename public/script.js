let palavraCorreta = "";
const linhas = 5;
const colunas = 5;
let linhaAtual = 0;
let colunaAtual = 0; // Agora representa a coluna selecionada na linha atual
let palpite = "";
let absentLetters = new Set();
let isSubmitting = false;

const socket = io();
let currentRoom = null;
let opponentLabel;

// Variável para rastrear a célula selecionada
let selectedCell = { row: 0, col: 0 }; // Inicialmente, a primeira célula da primeira linha

// Função para atualizar a seleção visual
function updateSelectedCell() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('selected');
    });
    // Só adiciona a classe 'selected' se o jogo tiver começado
    if (palavraCorreta) {
        const cell = document.getElementById(`cell-${selectedCell.row}-${selectedCell.col}`);
        if (cell) {
            cell.classList.add('selected');
        }
    }
}

// Add these helper functions at the top of the file
function normalizeText(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function isSameLetter(a, b) {
    return normalizeText(a) === normalizeText(b);
}

// Eventos do menu
document.getElementById('createRoom').onclick = () => {
    socket.emit('createRoom');
};

document.getElementById('joinRoom').onclick = () => {
    const roomId = document.getElementById('roomId').value;
    socket.emit('joinRoom', roomId);
};

document.getElementById('roomId').onclick = function() {
    this.select();
};

// Eventos do Socket
socket.on('roomCreated', (roomId) => {
    currentRoom = roomId;
    document.getElementById('menu').style.display = 'none';
    
    const dialog = document.createElement('div');
    dialog.classList.add('room-code-dialog');
    
    const message = document.createElement('p');
    message.textContent = `Código da sala: ${roomId}`;
    
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copiar código';
    copyButton.onclick = () => {
        navigator.clipboard.writeText(roomId)
            .then(() => {
                copyButton.textContent = 'Copiado!';
                copyButton.style.backgroundColor = '#6aaa64';
                setTimeout(() => {
                    dialog.remove();
                }, 2000);
            })
            .catch(() => {
                copyButton.textContent = 'Erro ao copiar';
                copyButton.style.backgroundColor = '#d9534f';
            });
    };
    
    dialog.appendChild(message);
    dialog.appendChild(copyButton);
    document.body.appendChild(dialog);

    opponentLabel.textContent = "Aguardando Oponente";
    disableKeyboard();
});

socket.on('gameStart', (palavra) => {
    palavraCorreta = palavra;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'grid';
    document.getElementById('keyboard').style.display = 'flex';

    opponentLabel.textContent = "Oponente";
    enableKeyboard();
});

socket.on('joinRoomSuccess', (roomId) => {
    currentRoom = roomId;
});

socket.on('opponentGuess', ({ palpite, linha }) => {
    requestAnimationFrame(() => {
        const palavraArr = palavraCorreta.split('');
        const palpiteArr = palpite.split('');
        const letterStates = new Array(5).fill('absent');
        const usedPositions = new Set();

        for (let i = 0; i < colunas; i++) {
            if (isSameLetter(palpiteArr[i], palavraArr[i])) {
                letterStates[i] = 'correct';
                usedPositions.add(i);
            }
        }

        for (let i = 0; i < colunas; i++) {
            if (letterStates[i] !== 'correct') {
                for (let j = 0; j < colunas; j++) {
                    if (!usedPositions.has(j) && isSameLetter(palpiteArr[i], palavraArr[j])) {
                        letterStates[i] = 'present';
                        usedPositions.add(j);
                        break;
                    }
                }
            }
        }

        let animationPromises = [];
        for (let i = 0; i < colunas; i++) {
            const cell = document.getElementById(`opponent-cell-${linha}-${i}`);
            if (!cell) continue;

            cell.classList.remove('correct', 'present', 'absent', 'typed');
            
            const promise = new Promise(resolve => {
                setTimeout(() => {
                    cell.classList.add('flip');
                    setTimeout(() => {
                        cell.classList.add(letterStates[i]);
                        resolve();
                    }, 250);
                }, i * 200);
            });
            
            animationPromises.push(promise);
        }

        Promise.all(animationPromises);
    });
});

socket.on('gameResult', ({ result, message, attempts }) => {
    const overlay = document.createElement('div');
    overlay.classList.add('result-overlay');

    const content = document.createElement('div');
    content.classList.add('result-content');

    const messageElement = document.createElement('div');
    messageElement.classList.add('result-message', 'glow-beat');
    messageElement.textContent = message;
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
    document.getElementById('message').textContent = message;
});

socket.on('gameRestart', (newPalavra) => {
    palavraCorreta = newPalavra;
    linhaAtual = 0;
    colunaAtual = 0;
    palpite = "";
    absentLetters.clear();

    for (let i = 0; i < linhas; i++) {
        for (let j = 0; j < colunas; j++) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            const opponentCell = document.getElementById(`opponent-cell-${i}-${j}`);
            cell.classList.remove("correct", "present", "absent", "typed", "flip", "happy", "selected");
            opponentCell.classList.remove("correct", "present", "absent", "typed", "flip", "happy");
            cell.textContent = "";
            opponentCell.textContent = "";
            void cell.offsetWidth;
            void opponentCell.offsetWidth;
        }
    }

    document.querySelectorAll(".key").forEach(key => {
        key.disabled = false;
        key.classList.remove("absent-key", "correct-key", "present-key");
    });

    document.getElementById('keyboard').style.display = 'flex';
    document.getElementById('message').textContent = "";
    selectedCell = { row: 0, col: 0 };
    updateSelectedCell();
    enableKeyboard();
});

socket.on('waitingOpponent', (message) => {
    document.getElementById('message').textContent = message;
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

// Cria a grade do jogo com suporte a cliques
const game = document.getElementById("game");
for (let i = 0; i < linhas; i++) {
    for (let j = 0; j < colunas; j++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.id = `cell-${i}-${j}`;
        cell.addEventListener('click', () => {
            if (i === linhaAtual && !isSubmitting && palavraCorreta) {
                selectedCell.row = i;
                selectedCell.col = j;
                colunaAtual = j;
                updateSelectedCell();
            }
        });
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
opponentLabel = document.createElement("div");
opponentLabel.classList.add("container-label");
opponentLabel.textContent = "Oponente";
opponentContainer.appendChild(opponentLabel);

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
        button.setAttribute('data-letter', key);
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

// Inicializa a célula selecionada
updateSelectedCell();

// Lógica de entrada de teclas
function handleKey(key) {
    if (!palavraCorreta || isSubmitting || selectedCell.row !== linhaAtual) return;
    const message = document.getElementById("message");

    if (key === "ENTER") {
        if (palpite.length !== 5) {
            message.textContent = "Digite uma palavra com 5 letras!";
            return;
        }
        isSubmitting = true;
        disableKeyboard();
        checkGuess();
    } else if (key === "BACKSPACE") {
        const cell = document.getElementById(`cell-${linhaAtual}-${colunaAtual}`);
        if (cell.textContent) {
            cell.textContent = "";
            palpite = palpite.substring(0, colunaAtual) + palpite.substring(colunaAtual + 1);
        } else if (colunaAtual > 0) {
            selectedCell.col--;
            colunaAtual--;
            updateSelectedCell();
        }
    } else if (key === "ARROWLEFT") {
        if (colunaAtual > 0) {
            selectedCell.col--;
            colunaAtual--;
            updateSelectedCell();
        }
    } else if (key === "ARROWRIGHT") {
        if (colunaAtual < colunas - 1) {
            selectedCell.col++;
            colunaAtual++;
            updateSelectedCell();
        }
    } else if (key.length === 1 && /^[A-ZÀ-ÿ]$/i.test(key)) {
        const cell = document.getElementById(`cell-${linhaAtual}-${colunaAtual}`);
        const normalizedKey = key.toUpperCase();
        cell.textContent = normalizedKey;
        cell.classList.add("typed");

        if (palpite.length < colunas) {
            palpite += normalizedKey;
        } else {
            palpite = palpite.substring(0, colunaAtual) + normalizedKey + palpite.substring(colunaAtual + 1);
        }

        if (colunaAtual < colunas - 1) {
            selectedCell.col++;
            colunaAtual++;
            updateSelectedCell();
        }
    }
}

// Modificar a função checkGuess
function checkGuess() {
    const message = document.getElementById("message");
    const normalizedPalpite = palpite.toUpperCase();
    const normalizedPalavra = palavraCorreta.toUpperCase();
    const isCorrect = normalizedPalpite === normalizedPalavra;
    
    if (palpite.length !== 5) {
        message.textContent = "Digite uma palavra com 5 letras!";
        isSubmitting = false;
        enableKeyboard();
        return;
    }

    const palavraArr = palavraCorreta.split('');
    const palpiteArr = palpite.split('');
    const letterStates = new Array(5).fill('absent');
    
    // Garantir que letterCounts seja limpo e reiniciado para cada novo palpite
    const letterCounts = Object.fromEntries(
        palavraArr.map(letter => normalizeText(letter))
            .reduce((acc, letter) => {
                acc.set(letter, (acc.get(letter) || 0) + 1);
                return acc;
            }, new Map())
    );

    // Primeiro marcar matches exatos
    for (let i = 0; i < colunas; i++) {
        const normalizedGuess = normalizeText(palpiteArr[i]);
        const normalizedWord = normalizeText(palavraArr[i]);
        
        if (normalizedGuess === normalizedWord && letterCounts[normalizedGuess] > 0) {
            letterStates[i] = 'correct';
            letterCounts[normalizedGuess]--;
        }
    }
    
    // Depois verificar letras presentes em outras posições
    for (let i = 0; i < colunas; i++) {
        if (letterStates[i] === 'absent') {
            const normalizedGuess = normalizeText(palpiteArr[i]);
            if (letterCounts[normalizedGuess] > 0) {
                letterStates[i] = 'present';
                letterCounts[normalizedGuess]--;
            }
        }
    }

    let lastFlipTimeout = 0;
    for (let i = 0; i < colunas; i++) {
        const cell = document.getElementById(`cell-${linhaAtual}-${i}`);
        const letter = palpiteArr[i];
        const normalizedLetter = normalizeText(letter);
        const key = document.querySelector(`.key:not(.enter):not(.backspace)[data-letter="${normalizedLetter}"]`);
        
        const flipDelay = i * 200;
        lastFlipTimeout = flipDelay + 600;

        setTimeout(() => {
            cell.classList.add('flip');
            setTimeout(() => {
                cell.classList.add(letterStates[i]);
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
                    } else if (letterStates[i] === 'absent' && !palavraCorreta.split('').some(c => isSameLetter(c, letter))) {
                        if (!key.classList.contains('correct-key') && !key.classList.contains('present-key')) {
                            key.classList.add('absent-key');
                            key.disabled = true;
                        }
                    }
                }
                if (i === colunas - 1 && isCorrect) {
                    setTimeout(() => {
                        for (let j = 0; j < colunas; j++) {
                            const happyCell = document.getElementById(`cell-${linhaAtual}-${j}`);
                            happyCell.classList.add('happy');
                        }
                    }, 100);
                }
            }, 250);
        }, flipDelay);
    }

    setTimeout(() => {
        if (currentRoom) {
            socket.emit('guess', {
                roomId: currentRoom,
                palpite: normalizedPalpite,
                linha: linhaAtual
            });
        }

        if (isCorrect && normalizedPalpite === normalizedPalavra) { // Dupla verificação
            if (currentRoom) {
                socket.emit('gameWin', {
                    roomId: currentRoom,
                    attempts: linhaAtual + 1,
                    palpite: normalizedPalpite
                });
            }
            isSubmitting = false;
        } else if (linhaAtual < linhas - 1) {
            linhaAtual++;
            selectedCell.row = linhaAtual;
            selectedCell.col = 0;
            colunaAtual = 0;
            palpite = "";
            message.textContent = "";
            isSubmitting = false;
            enableKeyboard();
            updateSelectedCell();
        } else {
            if (currentRoom) {
                socket.emit('gameLose', currentRoom);
            }
            isSubmitting = false;
        }
    }, lastFlipTimeout + 800);
}

// Desativa o teclado
function disableKeyboard() {
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = true;
    });
    window.isKeyboardDisabled = true;
}

// Reativa o teclado
function enableKeyboard() {
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = false;
    });
    window.isKeyboardDisabled = false;
}

// Suporte a teclado físico
document.addEventListener("keydown", (event) => {
    if (window.isKeyboardDisabled) return;
    const key = event.key.toUpperCase();
    if (/^[A-ZÀ-ÿ]$/i.test(key) || key === "ENTER" || key === "BACKSPACE" || key === "ARROWLEFT" || key === "ARROWRIGHT") {
        handleKey(key);
    }
});

socket.on('opponentFinished', (message) => {
    document.getElementById('message').textContent = message;
});

// Adicionar novo evento para tratamento de palpite inválido
socket.on('invalidGuess', () => {
    const message = document.getElementById("message");
    message.textContent = "Palpite inválido!";
    isSubmitting = false;
    enableKeyboard();
});