import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function testCredentials() {
  console.log('🧪 Starting Live Credentials & Service Connectivity Test...\n');

  // 1. Test Groq AI Key
  console.log('🤖 [1/4] Testing Groq AI Key...');
  try {
    const groqKey = process.env.GROQ_API_KEY;
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: 'Respond with OK if active.' }],
        max_tokens: 10,
      }),
    });

    if (groqRes.ok) {
      const data = await groqRes.json();
      console.log(`   ✅ Groq AI Connected Successfully! Model: openai/gpt-oss-20b | Response: "${data.choices[0]?.message?.content?.trim()}"`);
    } else {
      const err = await groqRes.text();
      console.log(`   ⚠️ Groq API Error Status ${groqRes.status}: ${err}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Groq API Error: ${error.message}`);
  }

  // 2. Test Supabase Database Connection
  console.log('\n🗄 [2/4] Testing Supabase PostgreSQL Database Connection...');
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.from('projects').select('id').limit(1);

    if (!error) {
      console.log(`   ✅ Supabase PostgreSQL Connected Successfully! (${process.env.SUPABASE_URL})`);
    } else {
      console.log(`   ⚠️ Supabase Query Status: ${error.message}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Supabase Error: ${error.message}`);
  }

  // 3. Test Stripe Test Secret Key
  console.log('\n💳 [3/4] Testing Stripe Test Mode Key...');
  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    });

    if (stripeRes.ok) {
      const data = await stripeRes.json();
      console.log(`   ✅ Stripe Test Key Verified! Live Balance Currency: ${data.available[0]?.currency?.toUpperCase() || 'USD'}`);
    } else {
      const err = await stripeRes.json();
      console.log(`   ⚠️ Stripe Key Error: ${err.error?.message}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Stripe Connection Error: ${error.message}`);
  }

  // 4. Test Stellar Horizon Testnet
  console.log('\n🚀 [4/4] Testing Stellar Horizon Public Testnet...');
  try {
    const stellarRes = await fetch(`${process.env.STELLAR_HORIZON_TESTNET_URL}/fee_stats`);
    if (stellarRes.ok) {
      const data = await stellarRes.json();
      console.log(`   ✅ Stellar Horizon Testnet Connected! Last Ledger: ${data.last_ledger}`);
    } else {
      console.log(`   ⚠️ Stellar Horizon Response Status: ${stellarRes.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Stellar Horizon Error: ${error.message}`);
  }

  console.log('\n✨ Credential Connectivity Testing Complete!');
}

testCredentials().catch(console.error);
