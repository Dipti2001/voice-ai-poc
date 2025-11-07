import express from 'express';
import Conversation from '../../models/Conversation.js';
import Agent from '../../models/Agent.js';
import TwilioService from '../../services/TwilioService.js';
import AIService from '../../services/AIService.js';
import config from '../config.js';

const router = express.Router();
const twilioService = new TwilioService();
const aiService = new AIService();

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const conversations = await Conversation.findAll(limit);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await Conversation.getMessages(req.params.id);
    res.json({ ...conversation, messages });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.post('/outbound', async (req, res) => {
  try {
    const { agent_id, to } = req.body;

    if (!agent_id || !to) {
      return res.status(400).json({ error: 'Agent ID and phone number are required' });
    }

    const agent = await Agent.findById(agent_id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const callbackUrl = `${config.app.baseUrl}/api/calls/twiml/${agent_id}`;
    const callResult = await twilioService.makeOutboundCall(to, agent_id, callbackUrl);

    const conversation = await Conversation.create({
      agent_id,
      call_sid: callResult.callSid,
      direction: 'outbound',
      customer_number: to
    });

    res.json({ ...callResult, conversation_id: conversation.id });
  } catch (error) {
    console.error('Error making outbound call:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

router.post('/twiml/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const agent = await Agent.findById(agentId);

    if (!agent) {
      return res.status(404).send('Agent not found');
    }

    const twilioData = twilioService.parseTwilioRequest(req.body);
    let conversation = await Conversation.findByCallSid(twilioData.callSid);

    if (!conversation) {
      conversation = await Conversation.create({
        agent_id: agentId,
        call_sid: twilioData.callSid,
        direction: twilioData.direction || 'inbound',
        customer_number: twilioData.from
      });
    }

    let twiml;
    if (twilioData.speechResult) {
      await Conversation.addMessage(conversation.id, 'user', twilioData.speechResult);

      const messages = await Conversation.getMessages(conversation.id);
      const aiResponse = await aiService.generateResponse(
        messages.map(m => ({ role: m.role, content: m.content })),
        agent.prompt
      );

      await Conversation.addMessage(conversation.id, 'assistant', aiResponse);

      const ttsResult = await aiService.generateTTS(aiResponse, agent.voice);
      await Conversation.update(conversation.id, { audio_url: ttsResult.url });

      twiml = twilioService.generateTwiml(ttsResult.url, `${config.app.baseUrl}/api/calls/twiml/${agentId}`);
    } else {
      const greeting = `Hello! This is ${agent.name}. How can I help you today?`;
      const ttsResult = await aiService.generateTTS(greeting, agent.voice);

      await Conversation.addMessage(conversation.id, 'assistant', greeting);
      await Conversation.update(conversation.id, { audio_url: ttsResult.url });

      twiml = twilioService.generateTwiml(ttsResult.url, `${config.app.baseUrl}/api/calls/twiml/${agentId}`);
    }

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error handling Twilio webhook:', error);
    const twiml = twilioService.generateTwiml();
    res.type('text/xml').send(twiml);
  }
});

router.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, RecordingUrl } = req.body;

    const conversation = await Conversation.findByCallSid(CallSid);
    if (conversation) {
      const updates = { recording_url: RecordingUrl };

      if (CallStatus === 'completed') {
        const messages = await Conversation.getMessages(conversation.id);
        const transcription = messages.map(m => `${m.role}: ${m.content}`).join('\n');

        const analysis = await aiService.analyzeConversation(transcription, messages);
        updates.transcription = transcription;
        updates.analysis = JSON.stringify(analysis);
        updates.rating = analysis.rating;
        updates.success = analysis.rating >= 7;
      }

      await Conversation.update(conversation.id, updates);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling call status:', error);
    res.sendStatus(500);
  }
});

router.get('/analytics/:agentId?', async (req, res) => {
  try {
    const analytics = await Conversation.getAnalytics(req.params.agentId);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;