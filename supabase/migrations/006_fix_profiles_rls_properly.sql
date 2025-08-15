-- Fix the profiles RLS policies to avoid recursion

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;

-- Create new policies that avoid recursion

-- 1. Users can ALWAYS view their own profile (no admin check needed here)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Users can ALWAYS update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. For admin operations, we need a different approach
-- We'll create a secure function that checks admin status without recursion
CREATE OR REPLACE FUNCTION auth.check_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Direct query with explicit row-level security disabled for this check
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth.check_is_admin() TO authenticated;

-- 4. Admins can view all profiles (using the function)
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id -- Can always see own profile
    OR 
    auth.check_is_admin() -- Admins can see all
  );

-- 5. Admins can create new profiles
CREATE POLICY "Admins can create profiles" ON profiles
  FOR INSERT
  WITH CHECK (auth.check_is_admin());

-- 6. Admins can update any profile
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (auth.check_is_admin())
  WITH CHECK (auth.check_is_admin());

-- 7. Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE
  USING (auth.check_is_admin());