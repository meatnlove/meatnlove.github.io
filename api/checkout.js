import Stripe from 'stripe';
const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || process.env.STRIPE_KEY;
const stripe = new Stripe(stripeKey);

const UMBRAL_GRATIS = 1500;
const ENVIO_CENTAVOS = 9900;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { cart, deliveryOption, customer, address, total, subtotal, whatsappMessage } = req.body;
    
    if (!cart || !cart.length) return res.status(400).json({ error: 'Carrito vacío' });

    const origin = 'https://meat-love.vercel.app';
    const cleanName = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 \-.,()]/g,'').substring(0,60).trim() || 'Producto';

    // Calcula subtotal real por si no viene
    const subtotalReal = subtotal || cart.reduce((a,b) => a + (b.price * b.qty), 0);
    
    // Lógica de envío gratis
    let envioCentavos = 0;
    let envioLabel = 'Recoger GRATIS';
    
    if (deliveryOption === 'pickup') {
      envioCentavos = 0;
      envioLabel = 'Recoger GRATIS - Morvan 196 B';
    } else {
      if (subtotalReal >= UMBRAL_GRATIS) {
        envioCentavos = 0;
        envioLabel = `Envío GRATIS (pedido $${subtotalReal} >= $${UMBRAL_GRATIS})`;
      } else {
        envioCentavos = ENVIO_CENTAVOS;
        envioLabel = 'Envío CDMX $99';
      }
    }

    const line_items = cart.map(i => ({
      price_data: {
        currency: 'mxn',
        product_data: { name: cleanName(i.name) },
        unit_amount: Math.round(i.price * 100)
      },
      quantity: i.qty
    }));

    // Solo agrega envío si no es gratis y no es pickup
    if (envioCentavos > 0) {
      line_items.push({
        price_data: {
          currency: 'mxn',
          product_data: { name: 'Envío CDMX' },
          unit_amount: envioCentavos
        },
        quantity: 1
      });
    }

    // Guarda TODO en metadata de Stripe para que lo veas en el dashboard
    const customerInfo = customer ? `
Nombre: ${customer.nombre || ''}
Tel: ${customer.telefono || ''}
Dirección: ${address || ''}
Calle: ${customer.calle || ''}
Colonia: ${customer.colonia || ''}
Alcaldía: ${customer.alcaldia || ''}
CP: ${customer.cp || ''}
Ref: ${customer.ref || ''}
    `.trim().substring(0, 450) : '';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      // Guarda info del cliente
      customer_email: customer?.email || undefined,
      metadata: {
        deliveryOption: deliveryOption || 'envio',
        envioLabel,
        subtotal: String(subtotalReal),
        envio: String(envioCentavos/100),
        total: String(total || subtotalReal + envioCentavos/100),
        customer_nombre: (customer?.nombre || '').substring(0,100),
        customer_telefono: (customer?.telefono || '').substring(0,50),
        customer_address: (address || '').substring(0,400),
        customer_colonia: (customer?.colonia || '').substring(0,100),
        customer_ref: (customer?.ref || '').substring(0,200),
        whatsappMessage: (whatsappMessage || '').substring(0,450)
      },
      // Esto hace que en Stripe veas la dirección completa en la descripción
      payment_intent_data: {
        description: `${envioLabel} | ${customerInfo}`.substring(0,1000)
      },
      succes_url: `${origin}/succes.html?delivery=${deliveryOption}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
