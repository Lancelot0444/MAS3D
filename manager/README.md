# MAS3D Manager

Centro de operaciones de **MAS3D** (Azogues, Ecuador): clientes, pedidos, cobros, gastos, cuentas y reportes.
Aplicación web instalable (PWA) que funciona en iPhone, iPad, Mac y Windows, con sincronización en tiempo real entre Brian y Mayra.

> **Fase 1** — Sistema esencial. Las fases 2 a 4 (catálogo, cotizaciones, inventario, producción, empleados, talleres, Google Calendar, SRI) se construyen sobre esta base.

## Qué incluye

| Módulo | Funciones |
|---|---|
| **Acceso** | Correo y contraseña o Google · verificación en dos pasos (exigida también por la base de datos) · roles Administrador, Contabilidad, Producción y Pintura · ingreso solo por invitación |
| **Inicio** | Ventas del día y del período (pactadas y realizadas), cobrado, gastos, utilidad bruta, operativa y neta, caja y bancos, cuentas por cobrar y por pagar, préstamos, alertas, gráficos, próximas entregas · períodos: hoy, semana, mes, año, personalizado |
| **Clientes** | Código `CLI-0001` · valida cédula y RUC · evita duplicados · botón de WhatsApp · historial · frecuentes, corporativos y con saldo vencido · archivos |
| **Pedidos** | Código `MAS-2026-0001` · varios productos por pedido, cada uno con su estado · 16 etapas más pausado, cancelado, devolución y retrabajo · tablero Kanban (arrastrar y soltar), tabla y calendario · atrasados resaltados · alerta si está listo con saldo pendiente · anticipo sugerido 50% · envío configurable · recibo imprimible |
| **Finanzas** | Cuentas de dinero con saldo calculado · cobros (anticipo, abono, saldo) · devoluciones · gastos pagados o por pagar con foto del comprobante · transferencias entre cuentas · aportes y retiros de propietarios · préstamos y cuotas (capital e interés separados) · cuadre de caja · anulación auditada |
| **Reportes** | Estado de resultados, ventas, cobros, gastos por categoría, utilidad por pedido, flujo de caja, cuentas por cobrar y por pagar, clientes frecuentes, canales, pedidos pendientes · Excel y PDF |
| **Configuración** | Datos del negocio, IVA, anticipo, envío, días de fabricación · usuarios e invitaciones · categorías de gasto · auditoría · mi cuenta |

## Reglas contables (por qué los números son confiables)

- **Partida doble interna**: cada movimiento genera asientos que deben cuadrar; la base de datos rechaza cualquier asiento descuadrado.
- **La venta se registra al enviar o entregar.** Antes, lo cobrado es *anticipo de cliente* (una deuda con el cliente), no venta ni utilidad.
- Transferencias entre cuentas, préstamos recibidos, aportes y retiros **no** son ingresos ni gastos. La compra de maquinaria es **inversión**.
- **Nada se borra**: un error se *anula* con motivo (solo administradores) y queda la transacción inversa.
- Los saldos se calculan siempre desde los movimientos. Cada registro lleva una clave única que impide duplicados por doble clic.
- El dinero se guarda como `numeric(12,2)` y se calcula en centavos enteros en la app.

## Arquitectura

```
Next.js 15 (React 19, TypeScript, Tailwind 4)  ──►  Supabase
  · páginas del servidor + acciones                    · PostgreSQL (datos, funciones, RLS)
  · PWA instalable                                     · Auth (correo, Google, 2FA)
  · tiempo real (Realtime)                             · Storage privado (archivos)
```

- `supabase/migrations/` — esquema, contabilidad, permisos por rol (RLS) y reportes. **Toda la lógica de dinero vive en funciones de la base de datos**: la app no puede escribir directamente en las tablas contables.
- `src/app/` — pantallas (cada carpeta es una ruta).
- `src/lib/` — dinero, fechas, validaciones ecuatorianas, catálogos, reportes.
- `tests/` — pruebas unitarias y de base de datos (contabilidad, permisos, duplicados, 2FA).
- `scripts/` — respaldo y restauración.

## Comandos

```bash
npm install
npm run dev        # app en http://localhost:3000 (requiere .env.local, ver .env.example)
npm test           # todas las pruebas (necesita PostgreSQL, ver abajo)
npm run typecheck
npm run build
```

Las pruebas de base de datos usan un PostgreSQL 16 real (`TEST_DATABASE_URL`, por defecto `postgres://postgres@127.0.0.1:54329/postgres`):
crean una base temporal, aplican las migraciones y verifican los escenarios contables y de permisos.

**Instalación:** en el VPS con Coolify → [`docs/COOLIFY.md`](docs/COOLIFY.md) (recomendado) · con Vercel → [`docs/INSTALACION.md`](docs/INSTALACION.md).

**Respaldos:** nocturnos, cifrados y verificados automáticamente (`.github/workflows/manager-respaldo.yml`); scripts en `scripts/`.
