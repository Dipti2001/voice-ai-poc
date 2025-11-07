# 🎯 Voice AI Agent System v2.0

A sophisticated **multi-agent voice AI platform** that enables natural conversations between customers and customizable AI agents. Supports inbound/outbound calling, real-time speech processing, conversation analytics, and a comprehensive web management interface.

## 🌟 Key Features

### 🤖 **Multi-Agent Management**
- Create and manage multiple AI agents with custom personalities
- Configurable prompts, voices, and phone numbers per agent
- Agent-specific conversation analytics and performance tracking

### 📞 **Advanced Telephony**
- Inbound and outbound call handling via Twilio
- Real-time audio streaming with WebSocket support
- Call recording and storage with automatic transcription

### 🗣️ **High-Quality Speech Processing**
- **ASR**: Deepgram Nova-2 for 95%+ accurate speech recognition
- **TTS**: Deepgram Aura voices (Asteria, Orion, Luna) for natural speech synthesis
- **Streaming**: Real-time bidirectional audio processing

### 🧠 **Intelligent Conversations**
- GPT-4 powered responses via OpenRouter
- Conversation memory and context awareness
- Automatic conversation analysis and rating (1-10 scale)
- Success factor identification and improvement suggestions

### 📊 **Analytics & Reporting**
- Real-time conversation monitoring
- Performance metrics per agent
- Automated call analysis and insights
- Success rate tracking and trend analysis

### 🎨 **Web Management Interface**
- Intuitive dashboard for agent management
- Live call monitoring and conversation viewing
- Outbound call initiation
- Real-time analytics display

## 🏗️ **Architecture Overview**

```
Voice AI Agent System v2.0
├── 🎯 Multi-Agent Core
│   ├── Agent Management (CRUD operations)
│   ├── Personality Configuration
│   └── Performance Analytics
├── 📞 Telephony Engine
│   ├── Twilio Integration
│   ├── Call Routing & Handling
│   └── WebSocket Streaming
├── 🧠 AI Services
│   ├── OpenRouter GPT-4 Integration
│   ├── Deepgram ASR/TTS
│   └── Conversation Analysis
├── 💾 Data Layer
│   ├── SQLite Database
│   ├── Conversation Storage
│   └── Analytics Aggregation
└── 🌐 Web Interface
    ├── Agent Management UI
    ├── Call Monitoring Dashboard
    └── Real-time Analytics
```

## 📁 **Project Structure**

```
voice-ai-agent-system/
├── database/
│   └── connection.js          # SQLite database connection
├── models/
│   ├── Agent.js               # Agent data model
│   └── Conversation.js        # Conversation data model
├── services/
│   ├── AIService.js           # LLM, ASR, TTS integration
│   ├── TwilioService.js       # Telephony operations
│   └── WebSocketService.js    # Real-time audio streaming
├── src/
│   ├── config.js              # Environment configuration
│   ├── index.js               # Express server & WebSocket
│   └── routes/
│       ├── agents.js          # Agent management API
│       └── calls.js           # Call operations API
├── public/
│   ├── index.html             # Web management interface
│   ├── css/
│   │   └── styles.css         # UI styling
│   └── js/
│       └── app.js             # Frontend JavaScript
├── scripts/
│   └── init-db.js             # Database initialization
├── prompts/
│   └── default_prompt.txt     # Default agent prompt
├── .env.example               # Configuration template
├── package.json               # Dependencies & scripts
└── README.md                  # This documentation
```

## 🚀 **Quick Start**

### Prerequisites
- Node.js 18+
- Twilio account with phone number
- OpenRouter API key
- Deepgram API key

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd voice-ai-agent-system
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Initialize database**
   ```bash
   npm run init-db
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the web interface**
   ```
   http://localhost:3000
   ```

## ⚙️ **Configuration**

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | ✅ | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | ✅ | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | ✅ | Twilio phone number |
| `LLM_API_KEY` | ✅ | OpenRouter API key |
| `DEEPGRAM_API_KEY` | ✅ | Deepgram API key |
| `PORT` | ❌ | Server port (default: 3000) |
| `APP_BASE_URL` | ❌ | Public URL for webhooks |
| `NODE_ENV` | ❌ | Environment (development/production) |

### Twilio Setup

1. **Configure Webhooks**: Set your Twilio phone number's voice webhook to:
   ```
   POST {APP_BASE_URL}/api/calls/twiml/{agent-id}
   ```

2. **Agent-Specific Routing**: Each agent gets a unique webhook URL for call routing

## 🎯 **Usage Guide**

### Creating Your First Agent

1. Open the web interface at `http://localhost:3000`
2. Click "Create Agent"
3. Configure:
   - **Name**: Agent's display name
   - **Type**: Sales, Support, Information, etc.
   - **Voice**: Choose from Aura Asteria, Orion, or Luna
   - **Phone Number**: Optional dedicated number
   - **Prompt**: Personality and instructions

### Example Agent Prompt
```
You are Sarah, an enthusiastic sales representative for Intelvox AI.
You specialize in voice automation solutions.

Key Services:
- AI Voice Assistants
- Automated Call Handling
- Natural Language Processing
- Real-time Speech Analytics

Be friendly, knowledgeable, and focus on understanding customer needs.
Always offer to schedule a demo or provide more information.
```

### Making Calls

#### Outbound Calls
1. Click "Make Call" in the web interface
2. Select an agent
3. Enter the phone number
4. Click "Make Call"

#### Inbound Calls
- Calls to your Twilio number automatically route to the default agent
- Agent-specific routing via webhook URLs

### Monitoring Conversations

- **Live Monitoring**: View active conversations in real-time
- **Call History**: Browse past conversations with transcripts
- **Analytics**: Track performance metrics and success rates
- **Detailed View**: See full conversation transcripts and analysis

## 🔧 **API Reference**

### Agent Management

```http
GET    /api/agents           # List all agents
GET    /api/agents/:id       # Get agent details
POST   /api/agents           # Create new agent
PUT    /api/agents/:id       # Update agent
DELETE /api/agents/:id       # Delete agent
```

### Call Operations

```http
GET    /api/calls            # List conversations
GET    /api/calls/:id        # Get conversation details
POST   /api/calls/outbound   # Initiate outbound call
GET    /api/calls/analytics  # Get analytics
POST   /api/calls/status     # Twilio status callback
```

### WebSocket Events

```javascript
// Start listening for agent
{
  type: 'start',
  agentId: 'agent-uuid',
  callSid: 'twilio-call-sid'
}

// Send audio data
{
  type: 'audio',
  audio: 'base64-encoded-audio'
}

// Stop listening
{
  type: 'stop'
}
```

## 📊 **Analytics & Reporting**

### Key Metrics
- **Total Calls**: Volume of conversations handled
- **Success Rate**: Percentage of successful interactions
- **Average Rating**: AI-assigned conversation quality (1-10)
- **Response Time**: Average time to generate responses
- **Duration**: Average call length

### Conversation Analysis
- **Automated Rating**: AI-powered quality assessment
- **Success Factors**: Identified positive elements
- **Improvement Areas**: Suggested enhancements
- **Topic Analysis**: Key discussion points

## 🔒 **Security & Performance**

### Security Measures
- **API Key Encryption**: Secure credential storage
- **Rate Limiting**: Request throttling (100 req/15min)
- **Input Validation**: Comprehensive data sanitization
- **CORS Configuration**: Controlled cross-origin access
- **Helmet.js**: Security headers and protections

### Performance Optimizations
- **Response Caching**: Frequently used responses
- **Audio Optimization**: MP3 compression and cleanup
- **Database Indexing**: Optimized query performance
- **Connection Pooling**: Efficient resource management

## 🚀 **Deployment**

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure SSL certificates
- [ ] Set proper `APP_BASE_URL`
- [ ] Enable database backups
- [ ] Configure monitoring/logging
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure auto-scaling

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 **Testing & Development**

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev  # Auto-restart on changes
```

### Database Management
```bash
npm run init-db  # Initialize/reset database
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 **License**

This project is provided for educational and commercial purposes. See LICENSE file for details.

## 🆘 **Support**

- **Documentation**: Comprehensive guides in `/docs`
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Email**: Contact for enterprise support

---

**Built with ❤️ using Node.js, Express, SQLite, WebSocket, Twilio, Deepgram, and OpenRouter**