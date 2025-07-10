import { RegisterForm } from '@/components/auth/register-form';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Suspense } from 'react';

function RegisterContent() {
  return (
    <AuthLayout
      title="Crea tu Cuenta en Qyvoo"
      description="Completa los detalles a continuación para comenzar."
    >
      <RegisterForm />
    </AuthLayout>
  );
}

// Wrap the page with Suspense to handle search parameters
export default function RegisterPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <RegisterContent />
        </Suspense>
    );
}
