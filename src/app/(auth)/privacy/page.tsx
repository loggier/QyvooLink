
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary">Política de Privacidad</h1>
        <p className="text-muted-foreground mt-2">Última actualización: {new Date().toLocaleDateString()}</p>
      </header>

      <section className="space-y-6 text-foreground">
        <p>Tu privacidad es importante para nosotros. Es política de Qyvoo respetar tu privacidad con respecto a cualquier información que podamos recopilar de ti a través de nuestro sitio web y otros sitios que poseemos y operamos.</p>
        
        <h2 className="text-2xl font-semibold text-primary pt-4">1. Información que recopilamos</h2>
        <p>Solo pedimos información personal cuando realmente la necesitamos para brindarte un servicio. La recopilamos por medios justos y legales, con tu conocimiento y consentimiento. También te informamos por qué la recopilamos y cómo se utilizará.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">2. Uso de la información</h2>
        <p>Utilizamos la información recopilada para operar y mantener los servicios del sitio web, notificarte sobre cambios en nuestros servicios, permitirte participar en funciones interactivas de nuestro servicio cuando elijas hacerlo, proporcionar atención al cliente y recopilar análisis o información valiosa para que podamos mejorar nuestro servicio.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">3. Seguridad de los datos</h2>
        <p>La seguridad de tus datos es importante para nosotros, pero recuerda que ningún método de transmisión por Internet o método de almacenamiento electrónico es 100% seguro. Si bien nos esforzamos por utilizar medios comercialmente aceptables para proteger tus Datos Personales, no podemos garantizar su seguridad absoluta.</p>
        
        <h2 className="text-2xl font-semibold text-primary pt-4">4. Enlaces a otros sitios</h2>
        <p>Nuestro servicio puede contener enlaces a otros sitios que no son operados por nosotros. Si haces clic en un enlace de un tercero, serás dirigido al sitio de ese tercero. Te recomendamos encarecidamente que revises la Política de Privacidad de cada sitio que visites.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">5. Cambios a esta Política de Privacidad</h2>
        <p>Podemos actualizar nuestra Política de Privacidad de vez en cuando. Te notificaremos cualquier cambio publicando la nueva Política de Privacidad en esta página. Se te aconseja revisar esta Política de Privacidad periódicamente para cualquier cambio.</p>

      </section>

      <footer className="mt-12 text-center">
        <Button asChild variant="outline">
          <Link href="/register">Volver al Registro</Link>
        </Button>
      </footer>
    </div>
  );
}
