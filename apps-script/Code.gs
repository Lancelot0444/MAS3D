/**
 * MAS3D — Puente con Google Calendar
 *
 * Este script recibe los pedidos desde la app (Hostinger) y crea, actualiza
 * o borra el evento de entrega en tu Google Calendar, con recordatorios.
 *
 * Instalación: ver INSTALACION.md, paso 4.
 */

// 1) Inventa una clave larga y pégala aquí y en config.php ('secret').
const SECRET = 'CAMBIAR_POR_UNA_CLAVE_LARGA';

// 2) Nombre del calendario (se crea solo si no existe).
const CALENDAR_NAME = 'MAS3D – Entregas';

// 3) Correos que también reciben el evento (por ejemplo, el Gmail de Mayra).
//    Déjalo vacío [] si no quieres invitar a nadie.
const GUESTS = [];

// 4) Recordatorios (minutos antes de la hora de entrega).
const POPUP_REMINDERS = [24 * 60, 2 * 60];   // notificación 1 día antes y 2 horas antes
const EMAIL_REMINDERS = [24 * 60];           // correo 1 día antes

const TIMEZONE = 'America/Guayaquil';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET) return json({ ok: false, error: 'Clave secreta incorrecta' });

    const cal = getCalendar();

    if (data.action === 'delete') {
      const ev = data.eventId ? findEvent(cal, data.eventId) : null;
      if (ev) ev.deleteEvent();
      return json({ ok: true });
    }

    if (data.action === 'upsert') {
      const start = Utilities.parseDate(data.start, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
      const end = Utilities.parseDate(data.end, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
      let ev = data.eventId ? findEvent(cal, data.eventId) : null;

      if (ev) {
        ev.setTitle(data.title);
        ev.setTime(start, end);
        ev.setDescription(data.description || '');
        ev.setLocation(data.location || '');
      } else {
        ev = cal.createEvent(data.title, start, end, {
          description: data.description || '',
          location: data.location || '',
          guests: GUESTS.join(','),
          sendInvites: GUESTS.length > 0,
        });
      }
      ev.removeAllReminders();
      POPUP_REMINDERS.forEach(function (m) { ev.addPopupReminder(m); });
      EMAIL_REMINDERS.forEach(function (m) { ev.addEmailReminder(m); });
      return json({ ok: true, eventId: ev.getId() });
    }

    if (data.action === 'ping') return json({ ok: true, calendar: cal.getName() });

    return json({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function getCalendar() {
  const found = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  if (found.length) return found[0];
  const cal = CalendarApp.createCalendar(CALENDAR_NAME, { color: CalendarApp.Color.PURPLE, timeZone: TIMEZONE });
  return cal;
}

function findEvent(cal, id) {
  try { return cal.getEventById(id); } catch (e) { return null; }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecuta esta función una vez desde el editor para dar permisos y crear el calendario. */
function probar() {
  const cal = getCalendar();
  Logger.log('Calendario listo: ' + cal.getName());
}
