
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  const lastUpdated = "2024-07-29";

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary">Política de Privacidad de Qyvoo</h1>
        <p className="text-muted-foreground mt-2">Última actualización: {lastUpdated}</p>
      </header>

      <section className="space-y-6 text-foreground">
        <p>Bienvenido a Qyvoo. Tu privacidad es de suma importancia para nosotros. Esta Política de Privacidad explica cómo <a href="https://vemontech.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Vemontech</a> ("nosotros", "nuestro") recopila, usa, comparte y protege tu información en relación con los servicios de Qyvoo, disponibles a través de nuestro sitio web <a href="https://qyvoo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">qyvoo.com</a> y nuestra plataforma en <a href="https://admin.qyvoo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">admin.qyvoo.com</a> (el "Servicio").</p>
        
        <h2 className="text-2xl font-semibold text-primary pt-4">1. Información que Recopilamos</h2>
        <p>Recopilamos varios tipos de información para proporcionar y mejorar nuestro Servicio:</p>
        <ul className="list-disc pl-6 space-y-2">
            <li><strong>Información de Registro y Cuenta:</strong> Cuando te registras, recopilamos tu nombre completo, dirección de correo electrónico, nombre de usuario, número de teléfono y nombre de la empresa.</li>
            <li><strong>Datos de Pago:</strong> Las transacciones son procesadas por nuestro proveedor externo, Stripe. No almacenamos los detalles completos de tu tarjeta de crédito. Stripe nos proporciona un token y detalles parciales para gestionar tu suscripción.</li>
            <li><strong>Datos de Uso y Conversaciones:</strong> Recopilamos los datos que generas al usar nuestra plataforma, incluyendo la configuración de tus bots, los historiales de chat, notas internas e información de tus contactos. Esta información es esencial para el funcionamiento del Servicio.</li>
            <li><strong>Información Técnica:</strong> Recopilamos automáticamente cierta información cuando visitas nuestro Servicio, como tu dirección IP, tipo de navegador, y datos de uso a través de cookies y tecnologías similares.</li>
        </ul>

        <h2 className="text-2xl font-semibold text-primary pt-4">2. Cómo Usamos tu Información</h2>
        <p>Utilizamos la información recopilada para los siguientes propósitos:</p>
         <ul className="list-disc pl-6 space-y-2">
            <li>Para proporcionar, operar y mantener nuestro Servicio.</li>
            <li>Para gestionar tu cuenta, suscripciones y procesar pagos.</li>
            <li>Para mejorar, personalizar y expandir nuestro Servicio.</li>
            <li>Para comunicarnos contigo, ya sea directamente o a través de uno de nuestros socios, incluso para atención al cliente, para proporcionarte actualizaciones y otra información relacionada con el Servicio, y para fines de marketing y promoción (siempre con opción a darte de baja).</li>
            <li>Para enviar correos electrónicos transaccionales importantes, como invitaciones a equipos o notificaciones de asignación.</li>
            <li>Para prevenir fraudes y garantizar la seguridad de nuestra plataforma.</li>
        </ul>

        <h2 className="text-2xl font-semibold text-primary pt-4">3. Compartir tu Información</h2>
        <p>No vendemos tu información personal. Podemos compartir tu información en las siguientes situaciones:</p>
         <ul className="list-disc pl-6 space-y-2">
            <li><strong>Proveedores de Servicios:</strong> Compartimos información con empresas de terceros que nos ayudan a operar, como Google (Firebase para base de datos y autenticación), Stripe (procesamiento de pagos) y nuestro proveedor de servicios de correo electrónico para notificaciones.</li>
            <li><strong>Cumplimiento Legal:</strong> Podemos divulgar tu información si así lo requiere la ley o en respuesta a solicitudes válidas de las autoridades públicas.</li>
        </ul>
        
        <h2 className="text-2xl font-semibold text-primary pt-4">4. Seguridad de los Datos</h2>
        <p>La seguridad de tus datos es una prioridad. Utilizamos medidas de seguridad estándar de la industria, como el cifrado y las prácticas de desarrollo seguro, para proteger tu información. Sin embargo, ningún método de transmisión por Internet o almacenamiento electrónico es 100% seguro.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">5. Tus Derechos de Privacidad</h2>
        <p>Tienes derecho a acceder, corregir o eliminar tu información personal. Puedes gestionar la mayor parte de tu información directamente en la sección "Perfil" de tu panel de control. Para solicitudes de eliminación de cuenta u otras consultas, por favor contáctanos.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">6. Contacto</h2>
        <p>Si tienes alguna pregunta sobre esta Política de Privacidad, por favor contáctanos a través de la información de contacto proporcionada en el sitio web de <a href="https://vemontech.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Vemontech</a>.</p>

      </section>

      <footer className="mt-12 text-center">
        <Button asChild variant="outline">
          <Link href="/register">Volver al Registro</Link>
        </Button>
      </footer>
    </div>
  );
}
