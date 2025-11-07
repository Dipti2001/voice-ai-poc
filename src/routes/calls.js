import express from 'express';
import Conversation from '../../models/Conversation.js';
import Agent from '../../models/Agent.js';
import Contact from '../../models/Contact.js';
import TwilioService from '../../services/TwilioService.js';
import AIService from '../../services/AIService.js';
import config from '../../src/config.js';

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
    const { agent_id, to, contact_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    if (!to && !contact_id) {
      return res.status(400).json({ error: 'Either phone number or contact ID is required' });
    }

    const agent = await Agent.findById(agent_id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check if agent supports outbound calls
    if (agent.use_case === 'inbound') {
      return res.status(400).json({ error: 'This agent only supports inbound calls' });
    }

    let phoneNumber = to;
    let contact = null;

    if (contact_id) {
      contact = await Contact.findById(contact_id);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      phoneNumber = contact.phone_number;

      // Update contact call stats
      await Contact.updateCallStats(contact_id);
    }

    const callbackUrl = `${config.app.baseUrl}/api/calls/twiml/${agent_id}`;
    const callResult = await twilioService.makeOutboundCall(phoneNumber, agent_id, callbackUrl);

    const conversation = await Conversation.create({
      agent_id,
      call_sid: callResult.callSid,
      direction: 'outbound',
      customer_number: phoneNumber
    });

    res.json({
      ...callResult,
      conversation_id: conversation.id,
      contact: contact ? { id: contact.id, name: contact.name } : null
    });
  } catch (error) {
    console.error('Error making outbound call:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

router.post('/twiml', async (req, res) => {
  try {
    const twilioData = twilioService.parseTwilioRequest(req.body);
    console.log(`Inbound call - From: ${twilioData.from}, To: ${twilioData.to}, CallSid: ${twilioData.callSid}`);
    
    // Method 1: Route by called phone number (if agent has specific phone number)
    const agents = await Agent.findAll();
    const inboundAgents = agents.filter(agent => 
      agent.use_case === 'inbound' || agent.use_case === 'both'
    );

    if (inboundAgents.length === 0) {
      console.error('No inbound agents available');
      const twiml = twilioService.generateNoAgentTwiml();
      return res.type('text/xml').send(twiml);
    }

    // Method 2: Check if this is a digit selection (agent menu choice)
    if (twilioData.digits) {
      const selectedIndex = parseInt(twilioData.digits) - 1;
      if (selectedIndex >= 0 && selectedIndex < inboundAgents.length) {
        const selectedAgent = inboundAgents[selectedIndex];
        console.log(`Agent selected via menu: ${selectedAgent.name} (${selectedAgent.id})`);
        return handleAgentCall(req, res, selectedAgent);
      } else {
        // Invalid selection, show menu again
        const twiml = twilioService.generateAgentSelectionMenu(inboundAgents);
        return res.type('text/xml').send(twiml);
      }
    }

    // Method 3: Route by exact phone number match
    let selectedAgent = inboundAgents.find(agent => 
      agent.phone_number && agent.phone_number === twilioData.to
    );
    
    if (selectedAgent) {
      console.log(`Agent found by phone number: ${selectedAgent.name} (${selectedAgent.phone_number})`);
      return handleAgentCall(req, res, selectedAgent);
    }

    // Method 4: Multiple agents available - show selection menu
    if (inboundAgents.length > 1) {
      console.log(`Multiple agents available, showing selection menu`);
      const twiml = twilioService.generateAgentSelectionMenu(inboundAgents);
      return res.type('text/xml').send(twiml);
    }

    // Method 5: Single agent fallback
    selectedAgent = inboundAgents[0];
    console.log(`Single agent fallback: ${selectedAgent.name} (${selectedAgent.id})`);
    return handleAgentCall(req, res, selectedAgent);
    
  } catch (error) {
    console.error('Error handling default inbound call:', error);
    const twiml = twilioService.generateTwiml();
    res.type('text/xml').send(twiml);
  }
});

router.post('/twiml/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const agent = await Agent.findById(agentId);

    if (!agent) {
      console.error(`Agent not found: ${agentId}`);
      return res.status(404).send('Agent not found');
    }

    return handleAgentCall(req, res, agent);
  } catch (error) {
    console.error('Error handling Twilio webhook:', error);
    const twiml = twilioService.generateTwiml();
    res.type('text/xml').send(twiml);
  }
});

// Shared function to handle agent calls
async function handleAgentCall(req, res, agent) {
  try {
    const twilioData = twilioService.parseTwilioRequest(req.body);
    console.log(`Call handling - Agent: ${agent.name}, From: ${twilioData.from}, CallSid: ${twilioData.callSid}`);
    
    let conversation = await Conversation.findByCallSid(twilioData.callSid);

    if (!conversation) {
      conversation = await Conversation.create({
        agent_id: agent.id,
        call_sid: twilioData.callSid,
        direction: twilioData.direction || 'inbound',
        customer_number: twilioData.from
      });
      console.log(`Created new conversation: ${conversation.id}`);
    }

    let twiml;
    if (twilioData.speechResult) {
      console.log(`Speech received: ${twilioData.speechResult}`);
      await Conversation.addMessage(conversation.id, 'user', twilioData.speechResult);

      const messages = await Conversation.getMessages(conversation.id);
      const aiResponse = await aiService.generateResponse(
        messages.map(m => ({ role: m.role, content: m.content })),
        agent.prompt
      );

      console.log(`AI Response: ${aiResponse}`);
      await Conversation.addMessage(conversation.id, 'assistant', aiResponse);

      const ttsResult = await aiService.generateTTS(aiResponse, agent.voice);
      await Conversation.update(conversation.id, { audio_url: ttsResult.url });

      twiml = twilioService.generateTwiml(ttsResult.url, `${config.app.baseUrl}/api/calls/twiml/${agent.id}`);
    } else {
      const greeting = `Hello! This is ${agent.name}. How can I help you today?`;
      console.log(`Sending greeting: ${greeting}`);
      
      const ttsResult = await aiService.generateTTS(greeting, agent.voice);

      await Conversation.addMessage(conversation.id, 'assistant', greeting);
      await Conversation.update(conversation.id, { audio_url: ttsResult.url });

      twiml = twilioService.generateTwiml(ttsResult.url, `${config.app.baseUrl}/api/calls/twiml/${agent.id}`);
    }

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error in handleAgentCall:', error);
    const twiml = twilioService.generateTwiml();
    res.type('text/xml').send(twiml);
  }
}

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

router.post('/voicemail', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, From } = req.body;
    console.log(`Voicemail received - From: ${From}, CallSid: ${CallSid}, Recording: ${RecordingUrl}`);
    
    // Create a conversation record for the voicemail
    await Conversation.create({
      agent_id: null, // No agent assigned
      call_sid: CallSid,
      direction: 'inbound',
      customer_number: From,
      recording_url: RecordingUrl,
      transcription: 'Voicemail - No agents available'
    });

    // Simple response
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error handling voicemail:', error);
    res.sendStatus(200); // Always respond 200 to Twilio
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