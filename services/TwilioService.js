import twilio from 'twilio';
import config from '../src/config.js';

class TwilioService {
  constructor() {
    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    this.phoneNumber = config.twilio.phoneNumber;
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

  generateTwiml(audioUrl = null, actionUrl = null) {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (audioUrl) {
      twiml += `<Play>${config.app.baseUrl}${audioUrl}</Play>`;
    }

    if (actionUrl) {
      twiml += `<Gather input="speech" action="${actionUrl}" method="POST" timeout="3" speechTimeout="auto" language="en-US" actionOnEmptyResult="true"><Pause length="1"/></Gather>`;
    } else {
      twiml += '<Hangup/>';
    }

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

  generateNoAgentTwiml() {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    twiml += '<Say voice="alice">We apologize, but no agents are currently available to take your call. Please try again later or leave a message after the tone.</Say>';
    twiml += '<Record action="/api/calls/voicemail" method="POST" maxLength="60" finishOnKey="#" />';
    twiml += '<Say voice="alice">Thank you for your message. Goodbye.</Say>';
    twiml += '<Hangup/>';
    twiml += '</Response>';
    return twiml;
  }
}

export default TwilioService;