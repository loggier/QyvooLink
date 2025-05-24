import { RegisterForm } from '@/components/auth/register-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your EvolveLink Account"
      description="Fill in the details below to get started."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
