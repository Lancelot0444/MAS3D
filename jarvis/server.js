require('dotenv').config();
const express = require('express');
const { processMessage } = require('./src/claude');
const { sendMessage, isAuthorizedSender } = require('./src/whatsapp');
const { startScheduler } = require('./src/scheduler');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Jarvis online', time: new Date().toISOString() });
});

// Twilio WhatsApp webhook
app.post('/webhook', async (req, res) => {
  // Acknowledge immediately to Twilio (must respond within 15s)
  res.sendStatus(200);

  const from = req.body.From;
  const body = req.body.Body?.trim();

  if (!body || !from) return;

  // Security: only respond to your own number
  if (!isAuthorizedSender(from)) {
    console.warn(`Unauthorized message from ${from}`);
    return;
  }

  console.log(`[${new Date().toISOString()}] Message from ${from}: ${body}`);

  try {
    const reply = await processMessage(body);
    if (reply) {
      await sendMessage(reply, from);
    }
  } catch (err) {
    console.error('Error processing message:', err);
    await sendMessage('⚠️ Tuve un problema procesando tu mensaje. Por favor intenta de nuevo.', from);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Jarvis running on port ${PORT}`);
  startScheduler();
});
