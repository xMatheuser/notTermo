const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

const rooms = new Map();
//const palavras = ["ABRIR"];

onst palavras = ["ABRIR", "ACASO", "ADEUS", "AGORA", "AMIGO", "ANDAR", "ANJOS", "APOIO", "AREIA", "ASTRO", "ATRAS", "AULAS", "AZEDO", "BAIXO", "BALSA", "BANCO", "BARCO", "BEBER", "BEIJO", "BLUSA", "BOLSA", "BONES", "BRASA", "BRIGA", "BRISA", "BRUTO", "CACTO", "CALMO", "CAMPO", "CANTO", "CAPAZ", "CARRO", "CARTA", "CASAS", "CHAVE", "CHEFE", "CHORO", "CHUVA", "CINCO", "CINTO", "CLARO", "CONTA", "CORPO", "CORTE", "COUVE", "CREME", "CUSTO", "DADOS", "DATAS", "DENTE", "DEPOR", "DISCO", "DOCES", "DORES", "DURAR", "ERVAS", "ESTAR", "ETAPA", "EXATO", "FALAR", "FALTA", "FARTO", "FAVOR", "FAZER", "FESTA", "FICAR", "FILHO", "FONTE", "FORMA", "FORTE", "FRACO", "FRASE", "FUGIR", "FUNDO", "GELAR", "GENTE", "GLOBO", "GOLPE", "GOTAS", "GOSTO", "GRAVE", "GRIPE", "GRUPO", "HOTEL", "HUMOR", "IDEIA", "IGUAL", "JOVEM", "LIMPO", "LIVRO", "LOUCO", "LUGAR", "LUCRO", "LUTAR", "MAIOR", "MATAR", "MEDIR", "MEDO", "MEIGA", "METAL", "MIMOS", "MINHA", "MISTO", "MODAS", "MOLDE", "MONTE", "MORAR", "MOTOR", "MULHER", "MUNDO", "MUSGO", "NADAR", "NOBRE", "NORTE", "NOTAS", "NOVOS", "NUNCA", "OBRAS", "ORDEM", "ORGAN", "PASTO", "PATOS", "PELOS", "PENSA", "PERNA", "PESAR", "PILAR", "PINGO", "PINTO", "PODER", "POLVO", "PONTE", "PORTE", "POSSE", "POSTO", "PRESO", "PRIMA", "PROVA", "PULSO", "QUASE", "QUEDA", "QUILO", "RADAR", "RAIOS", "RAMOS", "RANGO", "RASGO", "RATOS", "REINO", "REMAR", "RENDA", "RIMAS", "RISCO", "RITMO", "ROBOS", "RODAS", "ROSTO", "RUGIR", "SALDO", "SALTO", "SANTO", "SAUDE", "SELOS", "SENDA", "SERES", "SERVO", "SETOR", "SOBRE", "SOFAS", "SOGRA", "SOMAR", "SONDA", "SORTE", "SUBIR", "SUCOS", "SULCO", "TABUA", "TALAO", "TANTO", "TAPAS", "TARDE", "TENDA", "TENSO", "TERMO", "TESTE", "TIGRE", "TIMES", "TINHA", "TIRAR", "TITAN", "TOMAS", "TONEL", "TORRE", "TRAMA", "TRENO", "TRIGO", "TROCA", "TUBOS", "TUMBA", "TURMA", "UNHAS", "UNICO", "URSO", "VAGAS", "VALOR", "VELHA", "VENDA", "VENUS", "VERBO", "VIDAS", "VIGOR", "VILAO", "VINTE", "VIRAR", "VISOR", "VISTA", "VIVOS", "VOCES", "VOGAL", "VOTAR", "ZEBRA", "ZONAS"];

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('createRoom', () => {
        const roomId = Math.random().toString(36).substring(2, 8);
        const palavra = palavras[Math.floor(Math.random() * palavras.length)];
        rooms.set(roomId, { 
            players: [socket.id], 
            palavra, 
            playerStates: new Map([[socket.id, { finished: false, won: false }]]),
            rematchRequests: new Map([[socket.id, false]])
        });
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        console.log(`Sala criada: ${roomId}, Jogadores: ${rooms.get(roomId).players}`);
    });

    socket.on('joinRoom', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.players.length < 2) {
            room.players.push(socket.id);
            room.playerStates.set(socket.id, { finished: false, won: false });
            room.rematchRequests.set(socket.id, false);
            socket.join(roomId);
            socket.emit('joinRoomSuccess', roomId);
            io.to(roomId).emit('gameStart', room.palavra);
            console.log(`Jogador ${socket.id} entrou na sala ${roomId}, Jogadores: ${room.players}`);
        } else {
            socket.emit('roomError', 'Sala não encontrada ou cheia');
            console.log(`Falha ao entrar na sala ${roomId}: Sala não encontrada ou cheia`);
        }
    });

    socket.on('guess', ({ roomId, palpite, linha }) => {
        console.log(`Palpite recebido de ${socket.id} na sala ${roomId}: ${palpite}, Linha: ${linha}`);
        socket.to(roomId).emit('opponentGuess', { palpite, linha });
        console.log(`Palpite enviado para outros jogadores na sala ${roomId}: ${palpite}, Linha: ${linha}`);
    });

    socket.on('gameWin', ({ roomId, attempts }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.playerStates.get(socket.id).finished = true;
            room.playerStates.get(socket.id).won = true;
            room.playerStates.get(socket.id).attempts = attempts;

            const otherPlayerId = room.players.find(id => id !== socket.id);
            const otherPlayerState = room.playerStates.get(otherPlayerId);

            if (otherPlayerState.finished) {
                // Ambos terminaram, determinar o vencedor
                if (otherPlayerState.won) {
                    // Ambos acertaram, comparar tentativas
                    if (attempts < otherPlayerState.attempts) {
                        announceWinner(room, socket.id);
                    } else if (attempts > otherPlayerState.attempts) {
                        announceWinner(room, otherPlayerId);
                    } else {
                        // Empate
                        announceTie(room);
                    }
                } else {
                    // Outro jogador errou, este ganhou
                    announceWinner(room, socket.id);
                }
            } else {
                // Aguardar outro jogador
                socket.emit('waitingOpponent', 'Você acertou! Aguardando oponente terminar...');
                io.to(otherPlayerId).emit('opponentFinished', 'Oponente acertou! Complete suas tentativas.');
            }
        }
    });

    socket.on('gameLose', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.playerStates.get(socket.id).finished = true;
            room.playerStates.get(socket.id).won = false;

            const otherPlayerId = room.players.find(id => id !== socket.id);
            const otherPlayerState = room.playerStates.get(otherPlayerId);

            if (otherPlayerState.finished) {
                if (otherPlayerState.won) {
                    // Outro jogador acertou, ele vence
                    announceWinner(room, otherPlayerId);
                } else {
                    // Ninguém acertou
                    announceDraw(room);
                }
            }
        }
    });

    socket.on('requestRematch', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.rematchRequests.set(socket.id, true);
            console.log(`Revanche solicitada por ${socket.id} na sala ${roomId}`);

            room.players.forEach(playerId => {
                if (playerId !== socket.id) {
                    io.to(playerId).emit('rematchRequested', `${socket.id} solicitou uma revanche!`);
                }
            });

            const allAccepted = room.players.every(playerId => room.rematchRequests.get(playerId));
            if (allAccepted) {
                const newPalavra = palavras[Math.floor(Math.random() * palavras.length)];
                room.palavra = newPalavra;
                room.playerStates.forEach((state, playerId) => {
                    state.finished = false;
                    state.won = false;
                });
                room.rematchRequests.forEach((_, playerId) => {
                    room.rematchRequests.set(playerId, false);
                });
                io.to(roomId).emit('gameRestart', newPalavra);
                console.log(`Jogo reiniciado na sala ${roomId}.`);
            }
        }
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            if (room.players.includes(socket.id)) {
                room.players = room.players.filter(id => id !== socket.id);
                room.playerStates.delete(socket.id);
                room.rematchRequests.delete(socket.id);
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`Sala ${roomId} deletada: sem jogadores`);
                } else {
                    io.to(roomId).emit('playerLeft', socket.id);
                    console.log(`Jogador ${socket.id} desconectou da sala ${roomId}, Jogadores restantes: ${room.players}`);
                }
            }
        });
    });
});

function announceWinner(room, winnerId) {
    const winnerState = room.playerStates.get(winnerId);
    room.players.forEach(playerId => {
        if (playerId === winnerId) {
            io.to(playerId).emit('gameResult', {
                result: 'win',
                message: 'Você venceu!',
                attempts: winnerState.attempts
            });
        } else {
            const loserState = room.playerStates.get(playerId);
            let message;
            
            if (loserState.won) {
                message = `Você acertou, mas seu oponente venceu por ter usado menos tentativas! (Oponente:${winnerState.attempts} x Você:${loserState.attempts} )`;
            } else {
                message = `Você perdeu! A palavra era: ${room.palavra}`;
            }
            
            io.to(playerId).emit('gameResult', {
                result: 'lose',
                message: message,
                attempts: winnerState.attempts
            });
        }
    });
}

function announceTie(room) {
    room.players.forEach(playerId => {
        io.to(playerId).emit('gameResult', {
            result: 'tie',
            message: 'Empate! Ambos acertaram com o mesmo número de tentativas.',
            attempts: room.playerStates.get(playerId).attempts
        });
    });
}

function announceDraw(room) {
    room.players.forEach(playerId => {
        io.to(playerId).emit('gameResult', {
            result: 'draw',
            message: `Ninguém acertou. A palavra era: ${room.palavra}`
        });
    });
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});