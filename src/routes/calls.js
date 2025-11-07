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

// Callback requests management
router.get('/callbacks', async (req, res) => {
  try {
    const { default: CallbackRequest } = await import('../../models/CallbackRequest.js');
    const callbacks = await CallbackRequest.findAll();
    res.json(callbacks);
  } catch (error) {
    console.error('Error fetching callback requests:', error);
    res.status(500).json({ error: 'Failed to fetch callback requests' });
  }
});

router.put('/callbacks/:id', async (req, res) => {
  try {
    const { default: CallbackRequest } = await import('../../models/CallbackRequest.js');
    const { status, notes } = req.body;
    const updated = await CallbackRequest.updateStatus(req.params.id, status, notes);
    if (!updated) {
      return res.status(404).json({ error: 'Callback request not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating callback request:', error);
    res.status(500).json({ error: 'Failed to update callback request' });
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
    const isTransfer = req.query.transfer === 'true';
    const isConsentResponse = req.query.consent === 'true';

    if (!agent) {
      console.error(`Agent not found: ${agentId}`);
      return res.status(404).send('Agent not found');
    }

    // Handle transfer callback time collection
    if (isTransfer) {
      const twilioData = twilioService.parseTwilioRequest(req.body);
      console.log(`Transfer time response: ${twilioData.speechResult}`);

      const conversation = await Conversation.findByCallSid(twilioData.callSid);
      if (conversation) {
        // Import CallbackRequest here to avoid circular dependencies
        const { default: CallbackRequest } = await import('../../models/CallbackRequest.js');

        // Update callback request with preferred time
        const callbackRequests = await CallbackRequest.findByAgentId(agent.id);
        const latestRequest = callbackRequests.find(req =>
          req.conversation_id === conversation.id && req.status === 'pending'
        );

        if (latestRequest && twilioData.speechResult) {
          await CallbackRequest.updateStatus(
            latestRequest.id,
            'pending',
            `Preferred time: ${twilioData.speechResult}`
          );
        }
      }

      // Send goodbye message and hang up
      const goodbyeMessage = "Thank you for providing your preferred time. We'll call you back soon. Goodbye.";
      const goodbyeTts = await aiService.generateTTS(goodbyeMessage, agent.voice);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>
        <Play>${config.app.baseUrl}${goodbyeTts.url}</Play>
        <Hangup/>
      </Response>`;

      return res.type('text/xml').send(twiml);
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
    const isConsentResponse = req.query.consent === 'true';
    console.log(`Call handling - Agent: ${agent.name}, From: ${twilioData.from}, CallSid: ${twilioData.callSid}, Consent: ${isConsentResponse}, Direction: ${twilioData.direction}`);

    let conversation = await Conversation.findByCallSid(twilioData.callSid);

    // Handle consent response first
    if (isConsentResponse) {
      if (!conversation) {
        conversation = await Conversation.create({
          agent_id: agent.id,
          call_sid: twilioData.callSid,
          direction: twilioData.direction || 'inbound',
          customer_number: twilioData.from
        });
        console.log(`Created new conversation: ${conversation.id}`);
      }

      // Check if user agreed to proceed
      const consentResponse = twilioData.speechResult?.toLowerCase() || '';
      const agreed = consentResponse.includes('yes') || consentResponse.includes('agree') ||
                     consentResponse.includes('okay') || consentResponse.includes('sure');

      if (agreed) {
        console.log('User consented, proceeding with conversation');
        // User agreed, start the actual conversation
        const greeting = `Thank you for your consent. ${agent.name} here. How can I help you today?`;
        console.log(`Sending greeting: ${greeting}`);

        const ttsResult = await aiService.generateTTS(greeting, agent.voice);

        await Conversation.addMessage(conversation.id, 'assistant', greeting);
        await Conversation.update(conversation.id, { audio_url: ttsResult.url });

        const twiml = twilioService.generateTwiml(ttsResult.url, `${config.app.baseUrl}/api/calls/twiml/${agent.id}`);
        return res.type('text/xml').send(twiml);
      } else {
        console.log('User did not consent, ending call');
        // User did not agree, end the call
        const goodbyeMessage = "I understand. Thank you for your time. Goodbye.";
        const goodbyeTts = await aiService.generateTTS(goodbyeMessage, agent.voice);

        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>
          <Play>${config.app.baseUrl}${goodbyeTts.url}</Play>
          <Hangup/>
        </Response>`;
        return res.type('text/xml').send(twiml);
      }
    }

    // Check if this is the first interaction (no messages in conversation yet)
    const messages = conversation ? await Conversation.getMessages(conversation.id) : [];
    if (!conversation || messages.length === 0) {
      console.log('First interaction, playing consent message');
      // First interaction - play consent message for both inbound and outbound calls
      const twiml = twilioService.generateConsentTwiml(`${config.app.baseUrl}/api/calls/twiml/${agent.id}`);
      return res.type('text/xml').send(twiml);
    }

    let twiml;
    if (twilioData.speechResult) {
      console.log(`Speech received: ${twilioData.speechResult}`);
      await Conversation.addMessage(conversation.id, 'user', twilioData.speechResult);

      const messages = await Conversation.getMessages(conversation.id);
      const aiResult = await aiService.generateResponse(
        messages.map(m => ({ role: m.role, content: m.content })),
        agent.prompt,
        conversation.id
      );

      console.log(`AI Response: ${aiResult.response}`);
      await Conversation.addMessage(conversation.id, 'assistant', aiResult.response);

      // Handle human transfer request
      if (aiResult.transferRequested) {
        console.log('Human transfer requested, creating callback request');

        // Import CallbackRequest here to avoid circular dependencies
        const { default: CallbackRequest } = await import('../../models/CallbackRequest.js');

        await CallbackRequest.create({
          conversation_id: conversation.id,
          customer_number: twilioData.from,
          agent_id: agent.id,
          reason: aiResult.transferReason,
          status: 'pending'
        });

        // Generate transfer response
        const transferTts = await aiService.generateTTS(aiResult.response, agent.voice);
        await Conversation.update(conversation.id, { audio_url: transferTts.url });

        // Use different TwiML for transfer - gather preferred time
        twiml = twilioService.generateTransferTwiml(transferTts.url, `${config.app.baseUrl}/api/calls/twiml/${agent.id}`);
      } else {
        // Normal response
        const ttsResult = await aiService.generateTTS(aiResult.response, agent.voice);
        await Conversation.update(conversation.id, { audio_url: ttsResult.url });

        twiml = twilioService.generateTwiml(ttsResult.url, `${config.app.baseUrl}/api/calls/twiml/${agent.id}`);
      }
    } else {
      // This shouldn't happen in normal flow since consent comes first for inbound calls
      // For outbound calls, this is the initial greeting
      const greeting = conversation && conversation.direction === 'outbound' 
        ? `Hello! This is ${agent.name}. How can I help you today?`
        : `Hello! This is ${agent.name}. How can I help you today?`;
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

router.get('/recording/:conversationId', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.recording_url) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Fetch the recording from Twilio and proxy it to the client
    const response = await fetch(conversation.recording_url);
    if (!response.ok) {
      return res.status(404).json({ error: 'Failed to fetch recording' });
    }

    const contentType = response.headers.get('content-type') || 'audio/wav';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    response.body.pipe(res);
  } catch (error) {
    console.error('Error fetching recording:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

export default router;