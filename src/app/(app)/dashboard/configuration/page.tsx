
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
import { useState, useEffect, useCallback } from 'react';
import { Copy, Eye, EyeOff, MessageSquareText, Settings2, Trash2, Users, PlusCircle, ExternalLink, RefreshCw, ListChecks, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase'; // Import Firestore instance
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'; // Import Firestore functions

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const addInstanceSchema = z.object({
  instanceName: z.string().min(3, { message: "El nombre de la instancia debe tener al menos 3 caracteres." }),
  phoneNumber: z.string().regex(phoneRegex, { message: "Número de teléfono inválido." }),
});

type AddInstanceFormData = z.infer<typeof addInstanceSchema>;

type InstanceStatus = 'Conectado' | 'Desconectado' | 'Pendiente';

interface WhatsAppInstanceCount {
  Message: number;
  Contact: number;
  Chat: number;
}

interface WhatsAppInstance {
  id: string; // Qyvoo/Evolution Instance ID
  name: string; // Instance Name
  phoneNumber: string;
  apiKey?: string;
  status: InstanceStatus;
  qrCodeUrl?: string | null;
  connectionWebhookUrl?: string | null;
  _count?: WhatsAppInstanceCount;
  userId: string;
  userEmail: string | null;
}

interface RefreshedInstanceInfo {
  id: string; 
  name: string; 
  connectionStatus: string; 
  token?: string; 
  qrCodeUrl?: string;
  connectionWebhookUrl?: string;
  _count?: WhatsAppInstanceCount;
}


export default function ConfigurationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddInstanceDialogOpen, setIsAddInstanceDialogOpen] = useState(false);
  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For create/delete/refresh actions
  const [isPageLoading, setIsPageLoading] = useState(true); // For initial page load and instance fetch


  const mapWebhookStatus = useCallback((webhookStatus?: string): InstanceStatus => {
    if (!webhookStatus) return 'Pendiente';
    switch (webhookStatus.toLowerCase()) {
      case 'open':
      case 'connected':
        return 'Conectado';
      case 'close':
      case 'connecting': // "connecting" should ideally be a distinct state, but for now maps to Pendiente
        return 'Pendiente';
      case 'disconnected':
        return 'Desconectado';
      default:
        return 'Pendiente';
    }
  }, []);

  const fetchAndUpdateInstanceInfo = useCallback(async (instanceToRefresh: WhatsAppInstance, showToast = true) => {
    if (!user) {
      if (showToast) toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado." });
      return false;
    }
    setIsLoading(true);

    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook/evolution';
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook-test/evolution';
    
    const baseWebhookUrl = useTestWebhook ? testWebhookBase : prodWebhookBase;
    const webhookUrl = `${baseWebhookUrl}?action=get_info_instance`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instanceToRefresh.name, userId: user.uid }),
      });

      const responseDataArray = await response.json();

      if (!response.ok) {
        const errorBody = Array.isArray(responseDataArray) && responseDataArray.length > 0 ? responseDataArray[0] : responseDataArray;
        const errorMessage = errorBody?.message || errorBody?.error?.message || `Error del servidor: ${response.status}`;
        throw new Error(errorMessage);
      }

      if (!Array.isArray(responseDataArray) || responseDataArray.length === 0) {
        throw new Error("Respuesta inesperada del webhook al refrescar: El formato no es un array o está vacío.");
      }
      
      const refreshedWebhookInfoOuter = responseDataArray[0];

      if (!refreshedWebhookInfoOuter || !refreshedWebhookInfoOuter.success || !Array.isArray(refreshedWebhookInfoOuter.data) || refreshedWebhookInfoOuter.data.length === 0) {
        const errorDetail = refreshedWebhookInfoOuter.data?.[0]?.message || refreshedWebhookInfoOuter.data?.message || refreshedWebhookInfoOuter.error || "Formato de datos de instancia incorrecto o no exitoso.";
        // If instance not found on Qyvoo, delete from Firebase
        if (errorDetail.toLowerCase().includes('instance not found') || errorDetail.toLowerCase().includes('not found')) {
          await deleteDoc(doc(db, 'instances', user.uid));
          setWhatsAppInstance(null);
          if (showToast) toast({ title: "Instancia no encontrada", description: "La instancia fue eliminada de Qyvoo y de tu configuración." });
          return false;
        }
        throw new Error(`Respuesta del webhook no fue exitosa o datos de instancia no encontrados: ${errorDetail}`);
      }

      const instanceInfo: RefreshedInstanceInfo = refreshedWebhookInfoOuter.data[0];

      const updatedInstanceData: Partial<WhatsAppInstance> = {
        status: mapWebhookStatus(instanceInfo.connectionStatus), // Use connectionStatus
        apiKey: instanceInfo.token || instanceToRefresh.apiKey, 
        qrCodeUrl: instanceInfo.qrCodeUrl || null, 
        connectionWebhookUrl: instanceInfo.connectionWebhookUrl || null,
        _count: instanceInfo._count || instanceToRefresh._count,
        // id, name, phoneNumber, userId, userEmail are preserved from instanceToRefresh
      };
      
      const fullyUpdatedInstance = { ...instanceToRefresh, ...updatedInstanceData };
      
      await setDoc(doc(db, 'instances', user.uid), fullyUpdatedInstance);
      setWhatsAppInstance(fullyUpdatedInstance);

      if (showToast) toast({ title: "Estado Actualizado", description: "El estado de la instancia de Qyvoo ha sido actualizado." });
      return true;
    } catch (error: any) {
      if (showToast) toast({ variant: "destructive", title: "Error al refrescar", description: error.message });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, mapWebhookStatus]);


  useEffect(() => {
    const loadInstance = async () => {
      if (user) {
        setIsPageLoading(true);
        try {
          const instanceDocRef = doc(db, 'instances', user.uid);
          const instanceDocSnap = await getDoc(instanceDocRef);

          if (instanceDocSnap.exists()) {
            const instanceDataFromDb = instanceDocSnap.data() as WhatsAppInstance;
            setWhatsAppInstance(instanceDataFromDb); // Set local state first
            await fetchAndUpdateInstanceInfo(instanceDataFromDb, false); // Then refresh from API, no toast on initial success
          } else {
            setWhatsAppInstance(null);
          }
        } catch (error) {
          console.error("Error cargando instancia desde Firestore:", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la configuración de la instancia." });
          setWhatsAppInstance(null);
        } finally {
          setIsPageLoading(false);
        }
      } else {
        setIsPageLoading(false); // No user, so not loading
        setWhatsAppInstance(null);
      }
    };
    loadInstance();
  }, [user, toast, fetchAndUpdateInstanceInfo]);


  const form = useForm<AddInstanceFormData>({
    resolver: zodResolver(addInstanceSchema),
    defaultValues: {
      instanceName: "",
      phoneNumber: "",
    },
  });

   useEffect(() => {
    if (user && !form.getValues("instanceName")) { // Only reset if instanceName is not already set (e.g. by user typing)
      form.reset({
        instanceName: user.username || user.fullName || "",
        phoneNumber: "",
      });
    }
  }, [user, form]);


  async function onSubmitAddInstance(values: AddInstanceFormData) {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado." });
      return;
    }
    setIsLoading(true);
    
    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook/evolution';
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook-test/evolution';

    const baseWebhookUrl = useTestWebhook ? testWebhookBase : prodWebhookBase;
    const webhookUrl = `${baseWebhookUrl}?action=create_instance`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: values.instanceName,
          phoneNumber: values.phoneNumber, // Ensure phone number is sent if API needs it
          userId: user.uid, 
        }),
      });

      const responseBodyArray = await response.json();

      if (!response.ok) {
        const errorBody = Array.isArray(responseBodyArray) && responseBodyArray.length > 0 ? responseBodyArray[0] : responseBodyArray;
        const errorMessage = errorBody?.message || errorBody?.error?.message || `Error del servidor: ${response.status}`;
        throw new Error(errorMessage);
      }
      
      if (!Array.isArray(responseBodyArray) || responseBodyArray.length === 0) {
        throw new Error("Respuesta inesperada del webhook al crear la instancia (formato no es array o vacío).");
      }
      const webhookData = responseBodyArray[0];

      if (!webhookData || !webhookData.success || !webhookData.data || !webhookData.data.instance) {
        const errorDetail = webhookData?.data?.message || webhookData?.error?.message || "Datos incompletos.";
        throw new Error(`Respuesta inesperada del webhook al crear la instancia: ${errorDetail}`);
      }

      const instanceData = webhookData.data.instance;
      const hashData = webhookData.data.hash;

      const newInstance: WhatsAppInstance = {
        id: instanceData.instanceId || instanceData.instanceName, 
        name: instanceData.instanceName, 
        phoneNumber: values.phoneNumber, // Store the phone number entered by the user
        status: mapWebhookStatus(instanceData.status), 
        apiKey: hashData || '********************-****-****-************', 
        qrCodeUrl: webhookData.data.qrCodeUrl || instanceData.qrCodeUrl, // Check both locations
        connectionWebhookUrl: webhookData.data.connectionWebhookUrl || instanceData.connectionWebhookUrl,
        _count: { Message: 0, Contact: 0, Chat: 0 }, // Initialize counts
        userId: user.uid,
        userEmail: user.email,
      };
      
      await setDoc(doc(db, 'instances', user.uid), newInstance);
      setWhatsAppInstance(newInstance);

      toast({ title: "Instancia Solicitada", description: "Tu instancia de Qyvoo ha sido solicitada." });
      setIsAddInstanceDialogOpen(false);
      form.reset({ instanceName: user.username || user.fullName || "", phoneNumber: "" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al crear instancia", description: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteInstance = async () => {
    if (!user || !whatsAppInstance) return;
    
    // Confirmation Dialog (optional but recommended)
    const confirmed = window.confirm("¿Estás seguro de que quieres eliminar esta instancia? Esta acción no se puede deshacer.");
    if (!confirmed) return;

    setIsLoading(true);

    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook/evolution';
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL || 'https://n8n.vemontech.com/webhook-test/evolution';
    
    const baseWebhookUrl = useTestWebhook ? testWebhookBase : prodWebhookBase;
    const webhookUrl = `${baseWebhookUrl}?action=delete_instance`;
    
    try {
      const response = await fetch(webhookUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: whatsAppInstance.name, userId: user.uid }) 
      });

      if (!response.ok) {
        // Try to parse error from Qyvoo
        let errorMessage = `Error del servidor Qyvoo: ${response.status}`;
        try {
            const errorBody = await response.json();
            const detailedError = Array.isArray(errorBody) && errorBody.length > 0 ? errorBody[0] : errorBody;
            errorMessage = detailedError?.message || detailedError?.error?.message || errorMessage;
        } catch (e) { /* Ignore parsing error, use status code */ }
        throw new Error(errorMessage);
      }
      // Optional: Check response from Qyvoo if it indicates success explicitly

      await deleteDoc(doc(db, 'instances', user.uid));
      setWhatsAppInstance(null);
      toast({ title: "Instancia Eliminada", description: "La instancia de Qyvoo ha sido eliminada." });
    } catch (error: any)      {
      toast({ variant: "destructive", title: "Error al eliminar", description: `No se pudo eliminar la instancia: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshWrapper = async () => {
    if (!whatsAppInstance) return;
    await fetchAndUpdateInstanceInfo(whatsAppInstance, true);
  }
  
  const copyToClipboard = (text?: string) => {
    if (!text) {
      toast({ variant: "destructive", title: "Error", description: "No hay API Key para copiar." });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copiado", description: "API Key copiada al portapapeles." }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo copiar la API Key." }));
  };

  if (isPageLoading) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando configuración de instancia...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Panel de Configuración Qyvoo</h2>
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
                  <Button onClick={() => setIsAddInstanceDialogOpen(true)} disabled={isLoading}>
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
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Agregar Instancia"}
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
                  <Label htmlFor="qyvooApiKey">Qyvoo API Key (Hash/Token)</Label>
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
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Contactos</p>
                      <p className="text-lg font-semibold">{whatsAppInstance._count?.Contact ?? 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MessageSquareText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mensajes</p>
                      <p className="text-lg font-semibold">{whatsAppInstance._count?.Message ?? 'N/A'}</p>
                    </div>
                  </div>
                   <div className="flex items-center space-x-2">
                    <ListChecks className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Chats</p>
                      <p className="text-lg font-semibold">{whatsAppInstance._count?.Chat ?? 'N/A'}</p>
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
                    whatsAppInstance.status === 'Pendiente' ? 'bg-yellow-400 text-black' : // Adjusted for better contrast
                    'bg-red-500 text-destructive-foreground'
                }>
                  {whatsAppInstance.status}
                </Badge>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={handleRefreshWrapper} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? "Refrescando..." : "Refrescar Estado"}
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteInstance} disabled={isLoading}>
                     {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    {isLoading ? "Eliminando..." : "Eliminar"}
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
            <Label htmlFor="apiKeyGeneral">Clave de API Qyvoo</Label>
            <Input id="apiKeyGeneral" type="password" placeholder="Ingresa tu Clave de API" defaultValue="tuClaveApiQyvooSecreta" />
          </div>
          <Button onClick={() => toast({ title: "Prueba de Conexión", description: "Funcionalidad de prueba pendiente."})}>Probar Conexión</Button>
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
    

    