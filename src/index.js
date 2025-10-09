import express from 'express';
import bodyParser from 'body-parser';
import config from './config.js';
import callRoutes from './routes/calls.js';

const app = express();

// Twilio sends URL‑encoded bodies by default; also accept JSON for our own API
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Mount call routes
app.use('/', callRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Voice AI POC server is listening on port ${PORT}`);
  console.log(`Ensure your Twilio webhooks point to ${config.app.baseUrl}/voice/inbound`);
});