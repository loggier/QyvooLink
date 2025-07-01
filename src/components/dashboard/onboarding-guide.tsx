
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Rocket, Settings, Bot, PartyPopper } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

const onboardingSteps = [
  {
    icon: Rocket,
    title: '¡Bienvenido a Qyvoo!',
    description: "Vamos a configurar tu cuenta en menos de 2 minutos para que puedas empezar a automatizar tus conversaciones. Haz clic en 'Siguiente' para comenzar.",
    ctaLink: null,
    ctaText: 'Siguiente',
  },
  {
    icon: Settings,
    title: 'Paso 1: Conecta tu WhatsApp',
    description: 'El primer paso es conectar tu instancia de WhatsApp. Ve a la página de configuración para escanear el código QR y vincular tu teléfono.',
    ctaLink: '/dashboard/configuration',
    ctaText: 'Ir a Configuración',
  },
  {
    icon: Bot,
    title: 'Paso 2: Configura tu Asistente Virtual',
    description: '¡Genial! Ahora, dale una personalidad a tu bot. Define su rol, sus reglas y el catálogo de servicios que ofrecerá a tus clientes.',
    ctaLink: '/dashboard/bot-config',
    ctaText: 'Configurar mi Bot',
  },
  {
    icon: PartyPopper,
    title: '¡Todo Listo!',
    description: 'Has completado la configuración inicial. Ahora puedes monitorear tus conversaciones, ajustar tu bot y ver reportes. ¡Disfruta de la automatización!',
    ctaLink: null,
    ctaText: 'Finalizar',
  },
];

export default function OnboardingGuide() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const checkOnboardingStatus = async () => {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (!data.onboardingCompleted) {
              setIsOpen(true);
            }
          }
        } catch (error) {
          console.error("Error checking onboarding status:", error);
        } finally {
          setIsLoading(false);
        }
      };
      checkOnboardingStatus();
    } else {
        setIsLoading(false);
    }
  }, [user]);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, onboardingSteps.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { onboardingCompleted: true });
      setIsOpen(false);
    } catch (error) {
      console.error("Error updating onboarding status:", error);
    }
  };

  const handleCtaClick = () => {
    const step = onboardingSteps[currentStep];
    if (step.ctaLink) {
      router.push(step.ctaLink);
      setIsOpen(false); // Close the dialog to let the user navigate
    } else {
      handleNext();
    }
  };

  if (isLoading) {
    return null; // Don't render anything while checking status
  }

  const step = onboardingSteps[currentStep];
  const Icon = step.icon;
  const progressValue = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <Icon className="h-12 w-12 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{step.title}</DialogTitle>
          <DialogDescription className="text-center">
            {step.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
            <Progress value={progressValue} className="w-full" />
            <p className="text-xs text-center text-muted-foreground mt-2">
                Paso {currentStep + 1} de {onboardingSteps.length}
            </p>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between w-full">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handlePrevious}>
              Anterior
            </Button>
          )}

          {currentStep === onboardingSteps.length - 1 ? (
             <Button onClick={handleFinish} className="flex-1">
                Finalizar
             </Button>
          ) : (
            <Button onClick={handleCtaClick} className="flex-1">
                {step.ctaText}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
