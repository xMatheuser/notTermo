let palavraCorreta = "";
const linhas = 5;
const colunas = 5;
let linhaAtual = 0;
let colunaAtual = 0;
let palpite = "";
let absentLetters = new Set();  // Conjunto para rastrear letras ausentes
let isSubmitting = false;  // New flag to prevent multiple submissions

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

// Adicionar funcionalidade de cópia ao clicar no input
document.getElementById('roomId').onclick = function() {
    this.select();
};

// Eventos do Socket
socket.on('roomCreated', (roomId) => {
    currentRoom = roomId;
    document.getElementById('menu').style.display = 'none';
    
    // Criar uma caixa de diálogo personalizada
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
    // Cria uma fila de animações para evitar conflito com input do jogador
    requestAnimationFrame(() => {
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

        // Aplica as classes com animação sequencial em um contexto isolado
        let animationPromises = [];
        for (let i = 0; i < colunas; i++) {
            const cell = document.getElementById(`opponent-cell-${linha}-${i}`);
            if (!cell) continue; // Proteção contra elementos não encontrados

            // Remove classes anteriores
            cell.classList.remove('correct', 'present', 'absent', 'typed');
            
            // Cria uma promise para cada animação
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

        // Aguarda todas as animações terminarem
        Promise.all(animationPromises).then(() => {
            console.log('Todas as animações do oponente concluídas');
        });
    });
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
            
            // Remove todas as classes relacionadas a estado e animação
            cell.classList.remove("correct", "present", "absent", "typed", "flip", "happy");
            opponentCell.classList.remove("correct", "present", "absent", "typed", "flip", "happy");
            
            // Limpa o conteúdo
            cell.textContent = "";
            opponentCell.textContent = "";
            
            // Força um reflow para reiniciar animações futuras
            void cell.offsetWidth;
            void opponentCell.offsetWidth;
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

    // Reativa o teclado para o novo jogo
    enableKeyboard();
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
    if (!palavraCorreta || isSubmitting) return; // Prevent input if submitting or no word is set
    const message = document.getElementById("message");

    if (key === "ENTER") {
        if (palpite.length !== 5) {
            message.textContent = "Digite uma palavra com 5 letras!";
            return;
        }
        isSubmitting = true; // Set flag to prevent further submissions
        disableKeyboard(); // Disable input while processing
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
    const isCorrect = palpite === palavraCorreta;

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

    // Aplica as classes correspondentes com animação sequencial
    let lastFlipTimeout = 0;
    for (let i = 0; i < colunas; i++) {
        const cell = document.getElementById(`cell-${linhaAtual}-${i}`);
        const letter = palpiteArr[i];
        const key = document.querySelector(`.key:not(.enter):not(.backspace)[data-letter="${letter}"]`);
        
        // Adiciona delay sequencial para cada célula
        const flipDelay = i * 200;
        lastFlipTimeout = flipDelay + 600; // Guarda o tempo da última animação

        setTimeout(() => {
            cell.classList.add('flip');
            
            // Adiciona as classes de estado após metade da animação
            setTimeout(() => {
                cell.classList.add(letterStates[i]);
                
                // Atualiza o teclado após a animação
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

                // Se for a última célula e o palpite estiver correto, adiciona animação happy
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

    // Aguarda todas as animações terminarem antes de continuar
    setTimeout(() => {
        if (currentRoom) {
            console.log(`Enviando palpite para o oponente: ${palpite}, Linha: ${linhaAtual}, Room: ${currentRoom}`);
            socket.emit('guess', {
                roomId: currentRoom,
                palpite: palpite,
                linha: linhaAtual
            });
        }

        if (isCorrect) {
            if (currentRoom) {
                socket.emit('gameWin', {
                    roomId: currentRoom,
                    attempts: linhaAtual + 1
                });
            }
            isSubmitting = false; // Reset flag after game ends
        } else if (linhaAtual < linhas - 1) {
            linhaAtual++;
            colunaAtual = 0;
            palpite = "";
            message.textContent = "";
            isSubmitting = false; // Reset flag
            enableKeyboard(); // Re-enable input for the next guess
        } else {
            if (currentRoom) {
                socket.emit('gameLose', currentRoom);
            }
            isSubmitting = false; // Reset flag after game ends
        }
    }, lastFlipTimeout + 800); // Aguarda todas as animações + tempo da animação happy
}

// Desativa o teclado ao fim do jogo ou enquanto o oponente não entra
function disableKeyboard() {
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = true;
    });
    // Also disable physical keyboard input by setting a flag
    window.isKeyboardDisabled = true;
}

// Reativa o teclado quando o jogo começa
function enableKeyboard() {
    document.querySelectorAll(".key").forEach(key => {
        key.disabled = false;
    });
    window.isKeyboardDisabled = false;
}

// Suporte a teclado físico
document.addEventListener("keydown", (event) => {
    if (window.isKeyboardDisabled) return; // Ignore physical keyboard input if disabled
    const key = event.key.toUpperCase();
    if (/^[A-Z]$/.test(key) || key === "ENTER" || key === "BACKSPACE") {
        handleKey(key);
    }
});

socket.on('opponentFinished', (message) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
});