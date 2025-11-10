import twilio from 'twilio';

/**
 * Tenant-specific Twilio service with isolated credentials
 */
class TenantTwilioService {
  constructor(credentials) {
    this.updateCredentials(credentials);
  }

  /**
   * Update Twilio credentials
   * @param {Object} credentials - Twilio credentials
   */
  updateCredentials(credentials) {
    this.credentials = credentials;
    this.client = twilio(credentials.accountSid, credentials.authToken);
    this.phoneNumber = credentials.phoneNumber;
  }

  /**
   * Parse Twilio webhook request
   * @param {Object} body - Request body
   * @returns {Object} Parsed request data
   */
  parseTwilioRequest(body) {
    return {
      callSid: body.CallSid,
      from: body.From,
      to: body.To,
      direction: body.Direction || 'inbound',
      speechResult: body.SpeechResult,
      digits: body.Digits,
      recordingUrl: body.RecordingUrl
    };
  }

  /**
   * Make outbound call
   * @param {string} to - Destination phone number
   * @param {string} callId - Internal call ID
   * @param {string} webhookUrl - Webhook URL for call handling
   * @returns {Promise<Object>} Call result
   */
  async makeOutboundCall(to, callId, webhookUrl) {
    try {
      const call = await this.client.calls.create({
        to,
        from: this.phoneNumber,
        url: webhookUrl,
        record: true,
        statusCallback: `${webhookUrl}/status`,
        statusCallbackEvent: ['completed'],
        statusCallbackMethod: 'POST'
      });

      return {
        callSid: call.sid,
        status: call.status,
        direction: 'outbound'
      };
    } catch (error) {
      console.error('Error making outbound call:', error);
      throw error;
    }
  }

  /**
   * Generate consent TwiML
   * @param {string} actionUrl - Action URL for consent response
   * @returns {string} TwiML XML
   */
  generateConsentTwiml(actionUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>
      <Gather input="speech" action="${actionUrl}?consent=true" method="POST" timeout="10" speechTimeout="auto" language="en-US">
        <Say voice="alice">This call may be recorded for quality and training purposes. Do you consent to being recorded? Please say yes or no.</Say>
      </Gather>
      <Say voice="alice">I didn't hear a response. Please call back. Goodbye.</Say>
      <Hangup/>
    </Response>`;
  }

  /**
   * Generate standard TwiML for conversation
   * @param {string} audioUrl - URL for audio playback
   * @param {string} actionUrl - Action URL for next interaction
   * @param {boolean} enableBargeIn - Enable barge-in capability
   * @returns {string} TwiML XML
   */
  generateTwiml(audioUrl = null, actionUrl = null, enableBargeIn = true) {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (audioUrl && actionUrl) {
      twiml += `<Gather input="speech" action="${actionUrl}" method="POST" timeout="3" speechTimeout="auto" language="en-US" actionOnEmptyResult="false" bargeIn="${enableBargeIn ? 'true' : 'false'}">`;
      twiml += `<Play>${audioUrl}</Play>`;
      twiml += '</Gather>';
      twiml += "<Say voice=\"alice\">I didn't catch that. Let me connect you to someone who can help.</Say>";
      twiml += '<Hangup/>';
    } else {
      twiml += '<Say voice="alice">Thank you for calling. Goodbye.</Say>';
      twiml += '<Hangup/>';
    }

    twiml += '</Response>';
    return twiml;
  }

  /**
   * Generate transfer TwiML for human handoff
   * @param {string} audioUrl - URL for transfer message audio
   * @param {string} actionUrl - Action URL for time collection
   * @returns {string} TwiML XML
   */
  generateTransferTwiml(audioUrl, actionUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>
      <Play>${audioUrl}</Play>
      <Gather input="speech" action="${actionUrl}?transfer=true" method="POST" timeout="10" speechTimeout="auto" language="en-US">
        <Say voice="alice">What time would be best for someone to call you back?</Say>
      </Gather>
      <Say voice="alice">Thank you. Someone will call you back soon. Goodbye.</Say>
      <Hangup/>
    </Response>`;
  }

  /**
   * Generate error TwiML
   * @returns {string} TwiML XML
   */
  generateErrorTwiml() {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>
      <Say voice="alice">I'm sorry, we're experiencing technical difficulties. Please try calling again later. Goodbye.</Say>
      <Hangup/>
    </Response>`;
  }

  /**
   * Generate agent selection menu TwiML
   * @param {Array} agents - List of available agents
   * @returns {string} TwiML XML
   */
  generateAgentSelectionMenu(agents) {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    twiml += '<Gather input="dtmf" action="" method="POST" timeout="10" numDigits="1">';
    twiml += '<Say voice="alice">Please select an agent. ';
    
    agents.forEach((agent, index) => {
      const menuNumber = index + 1;
      twiml += `Press ${menuNumber} for ${agent.name}, our ${agent.type} specialist. `;
    });
    
    twiml += 'Press any key to repeat this menu.</Say>';
    twiml += '</Gather>';
    
    twiml += '<Say voice="alice">No selection made. Connecting you to our first available agent.</Say>';
    twiml += '<Redirect method="POST"></Redirect>';
    
    twiml += '</Response>';
    return twiml;
  }

  /**
   * Generate no agent available TwiML
   * @returns {string} TwiML XML
   */
  generateNoAgentTwiml() {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>
      <Say voice="alice">I'm sorry, all our agents are currently unavailable. Please leave a message after the tone, and we'll get back to you soon.</Say>
      <Record action="/api/calls/voicemail" method="POST" maxLength="60" transcribe="true"/>
      <Say voice="alice">Thank you for your message. Goodbye.</Say>
      <Hangup/>
    </Response>`;
  }

  /**
   * Validate webhook signature (security)
   * @param {string} signature - Twilio signature
   * @param {string} url - Webhook URL
   * @param {Object} params - Request parameters
   * @returns {boolean} Signature validity
   */
  validateWebhookSignature(signature, url, params) {
    try {
      return twilio.validateRequest(
        this.credentials.authToken,
        signature,
        url,
        params
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }
}

export { TenantTwilioService };