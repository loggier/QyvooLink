import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary">Términos y Condiciones</h1>
        <p className="text-muted-foreground mt-2">Última actualización: {new Date().toLocaleDateString()}</p>
      </header>

      <section className="space-y-6 text-foreground">
        <p>¡Bienvenido a Qyvoo! Estos términos y condiciones describen las reglas y regulaciones para el uso del sitio web de Qyvoo, ubicado en [URL de tu sitio web].</p>
        <p>Al acceder a este sitio web asumimos que aceptas estos términos y condiciones. No continúes usando Qyvoo si no estás de acuerdo con todos los términos y condiciones establecidos en esta página.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">1. Introducción</h2>
        <p>Estos Términos y Condiciones Estándar del Sitio Web escritos en esta página web administrarán tu uso de nuestro sitio web, Qyvoo accesible en [URL de tu sitio web].</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">2. Derechos de Propiedad Intelectual</h2>
        <p>Aparte del contenido que posees, bajo estos Términos, Qyvoo y/o sus licenciantes poseen todos los derechos de propiedad intelectual y materiales contenidos en este Sitio Web.</p>
        <p>Se te concede una licencia limitada solo para fines de visualización del material contenido en este Sitio Web.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">3. Restricciones</h2>
        <p>Estás específicamente restringido de todo lo siguiente:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>publicar cualquier material del Sitio Web en cualquier otro medio;</li>
          <li>vender, sublicenciar y/o comercializar de otra manera cualquier material del Sitio Web;</li>
          <li>realizar públicamente y/o mostrar cualquier material del Sitio Web;</li>
          <li>usar este Sitio Web de cualquier manera que sea o pueda ser perjudicial para este Sitio Web;</li>
          <li>usar este Sitio Web de cualquier manera que afecte el acceso de los usuarios a este Sitio Web;</li>
          <li>usar este Sitio Web contrario a las leyes y regulaciones aplicables, o de cualquier manera que pueda causar daño al Sitio Web, o a cualquier persona o entidad comercial;</li>
          <li>participar en cualquier minería de datos, recolección de datos, extracción de datos o cualquier otra actividad similar en relación con este Sitio Web;</li>
          <li>usar este Sitio Web para participar en cualquier publicidad o marketing.</li>
        </ul>
        <p>Ciertas áreas de este Sitio Web están restringidas para tu acceso y Qyvoo puede restringir aún más tu acceso a cualquier área de este Sitio Web, en cualquier momento, a su absoluta discreción. Cualquier ID de usuario y contraseña que puedas tener para este Sitio Web son confidenciales y también debes mantener la confidencialidad.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">4. Tu Contenido</h2>
        <p>En estos Términos y Condiciones Estándar del Sitio Web, "Tu Contenido" significará cualquier audio, video, texto, imágenes u otro material que elijas mostrar en este Sitio Web. Al mostrar Tu Contenido, otorgas a Qyvoo una licencia no exclusiva, mundial, irrevocable y sublicenciable para usar, reproducir, adaptar, publicar, traducir y distribuirlo en cualquier medio.</p>
        <p>Tu Contenido debe ser tuyo y no debe invadir los derechos de terceros. Qyvoo se reserva el derecho de eliminar cualquiera de Tu Contenido de este Sitio Web en cualquier momento sin previo aviso.</p>
        
        <h2 className="text-2xl font-semibold text-primary pt-4">5. Sin garantías</h2>
        <p>Este Sitio Web se proporciona "tal cual", con todas sus fallas, y Qyvoo no expresa representaciones ni garantías de ningún tipo relacionadas con este Sitio Web o los materiales contenidos en este Sitio Web. Además, nada de lo contenido en este Sitio Web se interpretará como un consejo para ti.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">6. Limitación de responsabilidad</h2>
        <p>En ningún caso Qyvoo, ni ninguno de sus funcionarios, directores y empleados, serán responsables de nada que surja de o esté relacionado de alguna manera con tu uso de este Sitio Web, ya sea que dicha responsabilidad sea contractual. Qyvoo, incluidos sus funcionarios, directores y empleados, no serán responsables de ninguna responsabilidad indirecta, consecuente o especial que surja de o esté relacionada de alguna manera con tu uso de este Sitio Web.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">7. Indemnización</h2>
        <p>Por la presente, indemnizas en la mayor medida posible a Qyvoo de y contra todas y cada una de las responsabilidades, costos, demandas, causas de acción, daños y gastos que surjan de cualquier manera relacionados con tu incumplimiento de cualquiera de las disposiciones de estos Términos.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">8. Divisibilidad</h2>
        <p>Si alguna disposición de estos Términos se considera inválida según cualquier ley aplicable, dichas disposiciones se eliminarán sin afectar las disposiciones restantes del presente.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">9. Variación de los Términos</h2>
        <p>Qyvoo tiene permitido revisar estos Términos en cualquier momento según lo considere oportuno, y al usar este Sitio Web se espera que revises estos Términos de forma regular.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">10. Cesión</h2>
        <p>Qyvoo puede ceder, transferir y subcontratar sus derechos y/u obligaciones bajo estos Términos sin ninguna notificación. Sin embargo, no se te permite ceder, transferir o subcontratar ninguno de tus derechos y/u obligaciones bajo estos Términos.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">11. Acuerdo completo</h2>
        <p>Estos Términos constituyen el acuerdo completo entre Qyvoo y tú en relación con tu uso de este Sitio Web, y reemplazan todos los acuerdos y entendimientos anteriores.</p>

        <h2 className="text-2xl font-semibold text-primary pt-4">12. Ley Aplicable y Jurisdicción</h2>
        <p>Estos Términos se regirán e interpretarán de acuerdo con las leyes del Estado de [Tu Estado/País], y te sometes a la jurisdicción no exclusiva de los tribunales estatales y federales ubicados en [Tu Estado/País] para la resolución de cualquier disputa.</p>
      </section>

      <footer className="mt-12 text-center">
        <Button asChild variant="outline">
          <Link href="/register">Volver al Registro</Link>
        </Button>
      </footer>
    </div>
  );
}
