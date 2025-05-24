import { RegisterForm } from '@/components/auth/register-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Crea tu Cuenta en Qyvoo"
      description="Completa los detalles a continuación para comenzar."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
