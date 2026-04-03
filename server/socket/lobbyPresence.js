const hostPresenceByGame = new Map();
const socketLobbyPresence = new Map();

function normalizeGameId(gameId) {
    return gameId ? gameId.toString() : null;
}

function clearSocketPresence(socketId) {
    const gameId = socketLobbyPresence.get(socketId);

    if (!gameId) {
        return;
    }

    const sockets = hostPresenceByGame.get(gameId);
    if (sockets) {
        sockets.delete(socketId);

        if (sockets.size === 0) {
            hostPresenceByGame.delete(gameId);
        }
    }

    socketLobbyPresence.delete(socketId);
}

function markHostPresent(socketId, gameId) {
    const normalizedGameId = normalizeGameId(gameId);
    if (!normalizedGameId) {
        return;
    }

    clearSocketPresence(socketId);

    let sockets = hostPresenceByGame.get(normalizedGameId);
    if (!sockets) {
        sockets = new Set();
        hostPresenceByGame.set(normalizedGameId, sockets);
    }

    sockets.add(socketId);
    socketLobbyPresence.set(socketId, normalizedGameId);
}

function isHostPresent(gameId) {
    const normalizedGameId = normalizeGameId(gameId);
    const sockets = normalizedGameId ? hostPresenceByGame.get(normalizedGameId) : null;
    return Boolean(sockets && sockets.size > 0);
}

module.exports = {
    clearSocketPresence,
    isHostPresent,
    markHostPresent
};
