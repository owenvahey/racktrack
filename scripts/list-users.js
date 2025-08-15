const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

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

async function listAllUsers() {
  console.log('📋 Listing all users and profiles...\n')

  try {
    // Get all auth users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError.message)
      return
    }

    console.log(`Found ${users.length} users in auth system:\n`)
    
    users.forEach(user => {
      console.log(`  📧 ${user.email} (${user.id})`)
      console.log(`     Created: ${new Date(user.created_at).toLocaleDateString()}`)
      console.log(`     Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`)
      console.log('')
    })

    // Get all profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profileError) {
      console.error('❌ Error listing profiles:', profileError.message)
      return
    }

    console.log(`\nFound ${profiles.length} profiles in database:\n`)

    profiles.forEach(profile => {
      const hasAuthUser = users.some(u => u.id === profile.id)
      console.log(`  👤 ${profile.full_name} (${profile.email})`)
      console.log(`     ID: ${profile.id}`)
      console.log(`     Role: ${profile.role}`)
      console.log(`     Active: ${profile.is_active ? 'Yes' : 'No'}`)
      console.log(`     Has Auth User: ${hasAuthUser ? '✅' : '❌ ORPHANED'}`)
      console.log('')
    })

    // Check for orphaned profiles
    const orphanedProfiles = profiles.filter(p => !users.some(u => u.id === p.id))
    
    if (orphanedProfiles.length > 0) {
      console.log('\n⚠️  Found orphaned profiles (profiles without auth users):')
      orphanedProfiles.forEach(profile => {
        console.log(`  - ${profile.email} (${profile.id})`)
      })
      console.log('\nThese profiles cannot log in and should be cleaned up.')
    }

    // Check for users without profiles
    const usersWithoutProfiles = users.filter(u => !profiles.some(p => p.id === u.id))
    
    if (usersWithoutProfiles.length > 0) {
      console.log('\n⚠️  Found users without profiles:')
      usersWithoutProfiles.forEach(user => {
        console.log(`  - ${user.email} (${user.id})`)
      })
      console.log('\nThese users cannot access the app until profiles are created.')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Main execution
console.log('====================================')
console.log('  RackTrack User & Profile List')
console.log('====================================\n')

listAllUsers()