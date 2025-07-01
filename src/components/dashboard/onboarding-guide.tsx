
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Rocket, Settings, Bot, PartyPopper } from 'lucide-react';
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

interface OnboardingGuideProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  startFromBeginning?: boolean;
}

export default function OnboardingGuide({ isOpen, setIsOpen, startFromBeginning = false }: OnboardingGuideProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen && startFromBeginning) {
      setCurrentStep(0);
    }
  }, [isOpen, startFromBeginning]);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, onboardingSteps.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = async () => {
    if (!user) {
      setIsOpen(false);
      return;
    };
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

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:w-full">
            {/* Left-aligned button(s) */}
            <div>
                {currentStep > 0 && (
                    <Button variant="outline" onClick={handlePrevious}>
                        Anterior
                    </Button>
                )}
            </div>

            {/* Right-aligned button(s) */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {currentStep < onboardingSteps.length - 1 && (
                    <Button variant="ghost" onClick={handleFinish}>
                        Omitir
                    </Button>
                )}
                <Button onClick={currentStep === onboardingSteps.length - 1 ? handleFinish : handleCtaClick}>
                    {step.ctaText}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
