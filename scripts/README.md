# RackTrack Setup Scripts

## Creating an Admin User

To create your first admin user, you need to run the setup script. This is necessary because the application requires authentication to access any features.

### Prerequisites

1. Make sure you have your Supabase project set up
2. Ensure your `.env.local` file contains:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

   **Important**: The `SUPABASE_SERVICE_ROLE_KEY` is required for this script to bypass Row Level Security and create users. Never expose this key in client-side code!

### Running the Script

```bash
npm run create-admin
```

or

```bash
npm run setup
```

The script will:
1. Show available warehouses (if any)
2. Prompt you for:
   - Email address
   - Password
   - Full name
   - Warehouse ID (optional)
3. Create the user in Supabase Auth
4. Create a profile with admin role

### After Setup

Once the admin user is created, you can:
1. Log in to the application
2. Create additional users through the Admin panel
3. Set up warehouses and locations
4. Begin using the inventory management features

### Troubleshooting

If you get an error:
- **Missing environment variables**: Check your `.env.local` file
- **Database error**: Ensure your Supabase migrations have run
- **Auth error**: Check your Supabase project settings

### Creating Additional Users

After the first admin is created, you can create additional users through:
- The web interface at `/admin/users`
- Direct Supabase dashboard
- Additional runs of this script