// Import necessary modules
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const redis = require('redis');
const kafka = require('kafka-node');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize PostgreSQL client
const pgClient = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'root',
    port: 5432,
});
pgClient.connect();

// Initialize Redis client
const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379,
  });

// Initialize Kafka client
const kafkaClient = new kafka.KafkaClient({
    clientId: 'real-time-chat-app',
    brokers: ['localhost:9092'],
  });
const producer = new kafka.Producer(kafkaClient);

// Define routes for user registration and authentication
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await pgClient.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pgClient.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const token = jwt.sign({ username: user.username }, 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcxNDU2NTc4NiwiaWF0IjoxNzE0NTY1Nzg2fQ.DEQVgQZE9CxfxI3UeWgsnfPGFwOrDOidYkRdNfxEC4Y');
        res.json({ token });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// WebSocket endpoints for real-time communication
wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const { sender, receiver, content } = JSON.parse(message);

            // Save message to PostgreSQL database
            await pgClient.query('INSERT INTO messages (sender, receiver, content) VALUES ($1, $2, $3)', [sender, receiver, content]);

            // Publish message to Kafka for analytics
            const kafkaMessage = {
                sender,
                receiver,
                content,
                timestamp: new Date().toISOString(),
            };
            producer.send([{ topic: 'messages', messages: JSON.stringify(kafkaMessage) }], (err, data) => {
                if (err) {
                    console.error('Error publishing message to Kafka:', err);
                } else {
                    console.log('Message published to Kafka:', data);
                }
            });

            // Update recent messages cache in Redis
            const recentMessagesKey = `recent_messages_${receiver}`;
            redisClient.lpush(recentMessagesKey, JSON.stringify(kafkaMessage));
            redisClient.ltrim(recentMessagesKey, 0, 99); // Keep only the most recent 100 messages in the cache

            // Broadcast the message to the receiver if they are connected
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    const clientUsername = client.username;
                    if (clientUsername === receiver || clientUsername === sender) {
                        client.send(JSON.stringify(kafkaMessage));
                    }
                }
            });
        } catch (error) {
            console.error('Error handling incoming message:', error);
        }
    });
});


// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
