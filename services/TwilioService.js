import twilio from 'twilio';
import config from '../src/config.js';

class TwilioService {
  constructor() {
    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    this.phoneNumber = config.twilio.phoneNumber;
  }

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

  async makeOutboundCall(to, agentId, callbackUrl) {
    try {
      const call = await this.client.calls.create({
        to,
        from: this.phoneNumber,
        url: callbackUrl,
        record: true,
        statusCallback: `${config.app.baseUrl}/api/calls/status`,
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

  generateTwiml(audioUrl = null, actionUrl = null, enableBargeIn = true) {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (audioUrl) {
      // Use shorter timeout and enable barge-in for natural conversation
      twiml += `<Gather input="speech" action="${actionUrl}" method="POST" timeout="1" speechTimeout="auto" language="en-US" actionOnEmptyResult="true" bargeIn="${enableBargeIn ? 'true' : 'false'}">`;
      twiml += `<Play>${audioUrl}</Play>`;
      twiml += '</Gather>';
    } else {
      // For initial greeting or error cases
      twiml += `<Gather input="speech" action="${actionUrl}" method="POST" timeout="3" speechTimeout="auto" language="en-US" actionOnEmptyResult="true" bargeIn="true">`;
      twiml += '<Pause length="1"/>';
      twiml += '</Gather>';
    }

    twiml += '</Response>';
    return twiml;
  }

  generateConsentTwiml(actionUrl) {
    const consentMessage = "Hello, this is an AI-powered call. Our conversation will be recorded for quality and training purposes. If you agree to proceed, please say 'yes' or 'I agree'. If you do not wish to continue, you may hang up or say 'no'.";

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    // Play consent message and gather response
    twiml += `<Gather input="speech" action="${actionUrl}?consent=true" method="POST" timeout="10" speechTimeout="auto" language="en-US" actionOnEmptyResult="false" bargeIn="true">`;
    twiml += `<Say voice="alice">${consentMessage}</Say>`;
    twiml += '</Gather>';

    // If no response or rejection, hang up
    twiml += '<Say voice="alice">Thank you for your time. Goodbye.</Say>';
    twiml += '<Hangup/>';

    twiml += '</Response>';
    return twiml;
  }

  generateStreamingTwiml(streamUrl) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="${streamUrl}" />
        </Connect>
        <Pause length="30"/>
      </Response>`;
    return twiml;
  }

  async getCallRecording(callSid) {
    try {
      const recordings = await this.client.recordings.list({ callSid });
      return recordings.length > 0 ? recordings[0] : null;
    } catch (error) {
      console.error('Error getting call recording:', error);
      return null;
    }
  }

  async updateCallStatus(callSid, status) {
    try {
      const call = await this.client.calls(callSid).update({ status });
      return call;
    } catch (error) {
      console.error('Error updating call status:', error);
      throw error;
    }
  }

  generateAgentSelectionMenu(agents) {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    // Create menu options
    twiml += '<Gather input="dtmf" action="" method="POST" timeout="10" numDigits="1">';
    twiml += '<Say voice="alice">Please select an agent. ';
    
    agents.forEach((agent, index) => {
      const menuNumber = index + 1;
      twiml += `Press ${menuNumber} for ${agent.name}, our ${agent.type} specialist. `;
    });
    
    twiml += 'Press any key to repeat this menu.</Say>';
    twiml += '</Gather>';
    
    // Fallback if no input
    twiml += '<Say voice="alice">No selection made. Connecting you to our first available agent.</Say>';
    twiml += '<Redirect method="POST"></Redirect>';
    
    twiml += '</Response>';
    return twiml;
  }

  generateTransferTwiml(audioUrl, actionUrl) {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    // Play the transfer message and gather preferred time
    twiml += `<Gather input="speech" action="${actionUrl}?transfer=true" method="POST" timeout="10" speechTimeout="auto" language="en-US" actionOnEmptyResult="true" bargeIn="true">`;
    twiml += `<Play>${audioUrl}</Play>`;
    twiml += '</Gather>';

    // If no response, hang up gracefully
    twiml += '<Say voice="alice">Thank you for your patience. We\'ll call you back soon. Goodbye.</Say>';
    twiml += '<Hangup/>';

    twiml += '</Response>';
    return twiml;
  }
}

export default TwilioService;