import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default function ConfigurationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Panel de Configuración</h2>
        <p className="text-muted-foreground">
          Gestiona la configuración de tu API Evolution, horarios comerciales, respuestas automáticas y mensajes de bienvenida.
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Configuración de API</CardTitle>
          <CardDescription>Configura tu conexión a la API Evolution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL de la API</Label>
            <Input id="apiUrl" placeholder="https://api.example.com/evolution" defaultValue="https://your-evolution-api-url.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">Clave de API</Label>
            <Input id="apiKey" type="password" placeholder="Ingresa tu Clave de API" defaultValue="yourSecretApiKey" />
          </div>
          <Button>Probar Conexión</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario Comercial</CardTitle>
          <CardDescription>Establece tus horas operativas para respuestas automáticas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id="businessHoursEnabled" defaultChecked />
            <Label htmlFor="businessHoursEnabled">Habilitar Horario Comercial</Label>
          </div>
          {/* Add more complex business hours configuration here: day pickers, time inputs etc. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Hora de Inicio</Label>
              <Input id="startTime" type="time" defaultValue="09:00" />
            </div>
            <div>
              <Label htmlFor="endTime">Hora de Fin</Label>
              <Input id="endTime" type="time" defaultValue="17:00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="outOfOfficeMessage">Mensaje de Fuera de Oficina</Label>
            <Textarea id="outOfOfficeMessage" placeholder="Actualmente no estamos disponibles..." defaultValue="Gracias por tu mensaje. Actualmente estamos fuera de la oficina y te responderemos durante nuestro horario comercial (Lun-Vie, 9 AM - 5 PM)." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Respuestas Automáticas y Mensajes de Bienvenida</CardTitle>
          <CardDescription>Personaliza mensajes automatizados para tus usuarios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id="welcomeMessageEnabled" defaultChecked />
            <Label htmlFor="welcomeMessageEnabled">Habilitar Mensaje de Bienvenida</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Texto del Mensaje de Bienvenida</Label>
            <Textarea id="welcomeMessage" placeholder="¡Bienvenido a nuestro servicio!" defaultValue="¡Hola! Bienvenido a [Nombre de tu Empresa]. ¿Cómo podemos ayudarte hoy?"/>
          </div>
          
          <Separator className="my-6" />

          <div className="flex items-center space-x-2">
            <Switch id="autoResponderEnabled" />
            <Label htmlFor="autoResponderEnabled">Habilitar Respuesta Automática General (ej. para palabras clave comunes)</Label>
          </div>
           <div className="space-y-2">
            <Label htmlFor="autoResponderKeywords">Palabras Clave (separadas por comas)</Label>
            <Input id="autoResponderKeywords" placeholder="precios, ayuda, soporte" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autoResponderMessage">Mensaje de Respuesta Automática</Label>
            <Textarea id="autoResponderMessage" placeholder="Gracias por preguntar sobre..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg">Guardar Configuraciones</Button>
      </div>
    </div>
  );
}
