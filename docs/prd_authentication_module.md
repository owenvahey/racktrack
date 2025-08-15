# PRD 001: Authentication & User Management Module

## Overview
Implement a complete authentication system with role-based access control for the WMS application using Supabase Auth and Next.js.

## Technical Requirements

### Tech Stack
- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth + Database)
- **UI Components**: Shadcn/ui
- **State Management**: Zustand
- **Deployment**: Vercel

### Database Schema

#### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'worker', 'viewer')) DEFAULT 'worker',
  warehouse_id UUID REFERENCES warehouses(id),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Warehouses Table
```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample data
INSERT INTO warehouses (name, code, address, city, state, zip_code) VALUES
('Main Warehouse', 'WH001', '123 Industrial Blvd', 'Atlanta', 'GA', '30309'),
('Secondary Warehouse', 'WH002', '456 Commerce Dr', 'Atlanta', 'GA', '30310');
```

## User Stories

### Authentication
- **As a user**, I want to log in with email/password so I can access the WMS
- **As a user**, I want to reset my password if I forget it
- **As a user**, I want to stay logged in between sessions for convenience
- **As a user**, I want to log out securely when I'm done

### Profile Management
- **As a user**, I want to view and edit my profile information
- **As a user**, I want to upload a profile picture
- **As a manager**, I want to view all users in my warehouse
- **As an admin**, I want to create and manage user accounts

### Role-Based Access
- **As an admin**, I want to assign roles to users to control access levels
- **As a system**, I want to restrict data access based on user roles and warehouse assignment

## Functional Requirements

### 1. Authentication Pages

#### Login Page (`/login`)
- Email/password form with validation
- "Remember me" checkbox
- "Forgot password" link
- Error handling and loading states
- Redirect to dashboard after successful login
- Responsive design for mobile devices

#### Signup Page (`/signup`) - Admin Only
- Email, password, confirm password fields
- Full name and phone number
- Warehouse selection dropdown
- Role selection (admin only)
- Form validation with real-time feedback
- Email verification requirement

#### Password Reset (`/reset-password`)
- Email input form
- Success/error messaging
- Link to return to login
- Password update form (when accessed via email link)

### 2. Profile Management

#### Profile Page (`/profile`)
- View/edit personal information
- Upload profile picture to Supabase Storage
- Change password functionality
- Activity log (last login, recent actions)
- Warehouse information display

#### User Management (`/admin/users`) - Admin Only
- User list with search and filtering
- Create new user functionality
- Edit user roles and warehouse assignments
- Deactivate/activate users
- Bulk operations

### 3. Protected Route System

#### Route Protection
- Middleware to check authentication status
- Role-based route protection
- Automatic redirect to login for unauthenticated users
- Permission-based component rendering

#### Navigation
- Responsive sidebar with role-based menu items
- User avatar and profile dropdown
- Breadcrumb navigation
- Mobile-friendly hamburger menu

## Technical Implementation Details

### File Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── reset-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── admin/
│   │   │   └── users/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   ├── middleware.ts
│   └── layout.tsx
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── PasswordResetForm.tsx
│   ├── navigation/
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   └── UserMenu.tsx
│   └── ui/ (shadcn components)
├── hooks/
│   ├── useAuth.ts
│   ├── useProfile.ts
│   └── useUsers.ts
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   └── utils.ts
├── stores/
│   └── authStore.ts
└── types/
    ├── auth.ts
    └── database.types.ts
```

### Authentication Hook
```typescript
// hooks/useAuth.ts
export interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'manager' | 'worker' | 'viewer'
  warehouse_id?: string
  avatar_url?: string
}

export function useAuth() {
  // Returns: { user, loading, signIn, signOut, signUp, resetPassword }
}
```

### Route Protection Middleware
```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  // Check authentication and role-based access
  // Redirect logic for protected routes
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
}
```

### Zustand Auth Store
```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}
```

## UI/UX Requirements

### Design System
- Use Shadcn/ui components for consistency
- Tailwind CSS for styling
- Responsive design (mobile-first)
- Dark/light mode support
- Loading states and error handling
- Toast notifications for feedback

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- High contrast mode support

### Mobile Considerations
- Touch-friendly interface
- Optimized for warehouse tablets
- Offline capability (basic caching)
- PWA-ready authentication flow

## Security Requirements

### Authentication Security
- Password strength requirements (min 8 chars, mixed case, numbers)
- Rate limiting on login attempts
- Secure session management
- CSRF protection
- Email verification required

### Data Protection
- Row Level Security (RLS) enforced
- Role-based data access
- Audit logging for admin actions
- Secure password reset flow
- Profile picture upload validation

## Environment Variables
```bash
# Required for authentication module
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Testing Requirements

### Unit Tests
- Authentication functions
- Form validation logic
- Role checking utilities
- Profile update operations

### Integration Tests
- Login/logout flow
- Password reset process
- Profile management
- Role-based access control

### E2E Tests
- Complete authentication flow
- User management workflow
- Mobile responsive behavior
- Cross-browser compatibility

## Success Criteria

### Performance
- Login response time < 2 seconds
- Page load time < 3 seconds
- Mobile-optimized interface
- 99.9% authentication availability

### Functionality
- ✅ Users can log in/out successfully
- ✅ Role-based access control works
- ✅ Profile management is functional
- ✅ Password reset flow works
- ✅ Mobile interface is usable
- ✅ Admin can manage all users

### Security
- ✅ All routes properly protected
- ✅ RLS policies enforced
- ✅ No unauthorized data access
- ✅ Secure session management
- ✅ Password requirements enforced

## Dependencies
```json
{
  "dependencies": {
    "@supabase/auth-helpers-nextjs": "^0.8.0",
    "@supabase/supabase-js": "^2.38.0",
    "zustand": "^4.4.0",
    "@hookform/resolvers": "^3.3.0",
    "react-hook-form": "^7.47.0",
    "zod": "^3.22.0",
    "@radix-ui/react-avatar": "^1.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "lucide-react": "^0.292.0"
  }
}
```

## Deliverables

1. **Complete authentication system** with login/signup/reset
2. **Role-based access control** with middleware protection
3. **Profile management** with image upload
4. **User management interface** for admins
5. **Responsive navigation** with role-based menus
6. **Security implementation** with RLS and validation
7. **Mobile-optimized interface** ready for warehouse use
8. **Documentation** for setup and configuration