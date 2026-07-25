import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export const PRICING = {
  MONTHLY_PRICE_ID: process.env.STRIPE_PRICE_ID_MONTHLY || '',
  MONTHLY_PRICE_CENTS: 19900, // €199.00
  SETUP_FEE_CENTS: 200000, // €2000.00
  CURRENCY: 'eur',
}

// ============================================================================
// Customer Management
// ============================================================================

export async function createStripeCustomer(betriebName: string, email: string) {
  return await stripe.customers.create({
    name: betriebName,
    email,
    description: `Betrieb: ${betriebName}`,
    metadata: {
      app: 'werkstatt-saas',
    },
  })
}

export async function getStripeCustomer(customerId: string) {
  return await stripe.customers.retrieve(customerId)
}

// ============================================================================
// Subscription Management
// ============================================================================

export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
) {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata,
  })
}

export async function updateSubscription(
  subscriptionId: string,
  params: Stripe.SubscriptionUpdateParams
) {
  return await stripe.subscriptions.update(subscriptionId, params)
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.del(subscriptionId)
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId)
}

// ============================================================================
// Checkout Session (für Payment-UI)
// ============================================================================

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  })
}

export async function getCheckoutSession(sessionId: string) {
  return await stripe.checkout.sessions.retrieve(sessionId)
}

// ============================================================================
// Webhook Verification
// ============================================================================

export function verifyWebhookSignature(
  body: string,
  signature: string | string[] | undefined,
  secret: string
) {
  try {
    return stripe.webhooks.constructEvent(body, signature || '', secret)
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error}`)
  }
}

// ============================================================================
// Invoice Management
// ============================================================================

export async function getInvoices(customerId: string, limit = 10) {
  return await stripe.invoices.list({
    customer: customerId,
    limit,
  })
}

export async function getInvoice(invoiceId: string) {
  return await stripe.invoices.retrieve(invoiceId)
}

// ============================================================================
// Payment Intent
// ============================================================================

export async function createPaymentIntent(
  customerId: string,
  amountCents: number,
  description: string,
  metadata?: Record<string, string>
) {
  return await stripe.paymentIntents.create({
    customer: customerId,
    amount: amountCents,
    currency: PRICING.CURRENCY,
    description,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  })
}
