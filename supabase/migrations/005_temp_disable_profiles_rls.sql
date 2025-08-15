-- Temporarily disable RLS on profiles table to fix recursion issue
-- This should be replaced with proper policies later

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Note: This makes all profiles accessible to all authenticated users
-- Only use this as a temporary fix!