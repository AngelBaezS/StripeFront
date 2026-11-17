# payment-stripe-front — Tienda, Pasarela Stripe y Facturación CFDI 4.0 (Frontend)

Aplicación web construida con **Angular 22**, **Tailwind CSS v4**, **Spartan UI** y **Stripe.js** que consume la API de **PaymentClean**. Implementa autenticación segura mediante cookies `HttpOnly`, catálogo, carrito, checkout multi-modalidad con Stripe (Tarjeta, Transferencia SPEI y Stripe Checkout), historial de pedidos paginado y emisión/descarga de facturas CFDI 4.0.

> [!IMPORTANT]
> Este repositorio **no incluye** claves reales en `src/environments/`. Antes de arrancar la aplicación debes crear los archivos de entorno locales a partir de `src/environments/environment.example.ts`.

---

## Requisitos Previos

- **Node.js 20+** (LTS recomendado)
- **pnpm** (`npm install -g pnpm`)
- Backend **PaymentClean** iniciado y escuchando en `http://localhost:8080`

---

## Configuración Inicial (Sin Claves en el Repositorio)

1. Instala las dependencias:
   ```bash
   pnpm install
   ```

2. Crea tus archivos de entorno locales a partir de la plantilla `environment.example.ts`:
   ```powershell
   Copy-Item src\environments\environment.example.ts src\environments\environment.development.ts
   Copy-Item src\environments\environment.example.ts src\environments\environment.ts
   ```
   *(En Linux/macOS usa `cp` en lugar de `Copy-Item`).*

3. Abre `src/environments/environment.development.ts` (y `environment.ts` si vas a compilar en producción) y coloca **tu clave pública de Stripe (`pk_test_...`)**:
   ```ts
   export const environment = {
     production: false,
     apiUrl: '',
     stripePublicKey: 'pk_test_TU_CLAVE_PUBLICA_DE_STRIPE',
   };
   ```
   > **Nota sobre `apiUrl: ''` y `proxy.conf.json`:** En desarrollo se dejan las rutas relativas (`/api/v1/...`) para que el servidor de Angular (`ng serve`) reenvíe automáticamente `/api/**` hacia `http://localhost:8080` usando [proxy.conf.json](proxy.conf.json). Esto permite que las cookies `HttpOnly` (`SameSite=Strict`) funcionen en el mismo origen tanto en `http://localhost:4200` como a través de un túnel HTTPS.

---

## Cómo Arrancar el Frontend

```bash
pnpm start
```
*(Equivale a `ng serve` con proxy hacia `http://localhost:8080`).*

Abre en tu navegador:
- **Aplicación Web**: `http://localhost:4200`

### Otros Comandos Útiles
- **Compilar para producción**:
  ```bash
  pnpm build
  ```
- **Ejecutar pruebas unitarias (Vitest)**:
  ```bash
  pnpm test -- --watch=false
  ```

---

## Guía de Uso Rápida (Para Evaluación / Entrevista)

### 1. Registro e Inicio de Sesión (`/auth/register` y `/auth/login`)
- Crea una cuenta nueva desde `/auth/register` (puedes elegir rol **`CLIENT`** para probar el flujo completo de compras o **`ADMIN`** para administrar el catálogo).
- Inicia sesión en `/auth/login`. La sesión se mantiene mediante cookie `HttpOnly` (`auth_token`) con renovación automática antes de expirar y redirección al login al cerrar sesión.

### 2. Catálogo y Carrito (`/products` y `/cart`)
- **Como `ADMIN` (`/admin/products`)**: Crea productos nuevos con nombre, descripción, stock, imagen y precio en MXN; el backend crea automáticamente el `Product` y `Price` en Stripe.
- **Como `CLIENT` (`/products`)**: Explora los productos activos, agrégalos al carrito y ajusta cantidades desde `/cart`.

### 3. Checkout con Stripe y Facturación Opcional (`/cart/checkout`)
1. *(Opcional)* Marca **"Requiero factura electrónica (CFDI 4.0)"** y captura manualmente los datos fiscales del receptor (RFC, Código Postal, Razón Social, Régimen Fiscal, Uso de CFDI y correo).
   - Al completar el pago, el sistema guardará los datos, timbrará automáticamente la factura en **CFDI Express** y enviará el PDF y XML al correo indicado vía **Mailtrap**.
   - **Importante en modo Sandbox de CFDI Express:** El PAC de pruebas valida que el receptor exista en la lista de pruebas del SAT (por ejemplo `CACX7605101P8` / `XOCHILT CASAS CHAVEZ` / CP `36257` / Régimen `612` / Uso `G03`) o sea público en general (`XAXX010101000` / `PUBLICO EN GENERAL` / CP del emisor `42501` / Régimen `616` / Uso `S01`).
   - **Importante en modo Sandbox de Mailtrap (`demomailtrap.com`):** Con dominio demo de Mailtrap solo se entregan correos al destinatario propietario de la cuenta configurada en el backend; cualquier otro correo generará error de envío o requerirá configurar un dominio propio en Mailtrap / modo `MAILTRAP_SANDBOX=true`.
2. Elige una modalidad de pago:
   - **Tarjeta / Elements**: Paga dentro del sitio usando tarjetas de prueba de Stripe (ej. `4242 4242 4242 4242`, fecha futura y CVC cualquiera).
   - **Transferencia SPEI**: Ingresa un correo para recibir las instrucciones y descarga la ficha SPEI en PDF con CLABE generada por Stripe (vigencia de 48 horas).
   - **Stripe Checkout**: Abre la pasarela hospedada de Stripe en una nueva pestaña.

### 4. Mis Pedidos y Facturación Post-Compra (`/orders`)
- Visualiza tus pedidos de Stripe paginados (10 elementos por página) y filtrados por pestañas: **Todos**, **Pagados**, **Pendientes de Pago** y **Cancelados**.
- En órdenes **`PENDING`**: puedes descargar nuevamente la ficha PDF SPEI, completar el pago o **Cancelar Orden** manualmente.
- En órdenes **`PAID`**:
  - Si aún no tienen factura, haz clic en **"Solicitar Factura CFDI"** para capturar tus datos fiscales y timbrar una única vez.
  - Una vez timbrada (`STAMPED`), podrás descargar los archivos **PDF** y **XML** y usar **"Reenviar Correo"**.

---

## Exponer por Túnel (Opcional)

El proyecto está configurado en [angular.json](angular.json) y [proxy.conf.json](proxy.conf.json) para funcionar tras un túnel en el puerto `4200` (Cloudflare Tunnel, localhost.run, ngrok o Dev Tunnels):

```powershell
cloudflared tunnel --url http://localhost:4200
# o con OpenSSH:
ssh -R 80:localhost:4200 nokey@localhost.run
```

Si accedes desde una URL de túnel, las redirecciones de retorno de **Stripe Checkout / Elements** toman automáticamente el origen HTTPS desde el cual iniciaste el pago (sin necesidad de editar `FRONTEND_URL` manualmente en `.env` para los dominios de túnel permitidos).
