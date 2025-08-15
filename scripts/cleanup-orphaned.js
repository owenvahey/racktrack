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

async function cleanupOrphaned() {
  console.log('🧹 Cleaning up orphaned profiles...\n')

  try {
    // Get all auth users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError.message)
      return
    }

    // Get all profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')

    if (profileError) {
      console.error('❌ Error listing profiles:', profileError.message)
      return
    }

    // Find orphaned profiles
    const authUserIds = users.map(u => u.id)
    const orphanedProfiles = profiles.filter(p => !authUserIds.includes(p.id))

    if (orphanedProfiles.length === 0) {
      console.log('✅ No orphaned profiles found!')
      rl.close()
      return
    }

    console.log(`Found ${orphanedProfiles.length} orphaned profiles:\n`)
    orphanedProfiles.forEach(profile => {
      console.log(`  - ${profile.email} (${profile.id})`)
      console.log(`    Name: ${profile.full_name}`)
      console.log(`    Role: ${profile.role}`)
      console.log('')
    })

    const confirm = await question('Delete these orphaned profiles? (y/n): ')

    if (confirm.toLowerCase() === 'y') {
      for (const profile of orphanedProfiles) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', profile.id)

        if (error) {
          console.error(`❌ Error deleting profile ${profile.email}:`, error.message)
        } else {
          console.log(`✅ Deleted orphaned profile: ${profile.email}`)
        }
      }
    } else {
      console.log('❌ Cleanup cancelled')
    }

    rl.close()
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    rl.close()
  }
}

// Main execution
console.log('====================================')
console.log('  RackTrack Orphaned Profile Cleanup')
console.log('====================================\n')

cleanupOrphaned()