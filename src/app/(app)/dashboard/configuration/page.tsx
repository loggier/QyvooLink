
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, MessageSquareText, Settings2, Trash2, Users, PlusCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const addInstanceSchema = z.object({
  instanceName: z.string().min(3, { message: "El nombre de la instancia debe tener al menos 3 caracteres." }),
  phoneNumber: z.string().regex(phoneRegex, { message: "Número de teléfono inválido." }),
});

type AddInstanceFormData = z.infer<typeof addInstanceSchema>;

type InstanceStatus = 'Conectado' | 'Desconectado' | 'Pendiente';

interface WhatsAppInstance {
  id: string; 
  name: string;
  phoneNumber: string;
  apiKey?: string; 
  status: InstanceStatus;
  qrCodeUrl?: string; 
  connectionWebhookUrl?: string;
}

export default function ConfigurationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddInstanceDialogOpen, setIsAddInstanceDialogOpen] = useState(false);
  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For add/delete operations
  const [isRefreshing, setIsRefreshing] = useState(false); // For refresh operation
  const [showApiKey, setShowApiKey] = useState(false);


  // Simular carga de instancia existente para un usuario
  useEffect(() => {
    // Para demostración, podrías usar localStorage, pero en una app real, usa Firestore.
    // const storedInstance = localStorage.getItem(`qyvooInstance_${user?.uid}`);
    // if (storedInstance) {
    //   setWhatsAppInstance(JSON.parse(storedInstance));
    // }
  }, [user?.uid]);


  const form = useForm<AddInstanceFormData>({
    resolver: zodResolver(addInstanceSchema),
    defaultValues: {
      instanceName: user?.username || user?.fullName || "",
      phoneNumber: "",
    },
  });

   useEffect(() => {
    if (user) {
      form.reset({
        instanceName: user.username || user.fullName || "",
        phoneNumber: "",
      });
    }
  }, [user, form]);

  const mapWebhookStatus = (webhookStatus?: string): InstanceStatus => {
    if (!webhookStatus) return 'Pendiente';
    switch (webhookStatus.toLowerCase()) {
      case 'open':
      case 'connected':
        return 'Conectado';
      case 'close':
      case 'connecting':
        return 'Pendiente';
      case 'disconnected':
        return 'Desconectado';
      default:
        return 'Pendiente';
    }
  };

  async function onSubmitAddInstance(values: AddInstanceFormData) {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado." });
      return;
    }
    setIsLoading(true);
    
    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false'; // Defaults to true (use test) if env var is not 'false'
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook/evolution';
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook-test/evolution';

    const baseWebhookUrl = useTestWebhook ? testWebhookBase : prodWebhookBase;
    const webhookUrl = `${baseWebhookUrl}?action=create_instance`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: values.instanceName,
          phoneNumber: values.phoneNumber,
          userId: user.uid, 
        }),
      });

      const responseBody = await response.json();

      if (!response.ok) {
        const errorMessage = responseBody?.message || responseBody?.error?.message || `Error del servidor: ${response.status}`;
        throw new Error(errorMessage);
      }
      
      const webhookData = Array.isArray(responseBody) && responseBody.length > 0 ? responseBody[0] : responseBody;

      if (!webhookData || !webhookData.success || !webhookData.data || !webhookData.data.instance) {
        throw new Error("Respuesta inesperada del webhook al crear la instancia.");
      }

      const instanceData = webhookData.data.instance;
      const hashData = webhookData.data.hash;

      const newInstance: WhatsAppInstance = {
        id: instanceData.instanceId || instanceData.instanceName, // Use instanceId, fallback to instanceName
        name: instanceData.instanceName, 
        phoneNumber: values.phoneNumber, // Use the phone number from the form
        status: mapWebhookStatus(instanceData.status), 
        apiKey: hashData || '********************-****-****-************', // Use hash if available
        qrCodeUrl: instanceData.qrCodeUrl || webhookData.data.qrCodeUrl, // Check both possible locations
        connectionWebhookUrl: instanceData.connectionWebhookUrl || webhookData.data.connectionWebhookUrl, // Check both possible locations
      };
      
      setWhatsAppInstance(newInstance);
      // localStorage.setItem(`qyvooInstance_${user.uid}`, JSON.stringify(newInstance)); // Persistir para demo

      toast({ title: "Instancia Solicitada", description: "Tu instancia de Qyvoo ha sido solicitada." });
      setIsAddInstanceDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al crear instancia", description: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteInstance = async () => {
    if (!user || !whatsAppInstance) return;
    setIsLoading(true);
    // const webhookUrl = `COMENTADO_URL_BORRADO?action=delete_instance&instanceId=${whatsAppInstance.id}`;
    try {
      // await fetch(webhookUrl, { method: 'POST' }); // En una app real, llamarías a un webhook para eliminar
      setWhatsAppInstance(null);
      // localStorage.removeItem(`qyvooInstance_${user.uid}`);
      toast({ title: "Instancia Eliminada", description: "La instancia de Qyvoo ha sido eliminada (simulado)." });
    } catch (error: any)      {
      toast({ variant: "destructive", title: "Error al eliminar", description: "No se pudo eliminar la instancia." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshInstance = async () => {
    if (!user || !whatsAppInstance) {
      toast({ variant: "destructive", title: "Error", description: "No hay instancia para refrescar o no estás autenticado." });
      return;
    }
    setIsRefreshing(true);

    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false'; // Defaults to true (use test) if env var is not 'false'
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook/evolution';
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook-test/evolution';
    
    const baseWebhookUrl = useTestWebhook ? testWebhookBase : prodWebhookBase;
    const webhookUrl = `${baseWebhookUrl}?action=get_info_instance`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: whatsAppInstance.name, // Send instanceName as requested
          userId: user.uid, 
        }),
      });

      const responseBody = await response.json();

      if (!response.ok) {
        const errorMessage = responseBody?.message || responseBody?.error?.message || `Error del servidor: ${response.status}`;
        throw new Error(errorMessage);
      }

      const webhookData = Array.isArray(responseBody) && responseBody.length > 0 ? responseBody[0] : responseBody;

      if (!webhookData || !webhookData.success || !webhookData.data || !webhookData.data.instance) {
        throw new Error("Respuesta inesperada del webhook al refrescar la instancia.");
      }

      const instanceData = webhookData.data.instance;
      const hashData = webhookData.data.hash;

      // Update only the relevant fields from the webhook response
      const updatedInstanceData: Partial<WhatsAppInstance> = {
        status: mapWebhookStatus(instanceData.status),
        apiKey: hashData || whatsAppInstance.apiKey, // Conservar el anterior si no viene uno nuevo
        qrCodeUrl: instanceData.qrCodeUrl || webhookData.data.qrCodeUrl, // Esto puede ser null si ya no es necesario
        connectionWebhookUrl: instanceData.connectionWebhookUrl || webhookData.data.connectionWebhookUrl, // Puede ser null
      };
      
      // Merge with existing instance data to preserve id, name, phoneNumber
      setWhatsAppInstance(prev => prev ? { ...prev, ...updatedInstanceData } : null);
      // localStorage.setItem(`qyvooInstance_${user.uid}`, JSON.stringify(whatsAppInstance)); // Actualizar persistencia para demo

      toast({ title: "Estado Actualizado", description: "El estado de la instancia de Qyvoo ha sido actualizado." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al refrescar", description: error.message });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const copyToClipboard = (text?: string) => {
    if (!text) {
      toast({ variant: "destructive", title: "Error", description: "No hay API Key para copiar." });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copiado", description: "API Key copiada al portapapeles." }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo copiar la API Key." }));
  };


  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Panel de Configuración</h2>
        <p className="text-muted-foreground">
          Gestiona la configuración de tu API Qyvoo, instancias de WhatsApp, horarios comerciales y mensajes.
        </p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Instancia de Qyvoo WhatsApp</CardTitle>
            {!whatsAppInstance && (
              <Dialog open={isAddInstanceDialogOpen} onOpenChange={setIsAddInstanceDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsAddInstanceDialogOpen(true)} disabled={isLoading || isRefreshing}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Agregar Instancia
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Agregar Nueva Instancia de Qyvoo</DialogTitle>
                    <DialogDescription>
                      Ingresa los detalles para configurar tu nueva instancia de WhatsApp.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitAddInstance)} className="space-y-4 py-4">
                      <FormField
                        control={form.control}
                        name="instanceName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre de la Instancia</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Mi Negocio Principal" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número de Teléfono (con código de país)</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+1234567890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddInstanceDialogOpen(false)} disabled={isLoading}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? "Agregando..." : "Agregar Instancia"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <CardDescription>Gestiona tu conexión de WhatsApp a través de Qyvoo.</CardDescription>
        </CardHeader>
        <CardContent>
          {whatsAppInstance ? (
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">{whatsAppInstance.name}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => alert("Funcionalidad de ajustes de instancia pendiente.")}>
                  <Settings2 className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qyvooApiKey">Qyvoo API Key (Hash)</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="qyvooApiKey"
                      type={showApiKey ? "text" : "password"}
                      readOnly
                      value={whatsAppInstance.apiKey || "No disponible"}
                      className="flex-grow"
                    />
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(whatsAppInstance.apiKey)} disabled={!whatsAppInstance.apiKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <Separator />

                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(whatsAppInstance.name)}&background=random&size=128`} alt={whatsAppInstance.name} data-ai-hint="business logo"/>
                    <AvatarFallback>{whatsAppInstance.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-md font-medium">{whatsAppInstance.name}</p>
                    <p className="text-sm text-muted-foreground">{whatsAppInstance.phoneNumber}</p>
                  </div>
                </div>

                {whatsAppInstance.qrCodeUrl && whatsAppInstance.status === 'Pendiente' && (
                  <div className="mt-4 p-4 border rounded-md bg-accent/10 text-center">
                    <p className="text-sm text-accent-foreground mb-2">Escanea este código QR con WhatsApp en tu teléfono para conectar la instancia.</p>
                    <img src={whatsAppInstance.qrCodeUrl} alt="QR Code para conectar WhatsApp" className="mx-auto mb-2 max-w-xs" data-ai-hint="qr code"/>
                    {whatsAppInstance.connectionWebhookUrl && (
                       <Button variant="outline" size="sm" asChild>
                        <a href={whatsAppInstance.connectionWebhookUrl} target="_blank" rel="noopener noreferrer">
                          Abrir QR en nueva pestaña <ExternalLink className="ml-2 h-3 w-3"/>
                        </a>
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">El estado se actualizará automáticamente una vez conectado.</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Contactos</p>
                      <p className="text-lg font-semibold">N/A</p> {/* Placeholder */}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MessageSquareText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mensajes/mes</p>
                      <p className="text-lg font-semibold">N/A</p> {/* Placeholder */}
                    </div>
                  </div>
                </div>

              </CardContent>
              <CardFooter className="flex justify-between items-center">
                 <Badge variant={
                    whatsAppInstance.status === 'Conectado' ? 'default' : 
                    whatsAppInstance.status === 'Pendiente' ? 'secondary' : 
                    'destructive'
                  } 
                  className={
                    whatsAppInstance.status === 'Conectado' ? 'bg-green-500 text-primary-foreground' :
                    whatsAppInstance.status === 'Pendiente' ? 'bg-yellow-400 text-black' :
                    'bg-red-500 text-destructive-foreground'
                }>
                  {whatsAppInstance.status}
                </Badge>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={handleRefreshInstance} disabled={isLoading || isRefreshing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? "Refrescando..." : "Refrescar Estado"}
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteInstance} disabled={isLoading || isRefreshing}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isLoading && whatsAppInstance ? "Eliminando..." : "Eliminar"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay ninguna instancia de Qyvoo WhatsApp configurada.</p>
              <p className="text-sm text-muted-foreground">Haz clic en "Agregar Instancia" para comenzar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración General de API Qyvoo</CardTitle>
          <CardDescription>Configura tu conexión a la API general de Qyvoo (si aplica).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL de la API Qyvoo</Label>
            <Input id="apiUrl" placeholder="https://api.qyvoo.com" defaultValue="https://api.qyvoo.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">Clave de API Qyvoo</Label>
            <Input id="apiKey" type="password" placeholder="Ingresa tu Clave de API" defaultValue="tuClaveApiQyvooSecreta" />
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
            <Textarea id="welcomeMessage" placeholder="¡Bienvenido a nuestro servicio!" defaultValue="¡Hola! Bienvenido a Qyvoo. ¿Cómo podemos ayudarte hoy?"/>
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
        <Button size="lg" onClick={() => toast({ title: "Guardado", description: "Configuraciones guardadas (simulado)." })}>
            Guardar Configuraciones
        </Button>
      </div>
    </div>
  );
}
    

    