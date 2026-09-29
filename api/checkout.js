import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const { cart, deliveryOption } = req.body || {};
    if (!cart || !cart.length) return res.status(400).json({error:'Cart empty'});
    const isPickup = deliveryOption === 'pickup';
    const line_items = cart.map(item => ({
      price_data: {
        currency: 'mxn',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.qty || 1,
    }));
    if (!isPickup) {
      line_items.push({
        price_data: { currency: 'mxn', product_data: { name: 'Envío CDMX' }, unit_amount: 9900 },
        quantity: 1
      });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${req.headers.origin}/?success=true`,
      cancel_url: `${req.headers.origin}/?canceled=true`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
