# MAS3D Manager en el VPS de Hostinger con Coolify

**Arquitectura aprobada para evaluar:** Next.js en Coolify (tu VPS) + Supabase administrado (base de datos, inicio de sesión y archivos).

```
 iPad / iPhone / PC de Brian y Mayra
            │  https://app.mas3d.ec
            ▼
 ┌──────── VPS Hostinger KVM 1 (Coolify) ────────┐
 │  Proxy de Coolify (Traefik) · HTTPS automático │
 │            │                                   │
 │  Contenedor MAS3D Manager (Next.js)            │   ← ~150–190 MB de RAM (medido)
 │  límite: 384 MB RAM · 0,5 CPU                  │
 │  tus otras apps siguen igual                   │
 └────────────┬───────────────────────────────────┘
              │ (cifrado)
              ▼
 Supabase: PostgreSQL + Auth + Storage + Realtime   ← los datos NO viven en el VPS
              │
              ▼
 GitHub Actions: compila la app · respaldo nocturno cifrado y verificado
```

> **Regla de esta guía:** las fases 1 y 2 solo **leen**. Nada se instala ni se cambia en el VPS hasta que apruebes el plan de la fase 3.

---

## Fase 1 · Diagnóstico (solo lectura)

### 1.1 En el panel de Coolify
Entra a Coolify (normalmente `http://IP-DEL-VPS:8000` o el dominio que configuraste) y anota:

1. **Settings → versión de Coolify** (abajo a la izquierda o en *Settings*).
2. **Servers → localhost**:
   - pestaña *General*: confirma que el servidor está *Reachable* / *Usable*;
   - pestaña *Proxy*: qué proxy usa (*Traefik* o *Caddy*) y si está corriendo.
3. **Projects**: haz una lista de **todos los recursos** (aplicaciones, bases de datos, servicios) con su estado. Esto es lo que no debemos afectar.
4. **Servers → localhost → Metrics**, si está activo (requiere *Sentinel*): observa la RAM y la CPU durante 1–2 minutos.
5. Si alguno de tus recursos tiene **dominios** configurados, anótalos.

### 1.2 En la terminal
Abre **Servers → localhost → Terminal** en Coolify, o la **Terminal del navegador** de Hostinger (hPanel → VPS → *Browser terminal*). Pega el contenido de [`scripts/diagnostico-vps.sh`](../scripts/diagnostico-vps.sh).

- Es **solo lectura**: no instala, no borra, no reinicia y no muestra contraseñas.
- Copia el resultado completo y envíalo. Si algún nombre de contenedor te parece privado, puedes taparlo.
- **Nunca envíes** contraseñas, claves SSH, tokens de Coolify ni claves de Supabase.

### 1.3 En hPanel de Hostinger
- **VPS → Visión general**: núcleos, RAM y disco del plan.
- **VPS → Copias de seguridad / Snapshots**: si hay copias semanales activas y si existe un snapshot reciente.
- **VPS → Facturación**: el **precio de renovación** del KVM 1 y que la renovación automática esté activa (vencía el 19 de octubre de 2026).
- **VPS → Firewall**: si hay reglas activas.

---

## Fase 2 · Cómo interpretar el diagnóstico

### Requisitos mínimos de MAS3D Manager

| Recurso | Necesita (medido) | Margen recomendado | Límite que pondremos en Coolify |
|---|---|---|---|
| RAM | 143–190 MB con Brian y Mayra usándolo a la vez | 300 MB libres | **384 MB** máx. |
| CPU | Picos cortos al abrir páginas | — | **0,5 CPU** máx. |
| Disco | Imagen de unos 70 MB | 1 GB libre | — |
| Compilación | **0 en el VPS**: la compila GitHub | — | — |

> En la prueba concurrente, Brian y Mayra abrieron 21 páginas cada uno al mismo tiempo: 42 de 42 cargaron bien, en 3,7 s en total.

### Qué consume normalmente Coolify
Coolify sin aplicaciones ocupa unos **500–800 MB** de RAM: `coolify`, `coolify-db` (su propia base PostgreSQL), `coolify-redis`, `coolify-realtime` y `coolify-proxy`. Sus requisitos oficiales mínimos son **2 CPU y 2 GB de RAM**. El KVM 1 tiene **1 vCPU**, por debajo de esa recomendación: esto explicaría parte del **41% de CPU**.

### Semáforo de decisión

| Resultado del diagnóstico | Decisión |
|---|---|
| 🟢 RAM disponible (`available` en `free -m`) **≥ 700 MB** y CPU (carga de 15 min) **< 0,7** | Se despliega en el KVM 1 con los límites indicados |
| 🟡 RAM disponible **400–700 MB**, o no hay swap | Se despliega, pero **antes** se agrega swap de 2 GB y se revisa qué contenedor consume más |
| 🔴 RAM disponible **< 400 MB**, carga sostenida **> 0,9**, o contenedores reiniciándose solos | No desplegar. Primero optimizar o apagar lo que no se use, o pasar a **KVM 2** (2 vCPU / 8 GB) |

Problemas que revisaremos en el diagnóstico:
- Contenedores con `Restarting` o reinicios frecuentes.
- **Imágenes y caché de compilaciones antiguas**: `docker system df`, columna *RECLAIMABLE*. Es espacio recuperable.
- Acceso SSH como root con contraseña habilitado, firewall apagado, actualizaciones pendientes o reinicio pendiente.

---

## Fase 3 · Plan de cambios (requiere tu aprobación, punto por punto)

Cada cambio se hace solo después de aprobarlo, y en este orden:

| # | Cambio | Riesgo | Cómo se deshace |
|---|---|---|---|
| 0 | **Snapshot del VPS** en hPanel, antes de todo | Ninguno | — |
| 1 | Swap de 2 GB (solo si el diagnóstico sale 🟡) | Muy bajo | `swapoff` y borrar el archivo |
| 2 | Credencial de **solo lectura** para descargar la imagen privada de GitHub (`docker login ghcr.io`) | Muy bajo | `docker logout ghcr.io` |
| 3 | En Coolify: **nuevo recurso → Docker Image**, con límites de RAM y CPU, en un proyecto propio `MAS3D` | Bajo: queda aislado y con límites | Eliminar el recurso |
| 4 | Registro DNS `app` → IP del VPS y dominio en el recurso (HTTPS automático) | Bajo: no toca otros dominios | Borrar el registro DNS |
| 5 | Endurecimiento de seguridad (sección 5) | Bajo o medio: se hace con cuidado de no perder el acceso | Cada paso es reversible |

**No se toca:** ninguna aplicación existente, ninguna base de datos existente, ni la configuración del proxy de las otras apps.

---

## Fase 4 · Despliegue (cuando lo apruebes)

### 4.1 Supabase (plan gratuito)
Sigue `docs/INSTALACION.md`, secciones 1.1 a 1.5: crear el proyecto, aplicar las migraciones y configurar el inicio de sesión, Google y las invitaciones.
- En *Authentication → URL Configuration*: Site URL `https://app.mas3d.ec` y Redirect URL `https://app.mas3d.ec/auth/callback`.

### 4.2 GitHub: compilar la imagen
En el repositorio: **Settings → Secrets and variables → Actions**.

**Variables** (pestaña *Variables*; son públicas por diseño):

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://TU_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clave *anon public* de Supabase |
| `NEXT_PUBLIC_SITE_URL` | `https://app.mas3d.ec` |

Luego: pestaña **Actions → "MAS3D Manager · publicar" → Run workflow**. Al terminar (unos 4 minutos), la imagen queda en `ghcr.io/lancelot0444/mas3d-manager` como **privada**.

### 4.3 Coolify: crear el recurso
1. **Projects → + Add → nombre `MAS3D`**.
2. **+ New Resource → Docker Image** → imagen `ghcr.io/lancelot0444/mas3d-manager:latest`.
3. **General**:
   - *Ports Exposes*: `3000`;
   - *Domains*: `https://app.mas3d.ec`. Con `https://`, Coolify pide el certificado de Let's Encrypt automáticamente.
4. **Environment Variables**:

   | Nombre | Valor | Notas |
   |---|---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | clave *service_role* | **Secreta.** Solo aquí. |
   | `NEXT_PUBLIC_SUPABASE_URL` | igual que en GitHub | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | igual que en GitHub | |
   | `NEXT_PUBLIC_SITE_URL` | `https://app.mas3d.ec` | |

5. **Resource Limits**: *Maximum Memory Limit* `384m`, *Number of CPUs* `0.5`.
6. **Health Check**: ruta `/api/salud`, puerto `3000`. La imagen ya trae su propio chequeo.
7. **Deploy**. Comprueba que `https://app.mas3d.ec/api/salud` muestre `"app":"ok","supabase":"ok"`.

### 4.4 Despliegues automáticos (opcional)
En Coolify: **Keys & Tokens → API tokens → crear uno con permiso *deploy***. En GitHub, crea los *Secrets* `COOLIFY_URL`, `COOLIFY_TOKEN` y `COOLIFY_APP_UUID` (el UUID aparece en la URL del recurso en Coolify).

Desde entonces, cada cambio aprobado que llegue a la rama `produccion` se compila en GitHub y se publica solo, sin consumir memoria del VPS.

### 4.5 Volver a la versión anterior
Cada versión queda guardada con su identificador. En Coolify, cambia la imagen a `ghcr.io/lancelot0444/mas3d-manager:<sha-anterior>` y pulsa **Deploy**. GitHub conserva las 5 versiones más recientes.

---

## 5. Dominio propio con HTTPS

1. **hPanel → Dominios → mas3d.ec → DNS → Agregar registro**:
   - Tipo **A**, nombre **app**, apunta a **la IP del VPS**, TTL 3600.
2. Comprueba que el subdominio responda: `https://dnschecker.org` → `app.mas3d.ec` → tipo A.
3. El certificado lo emite y renueva Coolify (Traefik + Let's Encrypt) automáticamente.
4. Si el dominio usa Cloudflare, el registro debe estar en modo **DNS only** (nube gris) la primera vez, para que se emita el certificado.

**Acceso simultáneo:** cada persona tiene su propia sesión segura, guardada en cookies HTTP-only. Las actualizaciones en vivo van **directamente del navegador a Supabase Realtime**, sin pasar por el VPS. Así, el VPS no necesita configuración especial de WebSockets y no aumenta su consumo.

---

## 6. Seguridad

### En la app (ya implementado)
- Ingreso solo por invitación, roles, verificación en dos pasos exigida por la base de datos y bloqueo de producción a los datos financieros (RLS).
- Contenedor ejecutado con **usuario sin privilegios** (no root), con límites de memoria y CPU, y cabeceras de seguridad (HSTS, anti-iframe, nosniff).
- La clave *service_role* solo existe en las variables de Coolify, nunca en el código ni en la imagen.
- Los datos financieros **no viven en el VPS**: si el VPS fuera comprometido, la base sigue protegida por Supabase y por RLS.

### En el VPS (proponer tras el diagnóstico; requiere aprobación)

| Medida | Por qué |
|---|---|
| Firewall (hPanel → VPS → Firewall): permitir solo 22, 80 y 443, y **8000 solo desde tu IP**, o cerrarlo si Coolify usa dominio con HTTPS | Reduce la superficie de ataque |
| SSH solo con **llave**, sin contraseña, y `PermitRootLogin prohibit-password` | Evita ataques de adivinación de contraseñas |
| **Actualizaciones automáticas** de seguridad (`unattended-upgrades`) | Parches sin intervención |
| **Fail2ban** | Bloquea IP que intentan entrar por fuerza |
| Coolify actualizado y con **2FA** en su cuenta de administrador | Coolify controla todo el servidor |
| Panel de Coolify con dominio y HTTPS, por ejemplo `coolify.mas3d.ec` | Evita usar `http://IP:8000` sin cifrar |

---

## 7. Respaldos: tres copias independientes

| Capa | Qué protege | Frecuencia | Dónde | Costo |
|---|---|---|---|---|
| **1. Respaldo nocturno verificado** (`.github/workflows/manager-respaldo.yml`) | Todos los datos y usuarios | Diario, 03:15 (hora de Ecuador) | GitHub (artefacto privado **cifrado AES-256**, 35 días) | $0 |
| **2. Copia mensual fuera de línea** | Lo mismo, con historial largo | Mensual (manual, 2 minutos) | Drive de la empresa | $0 |
| **3. Snapshot del VPS** (Hostinger) | La configuración del VPS y de Coolify | Semanal o antes de cada cambio | Hostinger | Incluido o bajo costo, según el plan |
| *(Opcional)* **Supabase Pro** | Copia diaria gestionada y restauración a cualquier minuto (PITR, complemento aparte) | Diario | Supabase | $25/mes |

### Qué hace el respaldo nocturno
1. Descarga los datos de Supabase.
2. **Los restaura en una base vacía y compara los totales de control** (cantidad de clientes, pedidos y asientos, y sumas del debe y del haber). Si no coinciden, el respaldo **falla** y GitHub envía un correo.
3. Lo cifra con tu clave y lo guarda 35 días.

Este procedimiento se probó durante el desarrollo: respaldo, restauración completa (datos y usuarios) y restauración solo de datos, con huellas idénticas en ambos casos. El cifrado y el descifrado también se probaron, incluido el rechazo de una clave equivocada.

### Configurarlo (una sola vez)
En GitHub → **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Valor |
|---|---|
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → *Connection string* → **Session pooler**, con la contraseña de la base |
| `RESPALDO_CLAVE` | Una frase larga inventada, por ejemplo de 6 palabras. **Guárdala en un gestor de contraseñas y en papel en un lugar seguro: sin ella, los respaldos no se pueden abrir.** |

Luego, **Actions → "MAS3D Manager · respaldo nocturno" → Run workflow** para probarlo.

> **Importante:** el repositorio debe ser **privado** (GitHub → Settings → General → *Danger Zone → Change visibility*). Los respaldos están cifrados, pero conviene que solo ustedes puedan verlos.

### Abrir un respaldo
1. Descarga el artefacto desde Actions; viene como un `.zip`.
2. Descifra el archivo:
   ```bash
   gpg -d mas3d-AAAA-MM-DD_HHMM.tar.gpg | tar -x     # pide la RESPALDO_CLAVE
   ```
3. Restaura siguiendo `docs/INSTALACION.md` §4.3, con `./scripts/restaurar.sh mas3d-AAAA-MM-DD_HHMM`.

### Archivos (fotos y STL)
Viven en Supabase Storage. El plan gratuito incluye 1 GB. Por ahora se copian manualmente cada mes desde el panel de Supabase; la copia automática está prevista para la Fase 4.

---

## 8. Costos mensuales estimados

| Concepto | Opción recomendada | Con Supabase Pro |
|---|---|---|
| VPS KVM 1 (ya contratado) | precio de renovación de tu plan* | igual |
| Coolify | $0 (gratuito, autoinstalado) | $0 |
| Supabase | **$0** (plan gratuito) | $25 |
| GitHub (compilación, respaldos, imagen privada) | **$0** (dentro del plan gratuito)** | $0 |
| Certificado HTTPS | $0 (Let's Encrypt) | $0 |
| Dominio | el que ya pagas | igual |
| **Costo adicional por MAS3D Manager** | **$0** | **$25** |
| Si el diagnóstico obliga a subir a KVM 2 | + diferencia de precio en Hostinger* | |

\* Consúltalo en hPanel → Facturación. Los precios promocionales cambian en la renovación.
\*\* Cuentas gratuitas de GitHub con repositorio privado: 2000 minutos de Actions y 500 MB de paquetes al mes. MAS3D Manager usa aproximadamente 100–150 minutos y menos de 400 MB, porque solo se conservan 5 imágenes.

### Límites del plan gratuito de Supabase y cuándo pasar a Pro
- Base de datos de 500 MB, equivalente a años de pedidos; archivos 1 GB; hasta 50 000 usuarios.
- **Se pausa si nadie lo usa durante 7 días.** Con uso diario no ocurre; si ocurre, se reactiva con un clic y sin perder datos.
- **Pasar a Pro** cuando: los archivos superen ~800 MB, entre más personal, o quieran restauración a cualquier minuto gestionada por Supabase.
