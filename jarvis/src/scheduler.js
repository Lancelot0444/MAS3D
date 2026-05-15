const cron = require('node-cron');
const db = require('./database');
const { sendMessage } = require('./whatsapp');

function startScheduler() {
  // Check for due reminders every minute
  cron.schedule('* * * * *', async () => {
    const pending = db.getPendingReminders();
    for (const reminder of pending) {
      try {
        await sendMessage(`⏰ *Recordatorio:* ${reminder.text}`);
        db.markReminderSent(reminder.id);
      } catch (err) {
        console.error(`Failed to send reminder ${reminder.id}:`, err.message);
      }
    }
  }, { timezone: process.env.TIMEZONE || 'America/Santiago' });

  // Every morning at 8am: send daily summary
  cron.schedule('0 8 * * *', async () => {
    try {
      const events = db.getUpcomingEvents(7);
      const reminders = db.getAllReminders();

      if (!events.length && !reminders.length) return;

      let summary = `☀️ *Buenos días, ${process.env.YOUR_NAME || 'Jefe'}!*\n\nAquí está tu resumen del día:\n`;

      if (events.length) {
        summary += '\n📅 *Eventos próximos (7 días):*\n';
        summary += events.map(e =>
          `• ${e.title} — ${e.event_date}${e.event_time ? ' a las ' + e.event_time : ''}${e.location ? ' @ ' + e.location : ''}`
        ).join('\n');
      }

      if (reminders.length) {
        summary += '\n\n⏰ *Recordatorios pendientes:*\n';
        summary += reminders.map(r => `• ${r.text} — ${r.scheduled_at}`).join('\n');
      }

      await sendMessage(summary);
    } catch (err) {
      console.error('Failed to send daily summary:', err.message);
    }
  }, { timezone: process.env.TIMEZONE || 'America/Santiago' });

  console.log('✅ Scheduler started');
}

module.exports = { startScheduler };
