import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/stripe-service'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Verify Stripe signature
    const event = verifyWebhookSignature(body, signature, process.env.STRIPE_WEBHOOK_SECRET)

    const supabase = createAdminClient()

    // Handle events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription, supabase)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCanceled(subscription, supabase)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice, supabase)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice, supabase)
        break
      }
    }

    // Log webhook event
    const customerId = (event.data.object as any).customer
    if (customerId) {
      const { data: subscription } = await supabase
        .from('betrieb_subscription')
        .select('betrieb_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (subscription) {
        await supabase.from('betrieb_payment_events').insert({
          betrieb_id: subscription.betrieb_id,
          stripe_event_id: event.id,
          stripe_event_type: event.type,
          event_data: event.data.object,
          processed: true,
          processed_at: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 400 }
    )
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabase: any) {
  const customerId = subscription.customer as string
  const status = subscription.status

  // Find betrieb by stripe customer
  const { data: sub } = await supabase
    .from('betrieb_subscription')
    .select('betrieb_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!sub) return

  // Update subscription status
  await supabase
    .from('betrieb_subscription')
    .update({
      stripe_subscription_id: subscription.id,
      status,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId)

  // Activate betrieb if subscription active
  if (status === 'active') {
    await supabase
      .from('betriebe')
      .update({
        is_active: true,
        is_suspended: false,
        suspension_reason: null,
      })
      .eq('id', sub.betrieb_id)
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription, supabase: any) {
  const customerId = subscription.customer as string

  const { data: sub } = await supabase
    .from('betrieb_subscription')
    .select('betrieb_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!sub) return

  // Mark as canceled
  await supabase
    .from('betrieb_subscription')
    .update({
      status: 'canceled',
      subscription_end: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId)

  // Suspend betrieb
  await supabase
    .from('betriebe')
    .update({
      is_active: false,
      is_suspended: true,
      suspension_reason: 'subscription_canceled',
    })
    .eq('id', sub.betrieb_id)
}

async function handleInvoicePaid(invoice: Stripe.Invoice, supabase: any) {
  const customerId = invoice.customer as string

  await supabase
    .from('betrieb_subscription')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId)
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, supabase: any) {
  const customerId = invoice.customer as string

  const { data: sub } = await supabase
    .from('betrieb_subscription')
    .select('betrieb_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!sub) return

  // Mark as past due
  await supabase
    .from('betrieb_subscription')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId)

  // Suspend access after grace period (3 days)
  const gracePeriod = new Date()
  gracePeriod.setDate(gracePeriod.getDate() + 3)

  await supabase
    .from('betriebe')
    .update({
      is_suspended: true,
      suspension_reason: 'payment_failed',
      suspended_at: gracePeriod.toISOString(),
    })
    .eq('id', sub.betrieb_id)
}
