const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
const toNumber = process.env.YOUR_WHATSAPP_NUMBER;

let twilioClient;

function getClient() {
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

async function sendMessage(text, to = toNumber) {
  // WhatsApp has a 1600 char limit per message; split if needed
  const chunks = splitMessage(text, 1500);
  for (const chunk of chunks) {
    await getClient().messages.create({
      from: fromNumber,
      to,
      body: chunk,
    });
  }
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }
    // Try to split at a newline
    let cutAt = remaining.lastIndexOf('\n', maxLen);
    if (cutAt < maxLen * 0.5) cutAt = maxLen;
    parts.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  return parts;
}

// Validate that the incoming message is from the authorized user
function isAuthorizedSender(from) {
  return from === toNumber;
}

module.exports = { sendMessage, isAuthorizedSender };
