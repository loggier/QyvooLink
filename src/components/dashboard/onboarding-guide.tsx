
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
    ctaLink: '/dashboard/bots',
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
    // When the guide is opened manually, always reset to the first step.
    if (isOpen && startFromBeginning) {
      setCurrentStep(0);
    }
  }, [isOpen, startFromBeginning]);

  // Moves to the next step in the guide.
  const handleNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, onboardingSteps.length - 1));
  };

  // Moves to the previous step in the guide.
  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  /**
   * Marks the onboarding as completed for the user in Firestore so it won't show automatically again.
   * This is called when the user clicks "Omitir" or "Finalizar".
   */
  const handleCompleteOnboarding = async () => {
    setIsOpen(false); // Close the dialog immediately for a snappy UX.
    if (!user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { onboardingCompleted: true });
    } catch (error) {
      console.error("Error updating onboarding status:", error);
      // Optional: show a toast to the user if saving fails.
    }
  };

  // Handles the main call-to-action button click for the current step.
  const handleCtaClick = () => {
    const step = onboardingSteps[currentStep];
    if (step.ctaLink) {
      router.push(step.ctaLink);
      setIsOpen(false); // Close the dialog to let the user navigate and complete the action.
    } else {
      handleNextStep();
    }
  };

  const step = onboardingSteps[currentStep];
  const Icon = step.icon;
  const isFinalStep = currentStep === onboardingSteps.length - 1;
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
            {/* Left-aligned button(s): "Anterior" and "Omitir" */}
            <div className="flex gap-2">
                {currentStep > 0 && (
                    <Button variant="outline" onClick={handlePreviousStep}>
                        Anterior
                    </Button>
                )}
                 {!isFinalStep && (
                    <Button variant="ghost" onClick={handleCompleteOnboarding}>
                        Omitir
                    </Button>
                )}
            </div>

            {/* Right-aligned button: Main CTA */}
            <Button onClick={isFinalStep ? handleCompleteOnboarding : handleCtaClick}>
                {step.ctaText}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
