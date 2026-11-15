# Guía de Integración y Documentación de Endpoints — PaymentClean API

Documentación técnica de todos los endpoints REST del backend **PaymentClean** (Spring Boot + Hexagonal Architecture + Stripe + MySQL) para su integración desde frontend (Angular, React, móvil) o clientes HTTP.

---

## 1. Información General y Convenciones

* **URL Base Local:** `http://localhost:8080`
* **Documentación Interactiva (Scalar / OpenAPI):**
  * UI interactiva: `http://localhost:8080/scalar`
  * Especificación OpenAPI JSON: `http://localhost:8080/v3/api-docs`
* **CORS:** Configurado en `SecurityConfig` para aceptar peticiones desde `http://localhost:4200` con los métodos `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH` y envío de credenciales/cabecera `Authorization`.
* **Formato de Precios y Moneda:**
  * Moneda fija: **`mxn`** (Pesos Mexicanos).
  * Todos los montos se manejan en **centavos** (`Long` / entero), nunca en decimales flotantes.
  * *Ejemplo:* `$1,500.00 MXN` debe enviarse y leerse como `150000`. Para mostrarlo en el frontend divide entre `100`.
* **Formato de Identificadores (`IdGenerator`):**
  * Todos los IDs son cadenas alfanuméricas (`String`) prefijadas por entidad (4 caracteres de prefijo + 16 caracteres aleatorios `[0-9a-z]`):
    * `usr_...` — Usuario
    * `prd_...` — Producto
    * `crt_...` — Carrito
    * `cit_...` — Ítem del carrito
    * `ord_...` — Orden de pago
    * `oit_...` — Ítem de orden
* **Autenticación:**
  * Basada en **JWT (Bearer Token)** con vigencia de **10 horas**.
  * En endpoints protegidos se debe enviar el header HTTP:
    ```http
    Authorization: Bearer <token_jwt>
    ```

---

## 2. Flujo de Integración Recomendado

```mermaid
sequenceDiagram
    autonumber
    actor Front as Frontend (localhost:4200)
    participant Auth as /api/v1/auth
    participant Prod as /api/v1/products
    participant Cart as /api/v1/cart
    participant Order as /api/v1/order
    participant Stripe as Stripe Checkout / Elements
    participant Hook as /api/webhooks/stripe

    Front->>Auth: POST /register (si es usuario nuevo)
    Front->>Auth: POST /login -> recibe JWT (text/plain)
    Front->>Prod: GET /api/v1/products -> muestra catálogo
    Front->>Cart: POST /api/v1/cart/items (Bearer JWT) -> agrega producto
    Cart-->>Front: CartDetail (items, subtotales, totalAmountCents)
    Front->>Order: POST /api/v1/order/payment-link o /direct-payment (Bearer JWT, sin body)
    Note over Order: Valida stock y precios en BD<br/>Bloquea el carrito a LOCKED<br/>Crea orden ord_... en estado PENDING
    Order-->>Front: StripePaymentResult (paymentUrl o clientSecret)
    Front->>Stripe: Usuario completa el pago
    Stripe->>Hook: Webhook checkout.session.completed / payment_intent.succeeded
    Note over Hook: Marca orden como PAID (idempotente)<br/>Descuenta el stock del producto en BD
```

---

## 3. Resumen Rápido de Endpoints

| Módulo | Método | Ruta | Rol / Auth | Descripción |
| :--- | :--- | :--- | :---: | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` *(alias `/auth/register`)* | Público | Registra usuario (`CLIENT` por defecto o `ADMIN`) |
| **Auth** | `POST` | `/api/v1/auth/login` *(alias `/auth/login`)* | Público | Inicia sesión, devuelve JWT (con claim `"role"`) y header `X-User-Role` |
| **Auth** | `POST` | `/api/v1/auth/refresh` *(alias `/auth/refresh`)* | JWT Vigente | Valida vigencia del JWT y emite uno nuevo en JSON (`RefreshTokenResponse`) |
| **Auth** | `GET` | `/api/v1/auth/me` *(alias `/auth/me`)* | `CLIENT` / `ADMIN` | Devuelve perfil y rol del usuario autenticado |
| **Auth** | `PUT` | `/api/v1/auth/me/username` *(alias `/auth/me/username`)* | `CLIENT` / `ADMIN` | Actualiza el username del usuario autenticado y devuelve nuevo JWT |
| **Auth** | `PUT` | `/api/v1/auth/me/password` *(alias `/auth/me/password`)* | `CLIENT` / `ADMIN` | Cambia la contraseña validando la contraseña actual |
| **Catálogo** | `GET` | `/api/v1/products` | Público | Lista productos públicos para el cliente |
| **Admin** | `GET` | `/api/v1/admin/products` | **`ADMIN`** | Lista productos con datos completos, stock y IDs de Stripe |
| **Admin** | `POST` | `/api/v1/admin/products` | **`ADMIN`** | Crea producto en BD y en Stripe |
| **Admin** | `PUT` | `/api/v1/admin/products/{productId}/price` | **`ADMIN`** | Actualiza precio de producto en Stripe y BD |
| **Carrito** | `GET` | `/api/v1/cart` | `CLIENT` / `ADMIN` | Obtiene (o crea) el carrito `ACTIVE` del usuario |
| **Carrito** | `POST` | `/api/v1/cart/items` | `CLIENT` / `ADMIN` | Agrega producto o incrementa su cantidad |
| **Carrito** | `DELETE` | `/api/v1/cart/items/{id}` | `CLIENT` / `ADMIN` | Elimina un ítem por `cit_...` o `prd_...` |
| **Carrito** | `DELETE` | `/api/v1/cart` | `CLIENT` / `ADMIN` | Vacía todos los ítems del carrito `ACTIVE` |
| **Órdenes** | `GET` | `/api/v1/order` | `CLIENT` / `ADMIN` | Lista las órdenes del usuario (cancela automáticamente las pendientes con >48h) |
| **Órdenes** | `GET` | `/api/v1/order/{orderId}/payment` | `CLIENT` / `ADMIN` | Recupera o regenera `StripePaymentResult` para una orden pendiente |
| **Órdenes** | `POST` | `/api/v1/order/direct-payment` | `CLIENT` / `ADMIN` | Crea orden y `PaymentIntent` (`clientSecret`) |
| **Órdenes** | `POST` | `/api/v1/order/spei-payment` | `CLIENT` / `ADMIN` | Crea orden y ficha de transferencia **SPEI** (`speiDetails` con CLABE y referencia) |
| **Órdenes** | `POST` | `/api/v1/order/{orderId}/spei-payment` | `CLIENT` / `ADMIN` | Genera o recupera instrucciones **SPEI** para una orden pendiente |
| **Órdenes** | `POST` | `/api/v1/order/payment-link` | `CLIENT` / `ADMIN` | Crea orden y Checkout Session (`paymentUrl`) |
| **Webhook** | `POST` | `/api/webhooks/stripe` | Firma Stripe | Recibe confirmaciones asíncronas de Stripe (tarjeta, SPEI y cancelaciones) |

---

## 4. Detalle de Endpoints

### 4.1 Autenticación y Roles (`UserController`)

#### Registrar usuario
* **Endpoint:** `POST /api/v1/auth/register` *(también responde en `POST /auth/register`)*
* **Autenticación:** Pública (`permitAll`).
* **Request Body (`application/json`):**
  * `role` es opcional: si no se envía (o se envía `"CLIENT"`), se asigna el rol `CLIENT`. Si se envía `"ADMIN"`, se registra como `ADMIN`.
  ```json
  {
    "username": "angel",
    "email": "angel@correo.com",
    "password": "Password123!",
    "phone": "5512345678",
    "role": "CLIENT"
  }
  ```
* **Respuesta Exitosa (`200 OK` - `text/plain`):**
  > ⚠️ **Importante para el frontend:** Devuelve texto plano (`String`), **no JSON**. En `fetch` usa `response.text()` y en Angular `HttpClient` usa `{ responseType: 'text' }`.
  ```text
  Usuario creado exitosamente
  ```
* **Qué hace internamente:** Genera un ID `usr_...`, encripta la contraseña con BCrypt, registra al cliente en Stripe (`cus_...`) y guarda el usuario en MySQL con su rol (`CLIENT` o `ADMIN`).

---

#### Iniciar sesión (Login)
* **Endpoint:** `POST /api/v1/auth/login` *(también responde en `POST /auth/login`)*
* **Autenticación:** Pública (`permitAll`).
* **Request Body (`application/json`):**
  ```json
  {
    "username": "angel",
    "password": "Password123!"
  }
  ```
* **Respuesta Exitosa (`200 OK` - `text/plain`):**
  > ⚠️ **Importante para el frontend:** Devuelve el JWT en texto plano (`String`). Además:
  > 1. **Dentro del payload del JWT** viene el claim `"role": "ADMIN"` o `"role": "CLIENT"`.
  > 2. **En los headers HTTP de respuesta** viene `X-User-Role: ADMIN` o `X-User-Role: CLIENT` (expuesto por CORS).
  ```text
  eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhbmdlbCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc2MjkwNjAwMCwiZXhwIjoxNzYyOTQyMDAwfQ.ejemplo_firma
  ```
* **Posibles Errores:**
  * `404 Not Found` (`USER_NOT_FOUND`): El `username` no existe.
  * `401 Unauthorized` (`INVALID_CREDENTIALS`): Contraseña incorrecta.

---

#### Obtener perfil y rol del usuario actual (`/me`)
* **Endpoint:** `GET /api/v1/auth/me` *(también responde en `GET /auth/me`)*
* **Autenticación:** **Requiere JWT** (`Authorization: Bearer <token>`).
* **Respuesta Exitosa (`200 OK` - `application/json` - `UserProfileResponse`):**
  ```json
  {
    "id": "usr_al294egcvs60mefr",
    "username": "angel",
    "email": "angel@correo.com",
    "phone": "5512345678",
    "role": "ADMIN"
  }
  ```

---

#### Actualizar / Renovar token JWT (`/refresh`)
* **Endpoint:** `POST /api/v1/auth/refresh` *(también responde en `POST /auth/refresh`)*
* **Autenticación:** **Requiere JWT vigente** en el header `Authorization: Bearer <token>` (o opcionalmente en el body `{ "token": "..." }`).
* **Configuración de vigencia:** `JWT_EXPIRATION_MS` en `.env` / `jwt.expiration-ms` en `application.properties` (`36000000` ms = 10 horas por defecto).
* **Respuesta Exitosa (`200 OK` - `application/json` - `RefreshTokenResponse`):**
  * También incluye el header `X-User-Role` con el rol vigente del usuario en base de datos.
  ```json
  {
    "token": "eyJhbGciOiJIUzM4NCJ9...",
    "role": "ADMIN",
    "expiresAt": "2026-11-13T19:00:00Z",
    "refreshed": true
  }
  ```
* **Posibles Errores:**
  * `401 Unauthorized` (`TOKEN_EXPIRED`): El token ya caducó; el frontend debe cerrar sesión.
  * `401 Unauthorized` (`INVALID_TOKEN`): Token ausente, malformado, firma inválida o usuario inexistente.

---

#### Actualizar username del usuario actual (`/me/username`)
* **Endpoint:** `PUT /api/v1/auth/me/username` *(también responde en `PUT /auth/me/username`)*
* **Autenticación:** **Requiere JWT vigente** (`CLIENT` o `ADMIN`).
* **Request Body (`UpdateUsernameRequest`):**
  ```json
  {
    "username": "nuevo_usuario"
  }
  ```
* **Respuesta Exitosa (`200 OK` - `application/json` - `UpdateUsernameResponse`):**
  Devuelve el nuevo JWT (con `sub` actualizado) y el perfil actualizado:
  ```json
  {
    "token": "eyJhbGciOiJIUzM4NCJ9...",
    "profile": {
      "id": "usr_al294egcvs60mefr",
      "username": "nuevo_usuario",
      "email": "angel@correo.com",
      "phone": "5512345678",
      "role": "ADMIN"
    }
  }
  ```
* **Posibles Errores:**
  * `400 Bad Request`: Username vacío o fuera del rango permitido (3 a 50 caracteres).
  * `409 Conflict`: El nombre de usuario ya está en uso por otra cuenta.

---

#### Cambiar contraseña del usuario actual (`/me/password`)
* **Endpoint:** `PUT /api/v1/auth/me/password` *(también responde en `PUT /auth/me/password`)*
* **Autenticación:** **Requiere JWT vigente** (`CLIENT` o `ADMIN`).
* **Request Body (`UpdatePasswordRequest`):**
  ```json
  {
    "currentPassword": "passwordActual123",
    "newPassword": "nuevaPassword456"
  }
  ```
* **Respuesta Exitosa (`200 OK` - `application/json` - `MessageResponse`):**
  ```json
  {
    "message": "Contraseña actualizada correctamente."
  }
  ```
* **Posibles Errores:**
  * `400 Bad Request`: Contraseña actual incorrecta, nueva contraseña menor a 6 caracteres o igual a la contraseña actual.

---

### 4.2 Catálogo Público (`ProductController`)

#### Listar productos para usuarios
* **Endpoint:** `GET /api/v1/products`
* **Autenticación:** Pública (`permitAll`).
* **Parámetros / Body:** Ninguno.
* **Respuesta Exitosa (`200 OK` - `application/json`):**
  Devuelve un arreglo de `ProductForUser` (omite campos internos como `stripeProductId`, `stripePriceId`, `stock` y `active`):
  ```json
  [
    {
      "id": "prd_a1b2c3d4e5f6g7h8",
      "name": "Laptop Gamer",
      "description": "Laptop RTX 3080",
      "unitAmountCents": 150000,
      "imageUrl": "https://ejemplo.com/imagenes/laptop.png"
    }
  ]
  ```

---

### 4.3 Administración de Catálogo (`AdminController`)

> 🔒 **Protegido por Rol:** Todos los endpoints bajo `/api/v1/admin/**` exigen un token JWT con rol **`ADMIN`** (`hasRole("ADMIN")`). Si un usuario con rol `CLIENT` intenta invocarlos, el servidor responde `403 Forbidden`.

#### Listar todos los productos (vista administrativa)
* **Endpoint:** `GET /api/v1/admin/products`
* **Autenticación:** **Requiere JWT con rol `ADMIN`**.
* **Respuesta Exitosa (`200 OK` - `application/json`):**
  Devuelve un arreglo de objetos `Product` completos:
  ```json
  [
    {
      "id": "prd_a1b2c3d4e5f6g7h8",
      "name": "Laptop Gamer",
      "description": "Laptop RTX 3080",
      "stock": 10,
      "active": true,
      "stripeProductId": "prod_Vc1S7NBHWqWfBr",
      "stripePriceId": "price_1UanPzBdjYWPYXgRMoPsyH5U",
      "unitAmountCents": 150000,
      "currency": "mxn",
      "imageUrl": "https://ejemplo.com/imagenes/laptop.png"
    }
  ]
  ```

---

#### Crear producto
* **Endpoint:** `POST /api/v1/admin/products`
* **Autenticación:** Pública actualmente (`permitAll`).
* **Request Body (`application/json`):**
  * `name` (`String`): Obligatorio, no puede ser nulo ni estar en blanco.
  * `description` (`String`): Obligatorio, no puede ser nulo ni estar en blanco.
  * `stock` (`Integer`): Cantidad disponible en inventario.
  * `unitAmountCents` (`long`): Precio unitario en centavos MXN.
  * `imageUrl` (`String`, opcional): URL de la imagen. Acepta tanto `"imageUrl"` como `"image_url"`.
  ```json
  {
    "name": "Monitor 4K",
    "description": "Monitor IPS 144Hz 27 pulgadas",
    "stock": 15,
    "unitAmountCents": 850000,
    "imageUrl": "https://ejemplo.com/imagenes/monitor.png"
  }
  ```
* **Respuesta Exitosa (`200 OK` - `application/json`):**
  Devuelve el objeto `Product` creado con su ID `prd_...` y los IDs sincronizados de Stripe (`stripeProductId` y `stripePriceId`):
  ```json
  {
    "id": "prd_9f8e7d6c5b4a3210",
    "name": "Monitor 4K",
    "description": "Monitor IPS 144Hz 27 pulgadas",
    "stock": 15,
    "active": true,
    "stripeProductId": "prod_...",
    "stripePriceId": "price_...",
    "unitAmountCents": 850000,
    "currency": "mxn",
    "imageUrl": "https://ejemplo.com/imagenes/monitor.png"
  }
  ```
* **Posibles Errores:**
  * `422 Unprocessable Content` (`INVALID_ARTICLE_DATA`): Nombre o descripción vacíos/nulos.

---

#### Actualizar precio de producto
* **Endpoint:** `PUT /api/v1/admin/products/{productId}/price`
* **Autenticación:** Pública actualmente (`permitAll`).
* **Path Parameter:** `productId` — ID del producto (`prd_...`).
* **Request Body (`application/json`):**
  ```json
  {
    "newUnitAmountCents": 920000
  }
  ```
* **Qué hace internamente:** Crea un nuevo `Price` en Stripe, lo asigna como `default_price` del producto en Stripe, desactiva el `stripePriceId` anterior y actualiza la base de datos.
* **Respuesta Exitosa (`200 OK` - `application/json`):** Objeto `Product` actualizado con el nuevo `unitAmountCents` y `stripePriceId`.
* **Posibles Errores:**
  * `404 Not Found` (`PRODUCT_NOT_FOUND`): No existe un producto con ese `productId`.

---

### 4.4 Carrito de Compras (`CartController`)

> Todos los endpoints de `/api/v1/cart/**` requieren `Authorization: Bearer <token>`. El usuario se identifica automáticamente a partir del JWT; **no se envía `userId` ni `cartId`**.

#### Obtener carrito activo
* **Endpoint:** `GET /api/v1/cart`
* **Autenticación:** **Requiere JWT**.
* **Comportamiento:** Busca el carrito con estatus `ACTIVE` del usuario en base de datos. Si el usuario no tiene ninguno (por ser nuevo o porque su carrito anterior quedó `LOCKED` tras generar una orden), crea y devuelve automáticamente un nuevo carrito `ACTIVE` vacío.
* **Respuesta Exitosa (`200 OK` - `application/json` - `CartDetail`):**
  ```json
  {
    "cartId": "crt_1a2b3c4d5e6f7g8h",
    "userId": "usr_9i8h7g6f5e4d3c2b",
    "status": "ACTIVE",
    "updatedAt": "2026-11-12T12:15:30.452109",
    "items": [
      {
        "id": "cit_0a1b2c3d4e5f6g7h",
        "productId": "prd_a1b2c3d4e5f6g7h8",
        "productName": "Laptop Gamer",
        "description": "Laptop RTX 3080",
        "imageUrl": "https://ejemplo.com/imagenes/laptop.png",
        "unitAmountCents": 150000,
        "quantity": 2,
        "subtotalCents": 300000,
        "availableStock": 10
      }
    ],
    "totalAmountCents": 300000
  }
  ```

---

#### Agregar ítem al carrito (o sumar cantidad)
* **Endpoint:** `POST /api/v1/cart/items`
* **Autenticación:** **Requiere JWT**.
* **Request Body (`application/json`):**
  * `productId` (`String`): Obligatorio. Acepta tanto `"productId"` como `"product_id"`.
  * `quantity` (`Integer`): Cantidad a añadir. Si es `null` o `<= 0`, se asume `1`.
  * **Nota de comportamiento:** Si el producto ya existe en el carrito `ACTIVE`, **suma** `quantity` a la cantidad actual y valida contra el stock disponible.
  ```json
  {
    "productId": "prd_a1b2c3d4e5f6g7h8",
    "quantity": 2
  }
  ```
* **Respuesta Exitosa (`200 OK` - `application/json`):** Objeto `CartDetail` actualizado (misma estructura que `GET /api/v1/cart`).
* **Posibles Errores:**
  * `404 Not Found` (`PRODUCT_NOT_FOUND` o `USER_NOT_FOUND`): Producto o usuario inexistente.
  * `409 Conflict` (`ARTICLE_CONFLICT`): Producto inactivo (`active = false`) o la cantidad total solicitada supera el `stock` disponible.

---

#### Eliminar un producto/ítem del carrito
* **Endpoint:** `DELETE /api/v1/cart/items/{id}`
* **Autenticación:** **Requiere JWT**.
* **Path Parameter:** `id` — Acepta tanto el **ID del ítem del carrito** (`cit_...`) como el **ID del producto** (`prd_...`).
* **Respuesta Exitosa (`200 OK` - `application/json`):** Objeto `CartDetail` actualizado sin ese ítem.
* **Posibles Errores:**
  * `409 Conflict` (`ARTICLE_CONFLICT`): El usuario no tiene un carrito activo.

---

#### Vaciar carrito activo
* **Endpoint:** `DELETE /api/v1/cart`
* **Autenticación:** **Requiere JWT**.
* **Parámetros / Body:** Ninguno.
* **Respuesta Exitosa (`204 No Content`):** Sin cuerpo en la respuesta. Limpia los ítems del carrito `ACTIVE` manteniendo el carrito activo.

---

### 4.5 Órdenes y Pagos (`OrderController`)

> Todos los endpoints de `/api/v1/order/**` requieren `Authorization: Bearer <token>`.
>
> **Reglas al confirmar la compra:**
> 1. Obtiene el usuario desde el JWT y busca su carrito `ACTIVE`.
> 2. Valida que el carrito no esté vacío y que cada producto esté activo, tenga precio configurado y tenga `stock >= quantity`.
> 3. **Bloquea el carrito cambiando su estatus a `LOCKED`** para evitar que se alteren sus ítems una vez emitida la orden (el próximo artículo que agregue el usuario creará un nuevo carrito `ACTIVE`).
> 4. Calcula el monto total directamente desde la base de datos (nunca confía en precios del frontend) y guarda la orden con ID `ord_...` en estado `PENDING`.
> 5. **El stock aún NO se descuenta** en este paso; se descuenta cuando Stripe confirma el pago vía Webhook.
> 6. **Regla de Expiración (2 días / 48 horas):** Si una orden en estado `PENDING` no se paga dentro de las **48 horas** (`app.order.expiration-hours=48`) posteriores a `createdAt`, tanto el scheduler periódico (`OrderExpirationScheduler`) como cualquier consulta de órdenes cancelan automáticamente el `PaymentIntent` en Stripe, pasan la orden a `CANCELED` registrando `canceledAt`, y marcan el carrito reservado como `CANCELED`.

#### Crear orden con Pago SPEI (Transferencia Bancaria México)
* **Endpoint:** `POST /api/v1/order/spei-payment` *(y `POST /api/v1/order/{orderId}/spei-payment` para órdenes pendientes existentes)*
* **Autenticación:** **Requiere JWT**.
* **Request Body (opcional - `SpeiPaymentRequest`):** `{ "email": "cliente@ejemplo.com" }`. Si se omite o es nulo, utiliza el correo registrado en el perfil del usuario.
* **Uso recomendado:** Genera y confirma en Stripe un `PaymentIntent` de tipo `customer_balance` / `mx_bank_transfer` (`SPEI`), envía las instrucciones y el PDF adjunto al correo especificado (si SMTP está configurado) y devuelve la **CLABE interbancaria**, **banco**, **referencia**, monto exacto, `orderId`, `recipientEmail`, `expiresAt` y `hostedInstructionsUrl`.
* **Respuesta Exitosa (`200 OK` - `application/json` - `StripePaymentResult`):**
  ```json
  {
    "stripeId": "pi_3Qspei1234567890",
    "clientSecret": "pi_3Qspei1234567890_secret_xyz",
    "paymentUrl": "https://payments.stripe.com/bank_transfer/instructions_...",
    "status": "PENDING",
    "speiDetails": {
      "clabe": "646180111812345678",
      "bankName": "STP",
      "bankCode": "646",
      "reference": "9988776655",
      "hostedInstructionsUrl": "https://payments.stripe.com/bank_transfer/instructions_...",
      "amountCents": 150000,
      "currency": "mxn",
      "orderId": "ord_1234567890abcdef",
      "recipientEmail": "cliente@ejemplo.com",
      "expiresAt": "2026-11-15T14:30:00"
    }
  }
  ```

---

#### Descargar Ficha SPEI en PDF
* **Endpoint:** `GET /api/v1/order/{orderId}/spei-pdf`
* **Autenticación:** **Requiere JWT** (valida que la orden pertenezca al usuario y no esté pagada ni cancelada).
* **Respuesta Exitosa (`200 OK` - `application/pdf`):** Devuelve el archivo binario `ficha-spei-{orderId}.pdf` (`Content-Disposition: attachment`) con folio de orden, fecha límite de 48 horas, banco (`STP`), CLABE de 18 dígitos, referencia, monto exacto en MXN, desglose de productos e instrucciones de transferencia.

---

#### Crear orden con Pago Directo (Tarjeta / Stripe Payment Element con Checkout Sessions API)
* **Endpoint:** `POST /api/v1/order/direct-payment` *(y `GET /api/v1/order/{orderId}/payment` para retomar una orden pendiente)*
* **Autenticación:** **Requiere JWT**.
* **Request Body:** Ninguno (vacío).
* **Uso recomendado:** Inicializa una **Checkout Session (`ui_mode: "elements"`)** con `line_items` y `CARD` exclusivo para mantener separada la modalidad de tarjeta respecto a Transferencia SPEI.
* **Respuesta Exitosa (`200 OK` - `application/json` - `StripePaymentResult`):**
  ```json
  {
    "stripeId": "cs_test_1234567890",
    "clientSecret": "cs_test_1234567890_secret_xyz987654",
    "paymentUrl": null,
    "status": "PENDING",
    "orderId": "ord_1234567890abcdef"
  }
  ```
* **Implementación en frontend:** Toma `clientSecret` para inicializar `stripe.initCheckoutElementsSdk({ clientSecret })`, montar `checkout.createPaymentElement()` y confirmar con `actions.confirm()`.

---

#### Crear orden con Link de Pago Hospedado (Stripe Checkout Session)
* **Endpoint:** `POST /api/v1/order/payment-link`
* **Autenticación:** **Requiere JWT**.
* **Request Body:** Ninguno (vacío).
* **Uso recomendado:** Redirigir al usuario a la pasarela hospedada de Stripe sin construir formulario de tarjeta en tu app. También habilita tarjeta y transferencia bancaria MX (SPEI).
* **Respuesta Exitosa (`200 OK` - `application/json` - `StripePaymentResult`):**
  ```json
  {
    "stripeId": "cs_test_a1b2c3d4e5f6...",
    "clientSecret": null,
    "paymentUrl": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6...",
    "status": "PENDING",
    "orderId": "ord_1234567890abcdef"
  }
  ```
* **Implementación en frontend:** Redirige al navegador usando `window.location.href = response.paymentUrl;`.
* *Nota:* En `StripeOrderPaymentService`, las URLs de retorno se configuran mediante `${app.frontend.url}` (`/cart/resultado?session_id={CHECKOUT_SESSION_ID}&order_id={orderId}` y `/orders`).

* **Posibles Errores (ambos endpoints de orden):**
  * `409 Conflict` (`ARTICLE_CONFLICT`): No existe un carrito activo, el carrito está vacío, producto inactivo, stock insuficiente o producto sin precio Stripe.
  * `404 Not Found` (`USER_NOT_FOUND` / `PRODUCT_NOT_FOUND`).

#### Cancelar Orden Manualmente
* **Endpoint:** `POST /api/v1/order/{orderId}/cancel`
* **Autenticación:** Requerida (`USER` o `ADMIN`, dueño de la orden)
* **Descripción:** Cancela manualmente una orden que no haya sido pagada (`PENDING` o `FAILED`). Anula el `PaymentIntent` y/o expira la `Checkout Session` en Stripe, marca la orden como `CANCELED` registrando `canceledAt` y marca su carrito `LOCKED` asociado como `CANCELED`. Si la orden ya está `CANCELED`, devuelve su estado actual de forma idempotente; si ya está `PAID`, devuelve `409 Conflict`.
* **Respuesta (`200 OK`):** Objeto `OrderDetailResponse` actualizado con `status: "CANCELED"` y `canceledAt`.

---

### 4.6 Webhook de Stripe (`StripeWebhookHandler`)

> Uso exclusivo de los servidores de Stripe (o `stripe listen --forward-to localhost:8080/api/webhooks/stripe` en desarrollo local). No debe ser llamado desde el frontend.

* **Endpoint:** `POST /api/webhooks/stripe`
* **Autenticación:** Pública sin JWT, validada criptográficamente con la cabecera `Stripe-Signature` y `stripe.webhook.secret`.
* **Eventos procesados:**
  * `payment_intent.succeeded` y `checkout.session.async_payment_succeeded` (acreditación SPEI):
    1. Valida idempotencia por evento (`processed_webhook_events`) y por estado de dominio (`order.status() == PAID`).
    2. Localiza la orden por `metadata.order_id` o `client_reference_id` (con respaldo por `stripePaymentIntentId`).
    3. Descuenta el `stock` de cada producto de la orden en base de datos y actualiza la orden a `PAID`.
  * `checkout.session.completed`: Si `payment_status == "unpaid"` (ficha SPEI generada sin pago aún), vincula `stripePaymentIntentId` manteniendo `PENDING`; si `payment_status == "paid"`, marca la orden como `PAID`.
  * `payment_intent.payment_failed` y `checkout.session.async_payment_failed`: Actualiza la orden a `FAILED` (si no estaba `PAID` ni `CANCELED`).
  * `payment_intent.canceled` y `checkout.session.expired`: Marca la orden y su carrito asociado como `CANCELED` registrando `canceledAt`.
* **Respuestas (`text/plain`):**
  * `200 OK`: `"Evento recibido"` o `"Evento ya procesado previamente"`.
  * `400 Bad Request`: `"Firma ausente"` o `"Firma inválida"`.

---

## 5. Enums y Modelo de Errores Global

### Enums de Estado
* **Estado de Orden (`Status`):** `PENDING`, `PAID`, `FAILED`, `CANCELED`
* **Estado de Carrito (`CartStatus`):** `ACTIVE`, `LOCKED`

### Estructura de Error (`ApiErrorResponse`)
Todas las excepciones de negocio, validación y credenciales devuelven una estructura JSON consistente:

```json
{
  "code": "ARTICLE_CONFLICT",
  "message": "Stock insuficiente para el producto 'Laptop Gamer'. Solicitado en total: 10, Disponible: 5",
  "status": 409,
  "timestamp": "2026-11-12T12:20:00.123456"
}
```
*(Si falla una validación de parámetros de entrada, se incluye adicionalmente el mapa `"fieldErrors": { "campo": "error" }`)*.

### Tabla de Códigos de Error

| HTTP Status | `code` | Causa |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_REQUEST_PARAMETERS` | Error de validación en parámetros del request (`fieldErrors`). |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Contraseña incorrecta en el login. |
| `403 Forbidden` | *(Spring Security)* | Token JWT ausente, expirado o inválido en un endpoint protegido. |
| `404 Not Found` | `PRODUCT_NOT_FOUND` | El `productId` no existe en base de datos. |
| `404 Not Found` | `USER_NOT_FOUND` | El usuario no existe. |
| `404 Not Found` | `CART_NOT_FOUND` | El carrito solicitado no existe. |
| `409 Conflict` | `ARTICLE_CONFLICT` | Regla de negocio: carrito vacío, sin carrito activo, stock insuficiente o producto inactivo. |
| `422 Unprocessable Content` | `INVALID_ARTICLE_DATA` | Datos inválidos al crear producto (nombre o descripción vacíos). |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Error inesperado del servidor o fallo de conectividad. |

---

## 6. Ejemplo Práctico de Implementación en TypeScript / Angular

```typescript
// 1. Login (nota: el endpoint responde texto plano, NO JSON)
async function login(username: string, password: string): Promise<string> {
  const res = await fetch('http://localhost:8080/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw await res.json();
  const token = await res.text();
  localStorage.setItem('jwt', token);
  return token;
}

// 2. Agregar producto al carrito
async function addToCart(productId: string, quantity: number) {
  const token = localStorage.getItem('jwt');
  const res = await fetch('http://localhost:8080/api/v1/cart/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ productId, quantity })
  });
  if (!res.ok) throw await res.json(); // ApiErrorResponse
  return res.json(); // CartDetail
}

// 3. Confirmar compra con Stripe Checkout Link (sin body)
async function checkoutWithLink() {
  const token = localStorage.getItem('jwt');
  const res = await fetch('http://localhost:8080/api/v1/order/payment-link', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw await res.json(); // ApiErrorResponse
  const result = await res.json(); // StripePaymentResult
  window.location.href = result.paymentUrl;
}
```

