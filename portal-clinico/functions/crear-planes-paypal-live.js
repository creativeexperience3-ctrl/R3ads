/* ============================================================
   R3ads Portal Clínico — Crear Producto + Planes de PayPal LIVE (uso local, una vez)

   Recrea en PayPal LIVE el mismo Producto + 2 Billing Plans que ya existen
   en Sandbox (Básico $40/mes, Completo $65/mes, ambos con 7 días de prueba
   gratis) — ver el comentario sobre PAYPAL_PLAN_IDS en index.js. Los planes
   de Sandbox NO se pueden "promover" a Live, hay que crearlos de cero ahí.

   Uso:
     1. Crea una app REST API dedicada para Ancla en
        developer.paypal.com → Apps & Credentials → pestaña LIVE (no
        reutilices MyApp_Wixcom_Ltd ni MyApp_Payhip_Limited, son de otros
        negocios). Copia su Client ID y Secret.
     2. En tu terminal (nunca lo pegues en el chat), exporta esas dos
        variables SOLO para esta sesión de shell:
          PowerShell:  $env:PAYPAL_LIVE_CLIENT_ID = "..."
                       $env:PAYPAL_LIVE_CLIENT_SECRET = "..."
          bash:        export PAYPAL_LIVE_CLIENT_ID="..."
                       export PAYPAL_LIVE_CLIENT_SECRET="..."
     3. node crear-planes-paypal-live.js
     4. El script imprime los 2 Plan ID nuevos al final — esos SÍ son
        seguros de compartir (son identificadores públicos del catálogo de
        PayPal, no credenciales), pégamelos para actualizar PAYPAL_PLAN_IDS
        en index.js.
   ============================================================ */
const PAYPAL_API_BASE = 'https://api-m.paypal.com';

const CLIENT_ID = process.env.PAYPAL_LIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_LIVE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan PAYPAL_LIVE_CLIENT_ID / PAYPAL_LIVE_CLIENT_SECRET en el entorno.');
  console.error('Expórtalas en tu terminal antes de correr este script (ver instrucciones arriba en el archivo).');
  process.exit(1);
}

async function paypalToken() {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo autenticar con PayPal LIVE: ' + JSON.stringify(data));
  return data.access_token;
}

async function crearProducto(token) {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ancla — Software de gestión clínica',
      description: 'Suscripción mensual al portal clínico Ancla (R3ads).',
      type: 'SERVICE',
      category: 'SOFTWARE'
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Error creando producto: ' + JSON.stringify(data));
  return data.id;
}

async function crearPlan(token, productId, nombre, precioMensual) {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: productId,
      name: `Ancla — ${nombre} (Precio Fundador)`,
      description: `Plan ${nombre} de Ancla — $${precioMensual}/mes, 7 días de prueba gratis.`,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: 'DAY', interval_count: 7 },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: { fixed_price: { value: '0', currency_code: 'USD' } }
        },
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // 0 = indefinido
          pricing_scheme: { fixed_price: { value: String(precioMensual), currency_code: 'USD' } }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: '0', currency_code: 'USD' },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Error creando plan ${nombre}: ` + JSON.stringify(data));
  return data.id;
}

async function main() {
  console.log('Autenticando con PayPal LIVE...');
  const token = await paypalToken();

  console.log('Creando producto...');
  const productId = await crearProducto(token);
  console.log('Producto creado:', productId);

  console.log('Creando plan Básico ($40/mes)...');
  const idBasico = await crearPlan(token, productId, 'Básico', 40);
  console.log('Plan Básico:', idBasico);

  console.log('Creando plan Completo ($65/mes)...');
  const idCompleto = await crearPlan(token, productId, 'Completo', 65);
  console.log('Plan Completo:', idCompleto);

  console.log('\n✅ Listo. Pega esto en el chat para que actualice PAYPAL_PLAN_IDS en index.js:');
  console.log('  basico:   ' + idBasico);
  console.log('  completo: ' + idCompleto);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
