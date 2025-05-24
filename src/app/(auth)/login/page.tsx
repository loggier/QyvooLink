import { LoginForm } from '@/components/auth/login-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function LoginPage() {
  return (
    <AuthLayout
      title="Iniciar Sesión en Qyvoo"
      description="Ingresa tus credenciales para acceder a tu cuenta."
    >
      <LoginForm />
    </AuthLayout>
  );
}
