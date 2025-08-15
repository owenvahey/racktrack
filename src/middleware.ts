import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Get the pathname
  const pathname = request.nextUrl.pathname
  
  // Define public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/reset-password', '/auth/callback']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Define auth routes that authenticated users shouldn't access
  const authRoutes = ['/login', '/reset-password']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  
  // Check for auth cookies (Supabase uses sb-access-token and sb-refresh-token)
  const hasAuthCookie = request.cookies.has('sb-access-token') || 
                       request.cookies.has('sb-refresh-token')
  
  // Redirect authenticated users away from auth pages
  if (hasAuthCookie && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Allow access to public routes
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // Redirect unauthenticated users to login
  if (!hasAuthCookie) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public assets)
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\..*$).*)',
  ],
}