const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(express.json());

// Track active browser connections
let browserSocket = null;
const pendingRequests = new Map();

wss.on('connection', (ws) => {
    console.log('[WS] Browser connected to LiteRT-API Bridge');
    browserSocket = ws;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'response' && pendingRequests.has(data.id)) {
                const state = pendingRequests.get(data.id);
                if (data.text) state.text = data.text; // Only update if there is actual content
                
                if (state.isStreaming) {
                    if (data.done) {
                        state.res.write('data: [DONE]\n\n');
                        state.res.end();
                        pendingRequests.delete(data.id);
                    } else {
                        const chunk = {
                            id: data.id,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: 'litert-lm',
                            choices: [{
                                index: 0,
                                delta: { content: data.text },
                                finish_reason: null
                            }]
                        };
                        state.res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    }
                } else if (data.done) {
                    state.res.json({
                        id: data.id,
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: 'litert-lm',
                        choices: [{
                            index: 0,
                            message: { role: 'assistant', content: state.text },
                            finish_reason: 'stop'
                        }]
                    });
                    pendingRequests.delete(data.id);
                }
            }
        } catch (e) {
            console.error('[WS] Error processing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Browser disconnected');
        browserSocket = null;
    });
});

// OpenAI Compatible Endpoint
app.post('/v1/chat/completions', (req, res) => {
    if (!browserSocket) {
        return res.status(503).json({ error: { message: "LiteRT Browser Node not connected. Launch API in the web UI first.", type: "service_unavailable" } });
    }

    const { messages, stream, temperature, max_tokens } = req.body;
    const requestId = uuidv4();

    if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
    }

    pendingRequests.set(requestId, { res, isStreaming: !!stream });

    browserSocket.send(JSON.stringify({
        type: 'request',
        id: requestId,
        payload: { messages, stream, temperature, max_tokens }
    }));
});

// Models Endpoint
app.get('/v1/models', (req, res) => {
    res.json({
        object: 'list',
        data: [{
            id: 'litert-lm',
            object: 'model',
            created: 1677610602,
            owned_by: 'litert-studio'
        }]
    });
});

server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws-api') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 LiteRT-API Backend running on http://localhost:${PORT}`);
    console.log(`🔗 OpenAI Endpoint: http://localhost:${PORT}/v1/chat/completions`);
});
