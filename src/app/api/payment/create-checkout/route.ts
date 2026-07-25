import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createStripeCustomer, createCheckoutSession, PRICING } from '@/lib/stripe-service'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { betriebId } = await req.json()
    if (!betriebId) return NextResponse.json({ error: 'betriebId required' }, { status: 400 })

    // Verify user owns this betrieb
    const { data: betriebUser } = await supabase
      .from('betrieb_users')
      .select('betrieb_id')
      .eq('betrieb_id', betriebId)
      .eq('profile_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!betriebUser) {
      return NextResponse.json({ error: 'Not authorized for this betrieb' }, { status: 403 })
    }

    // Check if already has subscription
    const { data: existing } = await supabase
      .from('betrieb_subscription')
      .select('id, stripe_customer_id')
      .eq('betrieb_id', betriebId)
      .single()

    let customerId = existing?.stripe_customer_id

    // Get betrieb info
    const { data: betrieb } = await supabase
      .from('betriebe')
      .select('name')
      .eq('id', betriebId)
      .single()

    if (!betrieb) return NextResponse.json({ error: 'Betrieb not found' }, { status: 404 })

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await createStripeCustomer(betrieb.name, user.email || '')
      customerId = customer.id

      // Save to DB
      await supabase.from('betrieb_subscription').insert({
        betrieb_id: betriebId,
        stripe_customer_id: customerId,
      })
    }

    // Create checkout session
    const session = await createCheckoutSession(
      customerId,
      PRICING.MONTHLY_PRICE_ID,
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?betrieb=${betriebId}`,
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`
    )

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    )
  }
}
