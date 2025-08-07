// server.js

// --- 1. Import Dependencies ---
// Express is a web framework for Node.js that simplifies server creation.
const express = require('express');
// http is a built-in Node.js module to create an HTTP server.
const http = require('http');
// socket.io enables real-time, bidirectional communication between clients and the server.
const { Server } = require("socket.io");

// --- 2. Server Setup ---
const app = express();
const server = http.createServer(app);
// Initialize Socket.IO by passing it the HTTP server instance.
// We add CORS configuration to allow our frontend (on a different origin) to connect.
const io = new Server(server, {
  cors: {
    origin: "*", // Allow connections from any origin
    methods: ["GET", "POST"]
  }
});

// This serves static files from the 'public' directory (where we'll put our HTML file).
app.use(express.static('public'));

// --- 3. Game State Management ---
// This object will hold the state of our single game room.
// In a more complex app, you'd have an array of these, each with a unique ID.
const gameState = {
  allNumbers: Array.from({ length: 90 }, (_, i) => i + 1),
  availableNumbers: [],
  calledNumbers: new Set(),
  gameInterval: null,
  isGameRunning: false,
};

// --- 4. Game Logic Functions ---
/**
 * Resets the game state to its initial values.
 */
function resetGame() {
  console.log('Server: Resetting game...');
  clearInterval(gameState.gameInterval);
  gameState.gameInterval = null;
  gameState.isGameRunning = false;
  gameState.availableNumbers = [...gameState.allNumbers];
  gameState.calledNumbers.clear();
  // Broadcast the reset state to all connected clients.
  io.emit('gameReset');
}

/**
 * Starts the game, drawing a new number at a set interval.
 */
function startGame() {
  if (gameState.isGameRunning) return; // Prevent starting a game that's already running.
  
  console.log('Server: Starting game...');
  gameState.isGameRunning = true;
  
  // Immediately draw the first number.
  drawAndBroadcastNumber();
  
  // Set an interval to draw subsequent numbers every 3 seconds.
  gameState.gameInterval = setInterval(drawAndBroadcastNumber, 3000);
}

/**
 * Draws a single number, updates the state, and broadcasts it.
 */
function drawAndBroadcastNumber() {
  if (gameState.availableNumbers.length === 0) {
    console.log('Server: All numbers called. Game over.');
    io.emit('gameOver', 'All numbers have been called!');
    clearInterval(gameState.gameInterval);
    gameState.isGameRunning = false;
    return;
  }

  const randomIndex = Math.floor(Math.random() * gameState.availableNumbers.length);
  const newNumber = gameState.availableNumbers.splice(randomIndex, 1)[0];
  gameState.calledNumbers.add(newNumber);

  console.log(`Server: Drew number ${newNumber}`);
  
  // Broadcast the new number and the updated list of called numbers to all clients.
  io.emit('newNumber', {
    number: newNumber,
    calledNumbers: Array.from(gameState.calledNumbers)
  });
}

// --- 5. Socket.IO Connection Handling ---
// This event listener runs whenever a new client connects to the server.
io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  // When a new user connects, send them the current state of the game.
  socket.emit('gameState', {
      calledNumbers: Array.from(gameState.calledNumbers),
      isGameRunning: gameState.isGameRunning,
      currentNumber: [...gameState.calledNumbers].pop() || null
  });

  // --- Listen for events from clients ---
  socket.on('startGame', () => {
    // Any player can currently start the game.
    startGame();
  });

  socket.on('resetGame', () => {
    // Any player can reset the game.
    resetGame();
  });

  // This event listener runs when a client disconnects.
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Optional: If no players are left, you could reset the game.
    if (io.engine.clientsCount === 0) {
        console.log('Server: Last player disconnected. Resetting game.');
        resetGame();
    }
  });
});

// --- 6. Start the Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Tambola server listening on *:${PORT}`);
});

// Initialize the game state when the server starts.
resetGame();
