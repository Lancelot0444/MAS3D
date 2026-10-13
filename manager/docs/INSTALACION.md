# MAS3D Manager · Instalación, despliegue y respaldos

Esta guía usa la **opción A** del plan: la app se publica en **Vercel**, los datos viven en **Supabase**, y tu dominio de **Hostinger** apunta a la app.
Todo se puede hacer desde un navegador (también desde el iPad). Tiempo estimado: unos 45 minutos.

> Los nombres de menús de Supabase, Vercel y Google cambian con el tiempo. Si un botón no está exactamente donde dice la guía, búscalo con un nombre parecido.

---

## 1. Crear el proyecto en Supabase (base de datos, usuarios y archivos)

1. Entra a <https://supabase.com> e inicia sesión con la cuenta de Google de la empresa.
2. **New project**:
   - *Name*: `mas3d-manager`.
   - *Database password*: genera una clave larga y **guárdala en un gestor de contraseñas**. Se necesita para los respaldos.
   - *Region*: **East US (North Virginia)**, la más cercana a Ecuador con buena latencia.
3. Para uso real, cambia el proyecto al plan **Pro**. El plan gratuito se pausa si no se usa durante una semana y **no tiene respaldos automáticos**.

### 1.1 Crear las tablas (migraciones)

**Opción sencilla (desde el navegador):**
1. En Supabase abre **SQL Editor → New query**.
2. Copia y ejecuta, **en este orden**, el contenido de cada archivo de `manager/supabase/migrations/`:
   1. `20261014000100_base.sql`
   2. `20261014000200_clientes_pedidos.sql`
   3. `20261014000300_contabilidad.sql`
   4. `20261014000400_pedidos_api_reportes.sql`
   5. `20261014000500_seguridad.sql`
   6. `20261014000600_mfa.sql`
3. Cada uno debe terminar con *Success*. Si alguno falla, **no sigas**: copia el error y avísame.

**Opción con computadora (recomendada para futuras actualizaciones):** instala la [CLI de Supabase](https://supabase.com/docs/guides/cli) y, dentro de la carpeta `manager`:
```bash
supabase login
supabase link --project-ref TU_REF      # el "Reference ID" está en Project Settings → General
supabase db push                        # aplica las migraciones pendientes, en orden
```

### 1.2 Activar el tiempo real
En **Database → Publications → supabase_realtime**, confirma que estén marcadas las tablas `pedidos`, `pedido_items`, `pedido_historial`, `transacciones`, `gastos` y `clientes`. La migración ya las agrega; esto solo es una verificación.

### 1.3 Configurar el inicio de sesión
En **Authentication**:
- **URL Configuration**
  - *Site URL*: `https://app.mas3d.ec` (o el dominio que elijan).
  - *Redirect URLs*: agrega `https://app.mas3d.ec/auth/callback`. Mientras pruebas, agrega también `https://*.vercel.app/auth/callback`.
- **Sign In / Providers → Email**: deja activo *Email*. Recomendado: **desactiva "Allow new users to sign up"**. Así solo entra quien fue invitado desde la app. Aunque alguien se registre, sin invitación no tiene acceso a nada.
- **Multi-Factor → TOTP**: activado (habilita la verificación en dos pasos).
- **Emails**: el correo integrado de Supabase sirve para pocas invitaciones al día. Para más, configura un SMTP propio en *SMTP Settings*.

### 1.4 Iniciar sesión con Google (opcional, recomendado)
1. En <https://console.cloud.google.com> crea un proyecto `MAS3D Manager`.
2. **APIs & Services → OAuth consent screen**: tipo *External*, nombre *MAS3D Manager*, correo de soporte de la empresa.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - *Authorized redirect URI*: `https://TU_REF.supabase.co/auth/v1/callback`
4. Copia el *Client ID* y el *Client secret*. Pégalos en Supabase, en **Authentication → Providers → Google**, y actívalo.

### 1.5 Dar acceso a Brian y Mayra (primer administrador)
En **SQL Editor** ejecuta, con los correos reales:
```sql
insert into public.invitaciones (email, nombre, rol) values
  ('correo-de-brian@gmail.com', 'Brian', 'administrador'),
  ('correo-de-mayra@gmail.com', 'Mayra', 'administrador');
```
Después, cada persona entra a la app con **"Continuar con Google"** usando ese correo. También pueden recibir una invitación desde **Authentication → Users → Invite user**. Al entrar, el sistema les asigna el rol automáticamente. A partir de ahí, las demás personas se invitan desde **Configuración → Usuarios**.

> Si alguien ya había entrado antes de ser invitado, aparecerá en *Configuración → Usuarios* "sin rol": un administrador se lo asigna ahí.

---

## 2. Publicar la app en Vercel

1. Entra a <https://vercel.com> con la cuenta de GitHub que tiene acceso al repositorio `mas3d`.
2. **Add New → Project → Import** el repositorio.
3. **Root Directory**: `manager`. El framework se detecta solo como *Next.js*.
4. **Environment Variables**: los valores están en Supabase, **Project Settings → API**.

   | Variable | Valor | Notas |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://TU_REF.supabase.co` | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave *anon / public* | Puede verse en el navegador: los permisos los aplica la base de datos. |
   | `SUPABASE_SERVICE_ROLE_KEY` | clave *service_role* | **SECRETA.** Solo en Vercel, nunca en el código ni en mensajes. Se usa para enviar invitaciones. |
   | `NEXT_PUBLIC_SITE_URL` | `https://app.mas3d.ec` | Dirección final de la app. |

5. **Deploy**. Al terminar, Vercel da una dirección `https://mas3d-manager-xxxx.vercel.app` para probar.
6. Para uso comercial se requiere el plan **Pro** de Vercel. El plan Hobby es solo para uso personal.

### 2.1 Conectar el dominio de Hostinger
1. En Vercel: **Project → Settings → Domains → Add** `app.mas3d.ec`. Vercel indicará un registro **CNAME**, normalmente `cname.vercel-dns.com`.
2. En Hostinger: **hPanel → Dominios → mas3d.ec → DNS / Nameservers → Administrar registros DNS**:
   - Tipo **CNAME**, nombre **app**, apunta a `cname.vercel-dns.com`, TTL por defecto.
3. Espera entre 5 minutos y 1 hora. Vercel emite el certificado HTTPS automáticamente.
4. Actualiza `NEXT_PUBLIC_SITE_URL` y las URLs de Supabase (paso 1.3) con el dominio final. Luego, en Vercel, **Redeploy**.

### 2.2 Opción B: Node.js en Hostinger
Si su plan de Hostinger es **Business o Cloud**, incluye *Node.js Web Apps*:
1. hPanel → **Websites → Add website → Node.js Web App** → conectar el repositorio de GitHub.
2. Carpeta raíz: `manager`. Comando de compilación: `npm ci && npm run build`. Comando de inicio: `npm start`. Node 20 o superior.
3. Agrega las mismas 4 variables de entorno de la tabla anterior.

---

## 3. Primeros pasos dentro de la app

1. **Configuración → Negocio**: revisa los datos, el RUC y los parámetros (anticipo 50%, envío $7, 5 días de fabricación).
2. **IVA**: queda **desactivado** hasta que su contador lo confirme. Cuando lo confirme, actívalo, elige si los precios lo incluyen y marca *"Nuestro contador confirmó esta configuración"*.
3. **Finanzas → Cuentas**: crea cada cuenta de dinero de la **empresa** (caja, banco principal, Deuna, PayPal…). Después registra su **saldo inicial real** en la fecha de corte que elijan.
4. **Configuración → Mi cuenta → Verificación en dos pasos**: actívala en las cuentas de Brian y Mayra.
5. En el iPad o iPhone: abre la app en **Safari → Compartir → Agregar a pantalla de inicio**. En Mac o Windows con Chrome o Edge: ícono de **Instalar** en la barra de direcciones.

---

## 4. Respaldos y recuperación

### 4.1 Automáticos (Supabase Pro)
Supabase guarda una copia diaria durante 7 días: **Database → Backups**. Desde ahí se restaura con un clic. Para poder volver a cualquier minuto, existe el complemento *Point in Time Recovery*.

> **Importante:** estos respaldos incluyen la base de datos, pero **no los archivos** subidos (fotos, STL). Para estos, ver 4.4.

### 4.2 Respaldo propio (recomendado cada semana y antes de cada actualización)
Requiere una computadora con PostgreSQL 16 (`pg_dump`, `psql`). En la carpeta `manager`:
```bash
export DATABASE_URL="postgresql://postgres.TU_REF:CLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
./scripts/respaldo.sh
```
La cadena exacta está en **Project Settings → Database → Connection string → Session pooler**.

Se generan dos archivos en `respaldos/`:
- `mas3d-AAAA-MM-DD_HHMM.sql.gz`: los datos. Contienen información financiera y personal, así que **guárdalos cifrados o en un Drive privado de la empresa, nunca en GitHub**.
- `…huella.txt`: totales de control, para verificar una restauración.

### 4.3 Restaurar (procedimiento probado)
1. Crea un **proyecto nuevo** en Supabase. Nunca restaures encima del proyecto con problemas.
2. Aplica las migraciones (paso 1.1).
3. Restaura:
   ```bash
   export DATABASE_URL="postgresql://...proyecto-nuevo..."
   ./scripts/restaurar.sh respaldos/mas3d-AAAA-MM-DD_HHMM.sql.gz
   ```
4. Compara los totales que se imprimen con el archivo `.huella.txt`: deben ser **idénticos**.
5. En Vercel, cambia las 3 variables de Supabase al proyecto nuevo y haz **Redeploy**.

Este procedimiento se probó durante el desarrollo: respaldo, restauración en una base vacía y huellas idénticas (pedidos, asientos, sumas del debe y del haber, usuarios y auditoría).

### 4.4 Archivos (fotos, STL, comprobantes)
Están en **Storage → adjuntos**. Por ahora se descargan manualmente desde ese panel. La copia automática de archivos se incluirá en la Fase 4.

---

## 5. Actualizaciones

1. Cada cambio llega como *pull request* en GitHub. La revisión automática (*MAS3D Manager · pruebas*) debe quedar en verde.
2. **Antes** de aplicar migraciones nuevas: haz un respaldo (4.2).
3. Aplica las migraciones nuevas (`supabase db push` o SQL Editor, en orden).
4. Une el pull request: Vercel publica la nueva versión automáticamente.

---

## 6. Claves y seguridad

| Clave | Dónde se obtiene | Dónde se guarda |
|---|---|---|
| Contraseña de la base de datos | La creas al crear el proyecto | Gestor de contraseñas. Solo para respaldos. |
| `anon key` | Supabase → Project Settings → API | Vercel (es pública por diseño) |
| `service_role key` | Supabase → Project Settings → API | **Solo Vercel.** Si se filtra: Supabase → API → *Roll* para generar otra. |
| Google OAuth *Client secret* | Google Cloud → Credentials | Solo en Supabase → Providers → Google |

- Ninguna clave está en el código. `.env.local` está excluido de Git.
- Las cuentas bancarias se registran solo con los **últimos 4 dígitos**.
- Producción y Pintura no pueden ver dinero, utilidades, cuentas ni deudas. Lo impide la **base de datos** (RLS), no solo la pantalla; hay pruebas automáticas que lo verifican.

---

## 7. Desarrollo local (opcional, para programadores)

```bash
cd manager
cp .env.example .env.local      # completar con un proyecto de Supabase de pruebas
npm install
npm run dev
```
Pruebas: `npm test`. Necesita un PostgreSQL 16 accesible en `TEST_DATABASE_URL`. Cada prueba crea y borra su propia base temporal.
