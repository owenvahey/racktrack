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
  process.exit(1)
}

// Create Supabase client with service role key
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

async function fixUserProfile() {
  console.log('🔧 Fixing user profile...\n')

  try {
    const email = await question('Email of the user to fix: ')
    
    // Get the user from auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      process.exit(1)
    }

    const user = users.find(u => u.email === email)
    
    if (!user) {
      console.error('❌ User not found in auth system')
      process.exit(1)
    }

    console.log('✅ Found user:', user.id)

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      console.log('✅ Profile already exists:')
      console.log('  - Role:', existingProfile.role)
      console.log('  - Name:', existingProfile.full_name)
      console.log('  - Active:', existingProfile.is_active)
      
      const updateRole = await question('\nUpdate to admin role? (y/n): ')
      
      if (updateRole.toLowerCase() === 'y') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id)
          
        if (updateError) {
          console.error('❌ Error updating profile:', updateError.message)
        } else {
          console.log('✅ Profile updated to admin role')
        }
      }
    } else {
      console.log('⚠️  No profile found, creating one...')
      
      const fullName = await question('Full Name: ')
      const warehouseId = await question('Warehouse ID (optional, press enter to skip): ')
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          role: 'admin',
          warehouse_id: warehouseId || null,
          is_active: true,
        })

      if (profileError) {
        console.error('❌ Error creating profile:', profileError.message)
      } else {
        console.log('✅ Admin profile created successfully!')
      }
    }

    console.log('\n✅ Done! You can now log in with your existing password.')
    
    rl.close()
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    rl.close()
    process.exit(1)
  }
}

// Main execution
console.log('====================================')
console.log('  RackTrack User Profile Fix')
console.log('====================================\n')

fixUserProfile()