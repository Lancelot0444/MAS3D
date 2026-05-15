const Anthropic = require('@anthropic-ai/sdk');
const db = require('./database');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS = [
  {
    name: 'set_reminder',
    description: 'Crea un recordatorio para el usuario en una fecha y hora específica.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto del recordatorio' },
        scheduled_at: {
          type: 'string',
          description: 'Fecha y hora en formato ISO 8601, ejemplo: 2024-12-25T20:00:00. Usa la fecha y hora actual como referencia.'
        },
      },
      required: ['text', 'scheduled_at'],
    },
  },
  {
    name: 'list_reminders',
    description: 'Lista todos los recordatorios pendientes del usuario.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'delete_reminder',
    description: 'Elimina un recordatorio por su ID.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID del recordatorio a eliminar' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_event',
    description: 'Agrega un evento o cita a la agenda del usuario.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Nombre del evento' },
        description: { type: 'string', description: 'Descripción o notas del evento' },
        event_date: { type: 'string', description: 'Fecha del evento en formato YYYY-MM-DD' },
        event_time: { type: 'string', description: 'Hora del evento en formato HH:MM (24h)' },
        location: { type: 'string', description: 'Lugar del evento' },
      },
      required: ['title', 'event_date'],
    },
  },
  {
    name: 'list_events',
    description: 'Lista los próximos eventos de la agenda.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Cuántos días hacia adelante mostrar (default: 30)' },
      },
    },
  },
  {
    name: 'delete_event',
    description: 'Elimina un evento de la agenda por su ID.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID del evento a eliminar' },
      },
      required: ['id'],
    },
  },
  {
    name: 'save_idea',
    description: 'Guarda una idea del usuario para futura referencia.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título corto de la idea' },
        content: { type: 'string', description: 'Descripción completa de la idea' },
        tags: { type: 'string', description: 'Etiquetas separadas por coma, ejemplo: negocio,tecnología,app' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'list_ideas',
    description: 'Lista las ideas guardadas del usuario.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Buscar ideas por texto' },
      },
    },
  },
  {
    name: 'delete_idea',
    description: 'Elimina una idea por su ID.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID de la idea a eliminar' },
      },
      required: ['id'],
    },
  },
];

function executeToolCall(toolName, toolInput) {
  switch (toolName) {
    case 'set_reminder': {
      const result = db.createReminder(toolInput.text, toolInput.scheduled_at);
      return `Recordatorio creado con ID ${result.lastInsertRowid}: "${toolInput.text}" para ${toolInput.scheduled_at}`;
    }
    case 'list_reminders': {
      const reminders = db.getAllReminders();
      if (!reminders.length) return 'No hay recordatorios pendientes.';
      return reminders.map(r => `[ID:${r.id}] ${r.text} — ${r.scheduled_at}`).join('\n');
    }
    case 'delete_reminder': {
      db.deleteReminder(toolInput.id);
      return `Recordatorio ${toolInput.id} eliminado.`;
    }
    case 'create_event': {
      const result = db.createEvent(
        toolInput.title, toolInput.description,
        toolInput.event_date, toolInput.event_time, toolInput.location
      );
      return `Evento creado con ID ${result.lastInsertRowid}: "${toolInput.title}" el ${toolInput.event_date}${toolInput.event_time ? ' a las ' + toolInput.event_time : ''}`;
    }
    case 'list_events': {
      const events = db.getUpcomingEvents(toolInput.days || 30);
      if (!events.length) return 'No hay eventos próximos en la agenda.';
      return events.map(e =>
        `[ID:${e.id}] ${e.title} — ${e.event_date}${e.event_time ? ' ' + e.event_time : ''}${e.location ? ' @ ' + e.location : ''}${e.description ? '\n  📝 ' + e.description : ''}`
      ).join('\n');
    }
    case 'delete_event': {
      db.deleteEvent(toolInput.id);
      return `Evento ${toolInput.id} eliminado.`;
    }
    case 'save_idea': {
      const result = db.createIdea(toolInput.title, toolInput.content, toolInput.tags);
      return `Idea guardada con ID ${result.lastInsertRowid}: "${toolInput.title}"`;
    }
    case 'list_ideas': {
      const ideas = toolInput.search
        ? db.searchIdeas(toolInput.search)
        : db.getIdeas(20);
      if (!ideas.length) return 'No hay ideas guardadas.';
      return ideas.map(i =>
        `[ID:${i.id}] *${i.title}*${i.tags ? ' #' + i.tags.replace(/,/g, ' #') : ''}\n  ${i.content}\n  _${i.created_at}_`
      ).join('\n\n');
    }
    case 'delete_idea': {
      db.deleteIdea(toolInput.id);
      return `Idea ${toolInput.id} eliminada.`;
    }
    default:
      return `Herramienta desconocida: ${toolName}`;
  }
}

function buildSystemPrompt() {
  const now = new Date().toLocaleString('es-CL', { timeZone: process.env.TIMEZONE || 'America/Santiago' });
  const userName = process.env.YOUR_NAME || 'Jefe';

  return `Eres Jarvis, el asistente personal de inteligencia artificial de ${userName}. Hablas español latinoamericano de manera natural y directa. Eres eficiente, leal, ligeramente ingenioso y siempre servicial — como el Jarvis de Tony Stark, pero adaptado para la vida cotidiana.

Fecha y hora actual: ${now}

Tus capacidades principales:
- 📅 Gestión de agenda: crear, ver y eliminar eventos y citas
- ⏰ Recordatorios: programar alertas para tareas importantes
- 💡 Banco de ideas: guardar y organizar ideas del usuario
- 🧠 Conversación general: ayudar con preguntas, consejos, brainstorming

Directrices de comportamiento:
- Siempre confirma cuando creas recordatorios o eventos, repitiendo la fecha/hora para verificar
- Si el usuario da una hora sin fecha, asume hoy si la hora no ha pasado, o mañana si ya pasó
- Para ideas, extrae un título conciso del texto aunque el usuario no lo diga
- Sé proactivo: si el usuario menciona algo importante sin pedir explícitamente guardar, ofrece hacerlo
- Usa emojis ocasionalmente para dar contexto visual pero sin exagerar
- Cuando listes recordatorios o eventos, formatea de manera clara y legible
- Si el usuario dice "recuérdame", "agéndame", "guarda esta idea", usa las herramientas disponibles`;
}

async function processMessage(userMessage) {
  // Save user message to history
  db.addMessage('user', userMessage);
  const history = db.getRecentHistory(20);

  const messages = history.map(h => ({ role: h.role, content: h.content }));

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(),
    tools: TOOLS,
    messages,
  });

  // Agentic loop: keep processing tool calls until done
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults = toolUseBlocks.map(block => ({
      type: 'tool_result',
      tool_use_id: block.id,
      content: executeToolCall(block.name, block.input),
    }));

    // Add assistant turn + tool results to messages
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages,
    });
  }

  const textContent = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // Save assistant response to history
  db.addMessage('assistant', textContent);

  return textContent;
}

module.exports = { processMessage };
