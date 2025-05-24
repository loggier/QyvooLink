import { LoginForm } from '@/components/auth/login-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function LoginPage() {
  return (
    <AuthLayout
      title="Sign In to EvolveLink"
      description="Enter your credentials to access your account."
    >
      <LoginForm />
    </AuthLayout>
  );
}
