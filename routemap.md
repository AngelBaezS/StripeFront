### 📚 Mapa de Dominio Técnico: Pasarelas, SPEI y Facturación

#### **1\. Ecosistema de Pasarelas de Pago y Comercio Electrónico**

* **Diferenciación de roles:** Entender la diferencia funcional entre una **Pasarela de Pago** (captura y transmite datos de forma segura), un **Procesador de Pagos** (ejecuta la transacción con las redes bancarias) y una **Terminal Punto de Venta / TPV** (orientada a entornos físicos presenciales)[1][2].
* **Variedad de métodos de pago:** Dominar la integración de cobros con tarjetas de crédito/débito, financiamiento a **Meses Sin Intereses (MSI)**, pagos en efectivo (como OXXO Pay) y esquemas **BNPL** (*Buy Now, Pay Later* como Kueski Pay o Aplazo)[3].
* **Optimización de conversión:** Implementar flujos de **checkout transparente y acelerado** para procesar pagos dentro del sitio sin redirigir al cliente, reduciendo la fricción y la tasa de abandono de carrito[4][8].
* **Panorama de soluciones en México:** Conocer las características clave y modelos de comisiones de proveedores como Pago Nube, Conekta, Openpay, Stripe y Mercado Pago[5].

#### **2\. Arquitectura de Webhooks y Procesamiento en Tiempo Real**

* **Funcionamiento asíncrono:** Configurar servidores receptores (*endpoints*) bajo protocolo **HTTPS/TLS 1.2+** con certificados SSL válidos y puertos autorizados[12][13].
* **Verificación de endpoints:** Programar el manejo del evento tipo `verification` guardando el código recibido y retornando un estado **HTTP 200 OK** para activar la notificación[14].
* **Garantía de idempotencia:** Diseñar la lógica del backend para evitar procesar transacciones duplicadas cuando la pasarela reintente envíos de eventos como `charge.succeeded` o `spei.received`[12].
* **Tolerancia a cambios:** Asegurar que la aplicación acepte campos adicionales u objetos JSON con eventos desconocidos o futuros sin fallar ni romper la ejecución[12].

#### **3\. Integración de SPEI y Conciliación Bancaria Automática**

* **Asignación de CLABEs únicas:** Generar cuentas CLABE virtuales o referencias dinámicas por pedido (pagos únicos) o por cliente (suscripciones/pagos recurrentes) para identificar el origen exacto del depósito sin solicitar comprobantes manuales[20].
* **Conexión bancaria y Open Banking:** Entender cómo los sistemas se conectan vía API o H2H con los bancos para detectar abonos en tiempo real[20][24].
* **Conciliación automática con IA:** Implementar algoritmos de *matching* o cruce inteligente entre los depósitos recibidos por SPEI y las facturas o pedidos pendientes en el ERP[24][25].
* **Portales de autofactura y excepciones:** Manejar escenarios de depósitos sin referencia previa, pagos fuera de horario bancario o pagos parciales/agrupados[26].

#### **4\. Facturación Electrónica SAT (CFDI 4.0 y Complemento de Pagos 2.0)**

* **Reglas de métodos de pago SAT:** Manejar la distinción operativa entre pagos al contado (**PUE** \- Pago en Una sola Exhibición) y ventas a crédito/diferidas (**PPD** \- Pago en Parcialidades o Diferido)[25][29].
* **Estructura del CFDI 4.0 de Pago (Comprobante Tipo P):** Configurar los atributos requeridos como `SubTotal="0"`, `Total="0"`, `Moneda="XXX"`, `Exportacion="01"`, `UsoCFDI="CP01"` y el concepto único con clave `84111506`[30][31].
* **Nodo** **pago20:Pagos** **(Versión 2.0):** Registrar la fecha del cobro (`FechaPago`), la forma de pago (`FormaDePagoP="03"` para transferencia), el monto e incorporar la clave de rastreo de SPEI en `NumOperacion`[32].
* **Nodo** **pago20:DoctoRelacionado** **:** Relacionar el pago con la factura PPD inicial mediante su Folio Fiscal UUID (`IdDocumento`), especificando el número de parcialidad, saldo anterior (`ImpSaldoAnt`), monto pagado (`ImpPagado`) y saldo insoluto restante (`ImpSaldoInsoluto`)[35].

#### **5\. Seguridad y Estándar PCI DSS v4.0**

* **Definición del CDE (Cardholder Data Environment):** Identificar qué componentes del software almacenan, procesan o transmiten datos de cuenta o afectan el entorno de seguridad[39].
* **Clasificación de datos:** Distinguir entre Datos del Titular de Tarjeta (CHD como el PAN) y Datos de Autenticación Sensible (SAD como el CVV/CVC), garantizando la no retención de SAD tras la autorización[42].
* **Cifrado y Tokenización:** Implementar tokenización de tarjetas para operar sin almacenar números de tarjeta en la base de datos propia[42][43].
* **Protección contra Skimming en Páginas de Pago:** Aplicar Políticas de Seguridad de Contenido (**CSP**) con directivas como `report-to` o `report-uri` para detectar y mitigar alteraciones o *scripts* de JavaScript maliciosos inyectados en la página de pago[44].

#### **6\. Desarrollo Full-Stack y Pruebas en Sandbox**

* **Construcción de Backend (Spring Boot / Python):** Crear controladores REST para inicializar transacciones (`PaymentIntent`), procesar webhooks y conectar la lógica de negocio.
* **Construcción de Frontend (Angular / React):** Montar elementos de interfaz seguros (`Stripe Payment Element` / SDKs de pasarelas) para capturar datos con validación en cliente.
* **Pruebas integrales:** Ejecutar simulaciones en entornos Sandbox usando credenciales de test, herramientas como Ngrok para interceptar webhooks locales y verificar la trazabilidad completa desde la compra hasta la emisión del XML fiscal.