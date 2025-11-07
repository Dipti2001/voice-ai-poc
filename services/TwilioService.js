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

  parseTwilioRequest(body) {
    return {
      callSid: body.CallSid,
      from: body.From,
      to: body.To,
      direction: body.Direction,
      speechResult: body.SpeechResult,
      recordingUrl: body.RecordingUrl,
      callStatus: body.CallStatus,
      digits: body.Digits
    };
  }
}

export default TwilioService;