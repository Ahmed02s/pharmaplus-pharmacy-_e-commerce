import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type VerifyRequest = {
  orderId?: string
  reference?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !paystackSecretKey) {
      return json({ error: 'Payment verification is not configured' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const { orderId, reference } = await req.json() as VerifyRequest
    if (!orderId || !reference) {
      return json({ error: 'Missing orderId or reference' }, 400)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'Invalid user session' }, 401)
    }

    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('id, customer_id, total_amount, payment_status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return json({ error: 'Order not found' }, 404)
    }

    if (order.customer_id !== userData.user.id) {
      return json({ error: 'Order does not belong to this user' }, 403)
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    })
    const verified = await verifyResponse.json()

    if (!verifyResponse.ok || verified?.data?.status !== 'success') {
      return json({
        error: verified?.message || 'Payment was not successful',
        status: verified?.data?.status || 'failed',
      }, 402)
    }

    const amountPaid = Number(verified.data.amount)
    const expectedAmount = Math.round(Number(order.total_amount) * 100)
    const currency = verified.data.currency || 'GHS'

    if (currency !== 'GHS') {
      return json({ error: `Unexpected payment currency: ${currency}` }, 400)
    }

    if (amountPaid !== expectedAmount) {
      return json({ error: 'Payment amount does not match this order' }, 400)
    }

    const { data: existingPayment } = await serviceClient
      .from('payments')
      .select('id')
      .eq('provider', 'paystack')
      .eq('provider_ref', reference)
      .maybeSingle()

    if (!existingPayment) {
      const { error: paymentError } = await serviceClient.from('payments').insert({
        order_id: order.id,
        provider: 'paystack',
        provider_ref: reference,
        amount: Number(order.total_amount),
        currency,
        status: 'success',
        metadata: verified.data,
        paid_at: verified.data.paid_at || new Date().toISOString(),
      })

      if (paymentError) throw paymentError
    }

    if (order.payment_status !== 'paid') {
      const { error: updateError } = await serviceClient
        .from('orders')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', order.id)

      if (updateError) throw updateError
    }

    return json({
      ok: true,
      orderId: order.id,
      reference,
      amount: Number(order.total_amount),
    })
  } catch (error) {
    console.error(error)
    return json({ error: error?.message || 'Payment verification failed' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
