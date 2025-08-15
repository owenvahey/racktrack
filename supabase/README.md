# Supabase Setup Guide

## Initial Setup

1. **Create a Supabase Project**
   - Go to [https://supabase.com](https://supabase.com)
   - Create a new project
   - Save your project URL and anon key

2. **Configure Environment Variables**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Supabase credentials:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     ```

3. **Run Database Migrations**
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Run the migrations in order:
     - `001_initial_schema.sql` - Creates initial tables and RLS policies

## Database Structure

### Tables
- `warehouses` - Warehouse locations
- `profiles` - User profiles with roles

### Row Level Security (RLS)
- Users can view and edit their own profiles
- Admins can manage all profiles and warehouses
- All authenticated users can view active warehouses

## Authentication
The project uses Supabase Auth with email/password authentication. A trigger automatically creates a profile when a new user signs up.

## Roles
- `admin` - Full system access
- `manager` - Warehouse management access
- `worker` - Operational access
- `viewer` - Read-only access