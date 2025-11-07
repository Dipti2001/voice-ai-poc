import { WebSocketServer } from 'ws';
import { createClient } from '@deepgram/sdk';
import AIService from './AIService.js';
import Conversation from '../models/Conversation.js';
import Agent from '../models/Agent.js';
import config from '../src/config.js';

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.deepgram = createClient(config.deepgram.apiKey);
    this.aiService = new AIService();
    this.activeConnections = new Map();

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  handleConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    console.log(`WebSocket connection established: ${connectionId}`);

    const connection = {
      id: connectionId,
      ws,
      deepgramConnection: null,
      agentId: null,
      conversationId: null,
      audioBuffer: [],
      isListening: false
    };

    this.activeConnections.set(connectionId, connection);

    ws.on('message', (message) => this.handleMessage(connection, message));
    ws.on('close', () => this.handleDisconnection(connectionId));
    ws.on('error', (error) => this.handleError(connectionId, error));
  }

  async handleMessage(connection, message) {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'start':
          await this.startListening(connection, data);
          break;
        case 'audio':
          this.processAudio(connection, data);
          break;
        case 'stop':
          await this.stopListening(connection);
          break;
        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  async startListening(connection, data) {
    const { agentId, callSid } = data;

    if (!agentId) {
      connection.ws.send(JSON.stringify({ type: 'error', message: 'Agent ID required' }));
      return;
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      connection.ws.send(JSON.stringify({ type: 'error', message: 'Agent not found' }));
      return;
    }

    connection.agentId = agentId;

    let conversation = await Conversation.findByCallSid(callSid);
    if (!conversation) {
      conversation = await Conversation.create({
        agent_id: agentId,
        call_sid: callSid,
        direction: 'inbound',
        customer_number: 'unknown'
      });
    }
    connection.conversationId = conversation.id;

    connection.deepgramConnection = this.deepgram.listen.live({
      model: config.deepgram.sttModel,
      smart_format: true,
      punctuate: true,
      interim_results: true
    });

    connection.deepgramConnection.addListener('transcriptReceived', (transcription) => {
      this.handleTranscription(connection, transcription);
    });

    connection.deepgramConnection.addListener('error', (error) => {
      console.error('Deepgram error:', error);
      connection.ws.send(JSON.stringify({ type: 'error', message: 'Transcription error' }));
    });

    connection.isListening = true;
    connection.ws.send(JSON.stringify({ type: 'started', connectionId: connection.id }));
  }

  processAudio(connection, data) {
    if (!connection.isListening || !connection.deepgramConnection) return;

    const audioData = Buffer.from(data.audio, 'base64');
    connection.deepgramConnection.send(audioData);
  }

  async stopListening(connection) {
    if (connection.deepgramConnection) {
      connection.deepgramConnection.finish();
      connection.deepgramConnection = null;
    }

    connection.isListening = false;
    connection.ws.send(JSON.stringify({ type: 'stopped' }));
  }

  async handleTranscription(connection, transcription) {
    const transcript = transcription?.channel?.alternatives?.[0]?.transcript || '';
    const isFinal = !transcription.is_final;

    if (transcript && isFinal) {
      connection.ws.send(JSON.stringify({
        type: 'transcription',
        transcript,
        isFinal: true
      }));

      try {
        await Conversation.addMessage(connection.conversationId, 'user', transcript);

        const messages = await Conversation.getMessages(connection.conversationId);
        const agent = await Agent.findById(connection.agentId);

        const aiResponse = await this.aiService.generateResponse(
          messages.map(m => ({ role: m.role, content: m.content })),
          agent.prompt
        );

        await Conversation.addMessage(connection.conversationId, 'assistant', aiResponse);

        const ttsResult = await this.aiService.generateTTS(aiResponse, agent.voice);
        await Conversation.update(connection.conversationId, { audio_url: ttsResult.url });

        connection.ws.send(JSON.stringify({
          type: 'response',
          text: aiResponse,
          audioUrl: ttsResult.url
        }));
      } catch (error) {
        console.error('Error processing AI response:', error);
        connection.ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to generate response'
        }));
      }
    } else if (transcript) {
      connection.ws.send(JSON.stringify({
        type: 'transcription',
        transcript,
        isFinal: false
      }));
    }
  }

  handleDisconnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      this.stopListening(connection);
      this.activeConnections.delete(connectionId);
      console.log(`WebSocket connection closed: ${connectionId}`);
    }
  }

  handleError(connectionId, error) {
    console.error(`WebSocket error for ${connectionId}:`, error);
    this.handleDisconnection(connectionId);
  }

  generateConnectionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  broadcastToAgent(agentId, message) {
    for (const [id, connection] of this.activeConnections.entries()) {
      if (connection.agentId === agentId) {
        connection.ws.send(JSON.stringify(message));
      }
    }
  }
}

export default WebSocketService;