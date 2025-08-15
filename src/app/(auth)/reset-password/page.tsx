import { PasswordResetForm } from '@/components/auth/password-reset-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordResetForm />
        <div className="mt-4 text-center text-sm">
          Remember your password?{' '}
          <Link
            href="/login"
            className="text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}