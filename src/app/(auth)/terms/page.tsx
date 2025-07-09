
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TermsPage() {
  const lastUpdated = "2024-07-29";
  
  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary">Términos y Condiciones de Servicio</h1>
        <p className="text-muted-foreground mt-2">Última actualización: {lastUpdated}</p>
      </header>

      <section className="space-y-6 text-foreground">
        <p>Estos Términos y Condiciones ("Términos") rigen tu acceso y uso de los servicios de Qyvoo, incluyendo el sitio web <a href="https://qyvoo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">qyvoo.com</a> y la plataforma de software como servicio accesible en <a href="https://admin.qyvoo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">admin.qyvoo.com</a> (colectivamente, el "Servicio"). El Servicio es operado por <a href="https://vemontech.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Vemontech</a> ("nosotros", "nuestro").</p>
        <p>Al registrarte o utilizar nuestro Servicio, aceptas estar sujeto a estos Términos. Si no estás de acuerdo, no utilices el Servicio.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">1. Cuentas</h2>
        <p>Para utilizar nuestro Servicio, debes crear una cuenta. Eres responsable de mantener la confidencialidad de tu contraseña y de todas las actividades que ocurran bajo tu cuenta. Debes notificarnos inmediatamente sobre cualquier uso no autorizado de tu cuenta.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">2. Suscripciones y Pagos</h2>
        <p>El Servicio se factura por suscripción. Al suscribirte, aceptas pagar las tarifas aplicables. Los pagos son gestionados por nuestro procesador de pagos externo, Stripe. Las suscripciones se renuevan automáticamente a menos que se cancelen. Eres responsable de cancelar tu suscripción a través del portal de gestión de clientes antes de la fecha de renovación.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">3. Uso Aceptable</h2>
        <p>Te comprometes a no utilizar el Servicio para ningún propósito ilegal o prohibido. Específicamente, te comprometes a no:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Utilizar el Servicio para enviar spam o mensajes no solicitados en violación de las leyes aplicables o las políticas de WhatsApp.</li>
          <li>Realizar ingeniería inversa, descompilar o intentar extraer el código fuente de nuestro software.</li>
          <li>Interferir o interrumpir la integridad o el rendimiento del Servicio.</li>
          <li>Intentar obtener acceso no autorizado al Servicio o a sus sistemas relacionados.</li>
        </ul>

        <h2 className="text-2xl font-semibold text-primary pt-4">4. Tu Contenido</h2>
        <p>Tú conservas la propiedad de todo el contenido que cargas en el Servicio, incluyendo mensajes, configuraciones de bots e información de contactos ("Tu Contenido"). Nos otorgas una licencia limitada para alojar, mostrar y procesar Tu Contenido únicamente con el fin de proporcionarte el Servicio.</p>
        <p>Eres el único responsable de la legalidad y adecuación de Tu Contenido. Qyvoo no revisa Tu Contenido, pero se reserva el derecho de eliminarlo si viola estos Términos.</p>
        
        <h2 className="text-2xl font-semibold text-primary pt-4">5. Propiedad Intelectual</h2>
        <p>El Servicio y su contenido original (excluyendo Tu Contenido), características y funcionalidad son y seguirán siendo propiedad exclusiva de Vemontech y sus licenciantes. El Servicio está protegido por derechos de autor, marcas comerciales y otras leyes.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">6. Terminación</h2>
        <p>Podemos suspender o cancelar tu cuenta inmediatamente, sin previo aviso ni responsabilidad, por cualquier motivo, incluido el incumplimiento de estos Términos. Tras la terminación, tu derecho a utilizar el Servicio cesará inmediatamente.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">7. Limitación de Responsabilidad</h2>
        <p>En la máxima medida permitida por la ley aplicable, en ningún caso Vemontech, sus directores, empleados o socios, serán responsables de ningún daño indirecto, incidental, especial, consecuente o punitivo, que resulte de tu acceso o uso, o la imposibilidad de acceder o usar el Servicio.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">8. Descargo de Responsabilidad ("Sin Garantías")</h2>
        <p>El Servicio se proporciona "TAL CUAL" y "SEGÚN DISPONIBILIDAD". Vemontech renuncia a todas las garantías, ya sean expresas o implícitas, incluidas, entre otras, las garantías implícitas de comerciabilidad, idoneidad para un propósito particular y no infracción.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">9. Cambios a los Términos</h2>
        <p>Nos reservamos el derecho, a nuestra entera discreción, de modificar o reemplazar estos Términos en cualquier momento. Si una revisión es material, te notificaremos con al menos 30 días de antelación. El uso continuado del Servicio después de que las revisiones entren en vigor constituye tu aceptación de los nuevos términos.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">10. Ley Aplicable y Jurisdicción</h2>
        <p>Estos Términos se regirán e interpretarán de acuerdo con las leyes del país de operación de Vemontech, sin tener en cuenta sus disposiciones sobre conflicto de leyes. Aceptas someterte a la jurisdicción de los tribunales ubicados en dicha jurisdicción para la resolución de cualquier disputa.</p>
      </section>

      <footer className="mt-12 text-center">
        <Button asChild variant="outline">
          <Link href="/register">Volver al Registro</Link>
        </Button>
      </footer>
    </div>
  );
}
