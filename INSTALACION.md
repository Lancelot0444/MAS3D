# MAS3D — App de pedidos y contabilidad

App web para MAS3D (impresiones 3D): pedidos, pagos y anticipos, gastos, utilidades, reportes,
calculadora de cotización y entregas sincronizadas con Google Calendar.
Funciona en iPad, celular y computadora. Acceso con usuario y contraseña (Brian y Mayra).

**Requisitos:** hosting de Hostinger con PHP 8.1 o superior y una base de datos MySQL (vienen en todos los planes web).

---

## Paso 1 — Crear la base de datos en Hostinger

1. Entra a **hPanel → Sitios web → Administrar → Bases de datos → Administración de MySQL**.
2. Crea una base de datos nueva (por ejemplo `mas3d`), con su usuario y una contraseña segura.
3. Anota estos tres datos: **nombre de la base**, **usuario** y **contraseña** (Hostinger les agrega un prefijo, como `u123456789_mas3d`).
4. En **Avanzado → Configuración de PHP**, revisa que la versión sea **8.1 o mayor**.

## Paso 2 — Subir los archivos

1. En GitHub, descarga el repositorio: **Code → Download ZIP**.
2. En hPanel abre el **Administrador de archivos** y entra a `public_html`.
   - Si quieres la app en un subdominio (por ejemplo `app.tudominio.com`), créalo primero en **Dominios → Subdominios** y entra a su carpeta.
3. Sube el ZIP, haz clic derecho y elige **Extraer**. Si se crea una carpeta como `mas3d-main/`, mueve todo su contenido a la carpeta del sitio.
   - Asegúrate de que se suba también el archivo oculto `.htaccess`, que protege la configuración.
4. Duplica `config.sample.php`, ponle el nombre **`config.php`** y edítalo:
   - `db` → los tres datos del Paso 1 (`host` se queda en `localhost`).
   - `base_url` → la dirección de la app, por ejemplo `https://app.tudominio.com`.
5. En **Seguridad → SSL**, verifica que el dominio tenga SSL activo (https).

## Paso 3 — Instalar y crear los usuarios

1. Abre `https://tudominio.com/install.php`.
2. Escribe nombre, usuario y contraseña para **Brian** y para **Mayra** (mínimo 8 caracteres).
3. Pulsa **Instalar**.
4. **Borra el archivo `install.php`** desde el Administrador de archivos.

Cada uno puede cambiar su contraseña después en **👤 Mi cuenta**.

## Paso 4 — Conectar Google Calendar (avisos de entrega)

Este paso se hace una sola vez con la cuenta de Google donde quieres ver las entregas.

1. Entra a <https://script.google.com> con esa cuenta y crea un **Proyecto nuevo**. Ponle de nombre `MAS3D Calendario`.
2. Borra el contenido de `Code.gs` y pega el archivo **`apps-script/Code.gs`** de este repositorio.
3. Cambia `SECRET` por una clave larga inventada, por ejemplo `mas3d-8f2k-Lq93-zzT1-2026`.
4. Si quieres que **Mayra** también reciba los eventos en su propio calendario, escribe su correo en `GUESTS`, así: `const GUESTS = ['correo.de.mayra@gmail.com'];`
5. En la barra de arriba elige la función **`probar`** y pulsa **▶ Ejecutar**. Google pedirá permisos:
   **Revisar permisos → tu cuenta → Configuración avanzada → Ir a MAS3D Calendario → Permitir**.
   Esto crea el calendario **"MAS3D – Entregas"**.
6. Pulsa **Implementar → Nueva implementación → ⚙ Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario**
   - Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
7. En `config.php`, en la sección `google_calendar`:
   - `script_url` → la URL que copiaste.
   - `secret` → la misma clave que pusiste en `SECRET`.

A partir de ahí, cada pedido con fecha de entrega crea un evento con:

- una notificación **1 día antes** y otra **2 horas antes**;
- un **correo 1 día antes**.

Si cambias la fecha o el estado, el evento se actualiza. Si cancelas o eliminas el pedido, el evento se borra.
Para cambiar los avisos, edita `POPUP_REMINDERS` y `EMAIL_REMINDERS` en `Code.gs`. Después ve a
**Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**.

> Para que las notificaciones lleguen al iPad o al celular, instala la app **Google Calendar** con esa cuenta
> y confirma que el calendario "MAS3D – Entregas" esté activado.

## Paso 5 — Instalar en el iPad como app

1. Abre la dirección de la app en **Safari**.
2. Toca **Compartir (□↑) → Agregar a pantalla de inicio**.
3. El ícono de MAS3D quedará en el iPad y se abrirá a pantalla completa, como una app normal.

---

## Cómo se usa

| Sección | Para qué sirve |
|---|---|
| **Inicio** | Ingresos, gastos y utilidad del mes, cuánto te deben, y entregas atrasadas o de los próximos 14 días. |
| **Pedidos** | Crear y editar pedidos, cambiar el estado (Cotizado → Confirmado → Imprimiendo → Post-procesado → Listo → Entregado), registrar anticipos y pagos, ver el saldo y escribir al cliente por WhatsApp. |
| **Ingresos** | Todos los cobros del mes, por forma de pago. También acepta ingresos que no vienen de un pedido. |
| **Gastos** | Filamento, luz, repuestos, publicidad, impresoras, etc., con resumen por categoría. |
| **Reportes** | Ingresos, gastos y utilidad mes a mes, gastos por categoría, ventas por canal, mejores clientes, y exportación a Excel (CSV). |
| **Cotizar** | La calculadora de siempre, con el botón **“Crear pedido con esta cotización”**. |

**Cómo se calcula la utilidad:**

- **Utilidad del mes** = dinero que entró (ingresos) − dinero que salió (gastos). Es la utilidad real.
- **Utilidad estimada de un pedido** = precio de venta − costo estimado (viene de la calculadora). Sirve para saber qué pedidos dejan más.

## Seguridad

- Contraseñas cifradas. Tras 8 intentos fallidos en 15 minutos, el acceso se bloquea temporalmente.
- La sesión se cierra sola tras 12 horas sin uso.
- `config.php` y las carpetas internas están bloqueados por `.htaccess`.
- **Respaldo:** en hPanel → **Bases de datos → phpMyAdmin → Exportar** puedes descargar una copia. Hostinger también hace respaldos automáticos.
