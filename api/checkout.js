import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { cart, pickup } = req.body;
    const isPickup = pickup === true;
    const line_items = cart.map(i => ({
      price_data: { currency: 'mxn', product_data: { name: i.name }, unit_amount: Math.round(i.price*100) },
      quantity: i.qty,
    }));
    if (!isPickup) {
      line_items.push({ price_data: { currency: 'mxn', product_data: { name: 'Envío CDMX' }, unit_amount: 9900 }, quantity: 1 });
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: 'https://meatnlove.github.io/gracias.html',
      cancel_url: 'https://meatnlove.github.io',
      metadata: { entrega: isPickup ? 'RECOGER_MORVAN_196B' : 'ENVIO_CDMX' }
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
