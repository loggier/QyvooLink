import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Restablecer Contraseña"
      description="Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
