# 🤖 Jarvis — Tu Asistente Personal de WhatsApp

Jarvis es tu asistente personal con IA que vive en WhatsApp. Maneja recordatorios, agenda y guarda tus ideas usando Claude como cerebro.

---

## ¿Qué puede hacer?

| Función | Ejemplos de mensajes |
|---|---|
| ⏰ **Recordatorios** | "Recuérdame tomar la medicina a las 8pm" |
| 📅 **Agenda** | "Agéndame reunión con el dentista el viernes a las 3pm" |
| 💡 **Ideas** | "Tengo una idea: crear una app de turnos médicos online" |
| 📋 **Ver agenda** | "¿Qué tengo esta semana?" / "Muéstrame mis recordatorios" |
| 🗑️ **Eliminar** | "Elimina el recordatorio 3" / "Borra el evento 5" |
| ☀️ **Resumen diario** | Automático cada mañana a las 8am |

---

## Configuración paso a paso

### 1. Cuenta de Twilio (gratuita para empezar)

1. Regístrate en [twilio.com](https://www.twilio.com)
2. Ve a **Messaging → Try it out → Send a WhatsApp message**
3. Sigue las instrucciones para conectar tu WhatsApp personal al sandbox
   - Envía el código que te dan (ej: `join silver-lamp`) al número de Twilio desde tu WhatsApp
4. Copia tu **Account SID** y **Auth Token** del dashboard

> El sandbox de Twilio es gratuito y funciona perfectamente para uso personal.
> Para producción se puede upgrade a WhatsApp Business API.

### 2. API Key de Anthropic

1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. Crea una API key
3. Copia el valor (empieza con `sk-ant-...`)

### 3. Instalar y configurar

```bash
# Clonar o acceder al directorio
cd jarvis

# Instalar dependencias
npm install

# Copiar el archivo de configuración
cp .env.example .env

# Editar .env con tus valores
nano .env   # o usa cualquier editor
```

Llena estos valores en `.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # número del sandbox de Twilio
YOUR_WHATSAPP_NUMBER=whatsapp:+56912345678   # TU número con código de país
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxx
TIMEZONE=America/Santiago
YOUR_NAME=Tu nombre
```

### 4. Exponer el servidor (ngrok)

Twilio necesita una URL pública para enviar los mensajes. Usa ngrok:

```bash
# Instalar ngrok: https://ngrok.com/download
# En una terminal separada:
ngrok http 3000

# Copia la URL HTTPS que aparece, ejemplo:
# https://abc123.ngrok.io
```

### 5. Configurar el webhook en Twilio

1. Ve a [Twilio Console → Sandbox Settings](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. En **"When a message comes in"** pon: `https://TU-URL-NGROK.ngrok.io/webhook`
3. Método: `HTTP POST`
4. Guarda

### 6. Iniciar Jarvis

```bash
npm start
# o para desarrollo con auto-reload:
npm run dev
```

¡Envía un mensaje a tu número de Twilio desde WhatsApp y Jarvis responderá!

---

## Arquitectura

```
Tu WhatsApp → Twilio → Webhook (Express)
                              ↓
                       Claude claude-sonnet-4-6
                       (con herramientas)
                              ↓
                       SQLite Database
                    (recordatorios, eventos, ideas)
                              ↓
                       Twilio → Tu WhatsApp
```

**Archivos:**
```
jarvis/
├── server.js          # Servidor Express + webhook
├── src/
│   ├── claude.js      # Integración Claude API + tools
│   ├── whatsapp.js    # Envío/validación de mensajes Twilio
│   ├── database.js    # Base de datos SQLite
│   └── scheduler.js   # Recordatorios automáticos (cron)
├── data/              # jarvis.db (auto-generado)
└── .env               # Tu configuración (no en git)
```

---

## Producción (opcional)

Para tener Jarvis siempre activo en tu iPhone sin depender de tu computador:

1. **Railway / Render / Fly.io** — hostea el servidor gratis
2. Configura las variables de entorno en la plataforma
3. Twilio apunta directamente a tu URL de producción (sin ngrok)

---

## Seguridad

- Solo responde mensajes de `YOUR_WHATSAPP_NUMBER` — nadie más puede usar tu Jarvis
- La API key de Anthropic y los tokens de Twilio nunca se suben al repositorio (`.gitignore`)
