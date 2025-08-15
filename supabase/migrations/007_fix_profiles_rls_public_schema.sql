-- Fix the profiles RLS policies to avoid recursion (using public schema)

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;

-- Create a secure function in the public schema to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Direct query to get the role of the current user
  -- This function runs with SECURITY DEFINER so it bypasses RLS
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Create new policies that avoid recursion

-- 1. Users can ALWAYS view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Users can ALWAYS update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Admins can view all profiles (combined policy)
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id -- Can always see own profile
    OR 
    public.is_admin() -- Admins can see all
  );

-- 4. Admins can create new profiles
CREATE POLICY "Admins can create profiles" ON profiles
  FOR INSERT
  WITH CHECK (public.is_admin());

-- 5. Admins can update any profile
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE
  USING (public.is_admin());