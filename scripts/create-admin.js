const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')
const readline = require('readline')

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables!')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  console.error('\nYour .env.local should include:')
  console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key')
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function createAdminUser() {
  console.log('🚀 Creating admin user...\n')

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
        id: authData.user.id,
        email,
        full_name: fullName,
        role: 'admin',
        warehouse_id: warehouseId || null,
        is_active: true,
      })

    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message)
      
      // Check if it's a duplicate key error
      if (profileError.message.includes('duplicate key')) {
        console.log('\n⚠️  A profile with this ID already exists.')
        console.log('This might be an orphaned profile from a deleted user.')
        console.log('\nTrying to update the existing profile...')
        
        // Try to update the existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email,
            full_name: fullName,
            role: 'admin',
            warehouse_id: warehouseId || null,
            is_active: true,
          })
          .eq('id', authData.user.id)
          
        if (updateError) {
          console.error('❌ Error updating profile:', updateError.message)
          // Clean up auth user if we can't fix the profile
          await supabase.auth.admin.deleteUser(authData.user.id)
          process.exit(1)
        } else {
          console.log('✅ Existing profile updated successfully!')
          console.log('\nYou can now log in with:')
          console.log(`Email: ${email}`)
          console.log(`Password: ${password}`)
          readline.close()
          return
        }
      } else {
        // Clean up auth user if profile creation fails for other reasons
        await supabase.auth.admin.deleteUser(authData.user.id)
        process.exit(1)
      }
    }

    console.log('✅ Admin profile created successfully!')
    console.log('\nYou can now log in with:')
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)

    rl.close()
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    rl.close()
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