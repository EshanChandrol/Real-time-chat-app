Chat Application

This is a simple chat application built using Node.js, WebSocket, PostgreSQL, Redis, and Kafka.

   Features

- User registration and authentication
- Real-time communication using WebSocket
- Private chat functionality
- Caching user sessions and recent messages with Redis
- Kafka integration for real-time analytics

   Setup Instructions

  Prerequisites

- Node.js installed on your machine
- PostgreSQL, Redis, and Kafka services running (locally or in Docker containers)

  Installation

1. Clone the repository to your local machine:
git clone https://github.com/EshanChandrol/Real-time-chat-app


Navigate to the project directory:
cd chat-application

Install dependencies:
npm install

Start the Node.js server:
npm start

The application should now be running. You can access it at http://localhost:3000 by default.

Run unit tests:
npm test
