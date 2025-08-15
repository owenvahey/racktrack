import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables!')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  console.log('🚀 Creating admin user...\n')

  // Get user input
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      readline.question(query, resolve)
    })
  }

  try {
    const email = await question('Email: ')
    const password = await question('Password: ')
    const fullName = await question('Full Name: ')
    const warehouseId = await question('Warehouse ID (optional, press enter to skip): ')

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      console.error('❌ Error creating auth user:', authError.message)
      process.exit(1)
    }

    console.log('✅ Auth user created:', authData.user?.id)

    // Create profile with admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user!.id,
        email,
        full_name: fullName,
        role: 'admin',
        warehouse_id: warehouseId || null,
        is_active: true,
      })

    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message)
      
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user!.id)
      process.exit(1)
    }

    console.log('✅ Admin profile created successfully!')
    console.log('\nYou can now log in with:')
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)

    readline.close()
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    readline.close()
    process.exit(1)
  }
}

// Check if we have any existing warehouses
async function checkWarehouses() {
  const { data: warehouses, error } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('is_active', true)

  if (error) {
    console.error('❌ Error checking warehouses:', error.message)
    return
  }

  if (warehouses && warehouses.length > 0) {
    console.log('\n📍 Available warehouses:')
    warehouses.forEach(w => {
      console.log(`  - ${w.name} (${w.code}): ${w.id}`)
    })
    console.log('\n')
  } else {
    console.log('\n⚠️  No warehouses found. You can add them later in the app.\n')
  }
}

// Main execution
console.log('====================================')
console.log('  RackTrack Admin User Setup')
console.log('====================================\n')

checkWarehouses().then(() => {
  createAdminUser()
})