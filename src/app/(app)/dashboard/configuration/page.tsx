
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback } from 'react';
import { Copy, Eye, EyeOff, MessageSquareText, Settings2, Trash2, Users, PlusCircle, ExternalLink, RefreshCw, ListChecks, Loader2, QrCode, Bot, FlaskConical, Save, HelpCircle, Code2, Link as LinkIcon, Server } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase'; 
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'; 

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const instanceNameRegex = /^[a-zA-Z0-9_.-]+$/;

const addInstanceSchema = z.object({
  instanceName: z.string()
    .min(3, { message: "El nombre de la instancia debe tener al menos 3 caracteres." })
    .regex(instanceNameRegex, { message: "El nombre solo puede contener letras, números y los caracteres . - _" }),
  phoneNumber: z.string().regex(phoneRegex, { message: "Número de teléfono inválido." })
});

type AddInstanceFormData = z.infer<typeof addInstanceSchema>;

type InstanceStatus = 'Conectado' | 'Desconectado' | 'Pendiente';

interface WhatsAppInstanceCount {
  Message: number;
  Contact: number;
  Chat: number;
}

export interface WhatsAppInstance { // Exported for chat page
  id: string; 
  name: string; 
  phoneNumber: string;
  apiKey?: string;
  status: InstanceStatus;
  qrCodeUrl?: string | null; 
  connectionWebhookUrl?: string | null; 
  _count?: WhatsAppInstanceCount;
  userId: string;
  userEmail: string | null;
  chatbotEnabled?: boolean;
  demo?: boolean; // For demo mode
  demoPhoneNumber?: string; // Phone number for demo simulation
}

interface RefreshedInstanceInfo {
  id: string; 
  name: string; 
  connectionStatus: string; 
  token?: string; 
  qrCodeUrl?: string | null;
  connectionWebhookUrl?: string | null;
  _count?: WhatsAppInstanceCount;
}


export default function ConfigurationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddInstanceDialogOpen, setIsAddInstanceDialogOpen] = useState(false);
  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false); 
  const [isPageLoading, setIsPageLoading] = useState(true); 
  const [showApiKey, setShowApiKey] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [qrCodeDataUri, setQrCodeDataUri] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // State for instance settings
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoPhoneNumber, setDemoPhoneNumber] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // A 'manager' manages their own instance using their 'uid'.
  // 'owner', 'admin', 'agent' all operate on the 'ownerId's instance.
  const dataFetchUserId = user?.role === 'manager' ? user?.uid : user?.ownerId;
  
  const handleSaveInstanceSettings = async () => {
      if (!dataFetchUserId || !whatsAppInstance) {
        toast({ variant: "destructive", title: "Error", description: "No se puede guardar la configuración sin una instancia o usuario autenticado." });
        return;
      }
    
      setIsSavingSettings(true);
      const updatedInstance = {
        ...whatsAppInstance,
        chatbotEnabled: chatbotEnabled,
        demo: isDemoMode,
        demoPhoneNumber: isDemoMode ? demoPhoneNumber : '', // Clear phone number if demo mode is off
      };
    
      try {
        await setDoc(doc(db, 'instances', dataFetchUserId), updatedInstance, { merge: true });
        setWhatsAppInstance(updatedInstance); // Update local state
        toast({ title: "Configuración Actualizada", description: "La configuración de la instancia ha sido guardada." });
        // Update local form state from the newly saved instance state
        setChatbotEnabled(updatedInstance.chatbotEnabled ?? true);
        setIsDemoMode(updatedInstance.demo ?? false);
        setDemoPhoneNumber(updatedInstance.demoPhoneNumber ?? '');
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error al actualizar", description: `No se pudo guardar la configuración: ${error.message}` });
      } finally {
        setIsSavingSettings(false);
      }
  };

  const mapWebhookStatus = useCallback((webhookStatus?: string): InstanceStatus => {
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
  }, []);

  const fetchAndUpdateInstanceInfo = useCallback(async (instanceToRefresh: WhatsAppInstance, showToast = true) => {
    if (!dataFetchUserId) {
      if (showToast) toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado." });
      return false;
    }
    setIsLoading(true);

    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL;
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL;
    
    let baseWebhookUrl: string | undefined;

    if (useTestWebhook) {
        baseWebhookUrl = testWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de prueba (NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return false;
        }
    } else {
        baseWebhookUrl = prodWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de producción (NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return false;
        }
    }
    const webhookUrl = `${baseWebhookUrl}?action=get_info_instance`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instanceToRefresh.name, userId: dataFetchUserId }),
      });

      const responseDataArray = await response.json();

      if (!response.ok) {
        const errorBody = Array.isArray(responseDataArray) && responseDataArray.length > 0 ? responseDataArray[0] : responseDataArray;
        const errorMessage = errorBody?.message || errorBody?.error?.message || `Error del servidor Qyvoo: ${response.status}`;
        throw new Error(errorMessage);
      }
      
      if (!Array.isArray(responseDataArray) || responseDataArray.length === 0 || !responseDataArray[0].success || !Array.isArray(responseDataArray[0].data) || responseDataArray[0].data.length === 0) {
        const errorDetail = responseDataArray[0]?.data?.[0]?.message || responseDataArray[0]?.data?.message || responseDataArray[0]?.error || "Formato de datos de instancia incorrecto o no exitoso.";
        
        if (errorDetail.toLowerCase().includes('instance not found') || errorDetail.toLowerCase().includes('not found')) {
          await deleteDoc(doc(db, 'instances', dataFetchUserId));
          setWhatsAppInstance(null);
          if (showToast) toast({ title: "Instancia no encontrada", description: "La instancia fue eliminada de Qyvoo y de tu configuración." });
          setIsLoading(false);
          return false;
        }
        throw new Error(`Respuesta del webhook no fue exitosa o datos de instancia no encontrados: ${errorDetail}`);
      }

      const instanceInfo: RefreshedInstanceInfo = responseDataArray[0].data[0];

      const updatedInstanceData: Partial<WhatsAppInstance> = {
        status: mapWebhookStatus(instanceInfo.connectionStatus), 
        apiKey: instanceInfo.token || instanceToRefresh.apiKey, 
        qrCodeUrl: instanceInfo.qrCodeUrl || null, 
        connectionWebhookUrl: instanceInfo.connectionWebhookUrl || null,
        _count: instanceInfo._count || instanceToRefresh._count || { Message: 0, Contact: 0, Chat: 0 },
      };
      
      const fullyUpdatedInstance = { ...instanceToRefresh, ...updatedInstanceData };
      
      await setDoc(doc(db, 'instances', dataFetchUserId), fullyUpdatedInstance, { merge: true });
      setWhatsAppInstance(fullyUpdatedInstance);
      // Update local settings state after fetch
      setChatbotEnabled(fullyUpdatedInstance.chatbotEnabled ?? true);
      setIsDemoMode(fullyUpdatedInstance.demo ?? false);
      setDemoPhoneNumber(fullyUpdatedInstance.demoPhoneNumber ?? '');

      if (showToast) toast({ title: "Estado Actualizado", description: "El estado de la instancia de Qyvoo ha sido actualizado." });
      setIsLoading(false);
      return true;
    } catch (error: any) {
      if (showToast) toast({ variant: "destructive", title: "Error al refrescar", description: error.message });
      setIsLoading(false);
      return false;
    }
  }, [dataFetchUserId, toast, mapWebhookStatus]);

  useEffect(() => {
    const loadInstance = async () => {
      if (dataFetchUserId) {
        setIsPageLoading(true);
        try {
          const instanceDocRef = doc(db, 'instances', dataFetchUserId);
          const instanceDocSnap = await getDoc(instanceDocRef);

          if (instanceDocSnap.exists()) {
            const instanceDataFromDb = instanceDocSnap.data() as WhatsAppInstance;
            setWhatsAppInstance(instanceDataFromDb);
            // Initialize settings state from DB data
            setChatbotEnabled(instanceDataFromDb.chatbotEnabled ?? true);
            setIsDemoMode(instanceDataFromDb.demo ?? false);
            setDemoPhoneNumber(instanceDataFromDb.demoPhoneNumber ?? '');
            await fetchAndUpdateInstanceInfo(instanceDataFromDb, false); 
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
        setIsPageLoading(false); 
        setWhatsAppInstance(null);
      }
    };
    loadInstance();
  }, [dataFetchUserId, toast, fetchAndUpdateInstanceInfo]);


  const form = useForm<AddInstanceFormData>({
    resolver: zodResolver(addInstanceSchema),
    defaultValues: {
      instanceName: "",
      phoneNumber: "",
    },
  });

   useEffect(() => {
    if (user && !form.getValues("instanceName")) { 
      form.reset({
        instanceName: user.username || user.fullName || "",
        phoneNumber: "",
      });
    }
  }, [user, form]);


  async function onSubmitAddInstance(values: AddInstanceFormData) {
    if (!dataFetchUserId || !user) {
      toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado." });
      return;
    }
    setIsLoading(true);

    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL;
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL;

    let baseWebhookUrl: string | undefined;

    if (useTestWebhook) {
        baseWebhookUrl = testWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de prueba (NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return;
        }
    } else {
        baseWebhookUrl = prodWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de producción (NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return;
        }
    }
    const webhookUrl = `${baseWebhookUrl}?action=create_instance`;

    try {
      const requestBody: any = {
        instanceName: values.instanceName,
        phoneNumber: values.phoneNumber, 
        userId: dataFetchUserId, 
      };
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseBodyArray = await response.json();

      if (!response.ok) {
        const errorBody = Array.isArray(responseBodyArray) && responseBodyArray.length > 0 ? responseBodyArray[0] : responseBodyArray;
        const errorMessage = errorBody?.message || errorBody?.error?.message || `Error del servidor Qyvoo: ${response.status}`;
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
      const qrCodeFromCreate = webhookData.data.qrCodeUrl || instanceData.qrCodeUrl || null;


      const newInstance: WhatsAppInstance = {
        id: instanceData.instanceId || instanceData.instanceName, 
        name: instanceData.instanceName, 
        phoneNumber: values.phoneNumber, 
        status: qrCodeFromCreate ? 'Pendiente' : mapWebhookStatus(instanceData.status), 
        apiKey: hashData || '********************-****-****-************', 
        qrCodeUrl: qrCodeFromCreate || null,
        connectionWebhookUrl: webhookData.data.connectionWebhookUrl || instanceData.connectionWebhookUrl || null,
        _count: { Message: 0, Contact: 0, Chat: 0 }, 
        userId: dataFetchUserId,
        userEmail: user.email,
        chatbotEnabled: true, // Default to true
        demo: false, // Default to false
        demoPhoneNumber: '', // Default to empty
      };
      
      await setDoc(doc(db, 'instances', dataFetchUserId), newInstance);
      setWhatsAppInstance(newInstance);
      
      if (qrCodeFromCreate) {
        setQrCodeDataUri(qrCodeFromCreate);
        setIsQrCodeModalOpen(true);
      }

      toast({ title: "Instancia Solicitada", description: "Tu instancia de Qyvoo ha sido solicitada." });
      setIsAddInstanceDialogOpen(false);
      form.reset({ instanceName: user.username || user.fullName || "", phoneNumber: "" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al crear instancia", description: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteInstanceClick = () => {
    if (!dataFetchUserId || !whatsAppInstance) {
      toast({ variant: "destructive", title: "Error", description: "No hay instancia para eliminar o no estás autenticado." });
      return;
    }
     if (isLoading) return;
    
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteInstance = async () => {
    if (!dataFetchUserId || !whatsAppInstance) return; 

    setIsLoading(true);
    setIsDeleteDialogOpen(false);

    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL;
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL;
    
    let baseWebhookUrl: string | undefined;

    if (useTestWebhook) {
        baseWebhookUrl = testWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de prueba (NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return;
        }
    } else {
        baseWebhookUrl = prodWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de producción (NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return;
        }
    }
    const webhookUrl = `${baseWebhookUrl}?action=delete_instance`;
    
    try {
      console.log("Calling delete_instance webhook:", webhookUrl);
      const response = await fetch(webhookUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: whatsAppInstance.name, userId: dataFetchUserId }) 
      });
      console.log("Webhook response status:", response.status);

      if (!response.ok) {
        let errorMessage = `Error del servidor Qyvoo al eliminar: ${response.status}`;
        try {
            const errorBody = await response.json();
            console.log("Webhook error body:", errorBody);
            const detailedError = Array.isArray(errorBody) && errorBody.length > 0 ? errorBody[0] : errorBody;
            errorMessage = detailedError?.message || detailedError?.error?.message || detailedError?.data?.message || errorMessage;
        } catch (e) { 
          console.warn("No se pudo parsear la respuesta de error del webhook delete_instance:", e);
        }
        
        if (!(errorMessage.toLowerCase().includes('instance not found') || errorMessage.toLowerCase().includes('not found'))) {
          console.error("Error from webhook delete_instance:", errorMessage);
          throw new Error(errorMessage);
        }
        toast({ variant: "default", title: "Aviso", description: "La instancia no se encontró en Qyvoo, se procederá a eliminar de la configuración local." });
      } else {
        console.log("Webhook delete_instance successful or instance not found (which is OK for deletion).");
      }

      console.log("Deleting instance from Firestore for user:", dataFetchUserId);
      await deleteDoc(doc(db, 'instances', dataFetchUserId));
      setWhatsAppInstance(null);
      toast({ title: "Instancia Eliminada", description: "La instancia de Qyvoo ha sido eliminada de tu configuración." });

    } catch (error: any)      {
      console.error("Error in confirmDeleteInstance:", error);
      toast({ variant: "destructive", title: "Error al eliminar", description: `No se pudo eliminar la instancia completamente: ${error.message}` });
    } finally {
      console.log("confirmDeleteInstance finished. Setting isLoading to false.");
      setIsLoading(false);
    }
  };


  const handleConnectInstance = async () => {
    if (!dataFetchUserId || !whatsAppInstance) return;
    setIsLoading(true);

    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL;
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL;

    let baseWebhookUrl: string | undefined;

    if (useTestWebhook) {
        baseWebhookUrl = testWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de prueba (NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return;
        }
    } else {
        baseWebhookUrl = prodWebhookBase;
        if (!baseWebhookUrl) {
            toast({
                variant: "destructive",
                title: "Configuración Incompleta",
                description: "La URL del webhook de producción (NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL) no está configurada.",
            });
            setIsLoading(false);
            return;
        }
    }
    const webhookUrl = `${baseWebhookUrl}?action=connect_instance`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: whatsAppInstance.name, userId: dataFetchUserId }),
      });
      const responseDataArray = await response.json();

      if (!response.ok) {
        const errorBody = Array.isArray(responseDataArray) && responseDataArray.length > 0 ? responseDataArray[0] : responseDataArray;
        const errorMessage = errorBody?.message || errorBody?.error?.message || `Error del servidor Qyvoo: ${response.status}`;
        throw new Error(errorMessage);
      }

      if (!Array.isArray(responseDataArray) || responseDataArray.length === 0 || !responseDataArray[0].success || !responseDataArray[0].data?.base64) {
        const errorDetail = responseDataArray[0]?.data?.message || responseDataArray[0]?.error || "Respuesta del webhook inválida o código QR no encontrado.";
        throw new Error(errorDetail);
      }
      
      const qrBase64 = responseDataArray[0].data.base64;
      setQrCodeDataUri(qrBase64);
      setIsQrCodeModalOpen(true);

      const newInstanceData: Partial<WhatsAppInstance> = {
        qrCodeUrl: qrBase64, 
        status: 'Pendiente',
      };
      
      const instanceToUpdate = { ...(whatsAppInstance || {}), ...newInstanceData } as WhatsAppInstance;
      setWhatsAppInstance(instanceToUpdate); 
      if (whatsAppInstance) { 
         await setDoc(doc(db, 'instances', dataFetchUserId) , instanceToUpdate , { merge: true }); 
      }
      
      toast({ title: "Código QR Generado", description: "Escanea el código QR para conectar tu instancia." });

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al Conectar", description: error.message });
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
      toast({ variant: "destructive", title: "Error", description: "No hay texto para copiar." });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copiado", description: "Texto copiado al portapapeles." }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo copiar el texto." }));
  };
  
  const apiExampleCurl = `curl -X POST ${process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.qyvoo.com'}/api/send-message \\
-H "Content-Type: application/json" \\
-d '{
  "apiKey": "${whatsAppInstance?.apiKey || 'TU_API_KEY'}",
  "number": "528112345678",
  "message": "Hola desde la API de Qyvoo!"
}'`;

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
          Gestiona la conexión de tu instancia de WhatsApp, el chatbot y el acceso a la API.
        </p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Instancia de Qyvoo WhatsApp</CardTitle>
              <CardDescription>Gestiona tu conexión de WhatsApp a través de Qyvoo.</CardDescription>
            </div>
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
                              <Input placeholder="Ej: Mi_Negocio_Principal" {...field} />
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
                              <Input type="tel" placeholder="521234567890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <Button type="submit" disabled={isLoading || form.formState.isSubmitting} className="mt-4 w-full">
                          {isLoading || form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                          {isLoading || form.formState.isSubmitting ? "Agregando..." : "Agregar Instancia"}
                        </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {whatsAppInstance ? (
            <Card className="shadow-none border-dashed">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">{whatsAppInstance.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                {whatsAppInstance.qrCodeUrl && (whatsAppInstance.status === 'Pendiente' || whatsAppInstance.status === 'Desconectado') && (
                  <div className="mt-4 p-4 border rounded-lg bg-accent/10 text-center">
                    <p className="text-sm text-accent-foreground mb-2">Escanea este código QR con WhatsApp en tu teléfono para conectar la instancia.</p>
                    <img src={whatsAppInstance.qrCodeUrl.startsWith('data:image') ? whatsAppInstance.qrCodeUrl : `data:image/png;base64,${whatsAppInstance.qrCodeUrl}`} alt="QR Code para conectar WhatsApp" className="mx-auto mb-2 max-w-xs rounded-lg" data-ai-hint="qr code"/>
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
              <CardFooter className="flex justify-between items-center bg-muted/50 p-4 rounded-b-lg">
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
                  {whatsAppInstance && (whatsAppInstance.status === 'Pendiente' || whatsAppInstance.status === 'Desconectado') && (
                    <Button variant="outline" onClick={handleConnectInstance} disabled={isLoading}>
                      <QrCode className="mr-2 h-4 w-4" />
                      Conectar / Generar QR
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleRefreshWrapper} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading && whatsAppInstance ? 'animate-spin' : ''}`} />
                    {isLoading && whatsAppInstance ? "Refrescando..." : "Refrescar Estado"}
                  </Button>
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                       <Button variant="destructive" onClick={(e) => { e.preventDefault(); handleDeleteInstanceClick();}} disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                         {isLoading ? "Eliminando..." : "Eliminar"}
                       </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Esto eliminará permanentemente tu instancia de Qyvoo
                          y sus datos de nuestros servidores, así como de tu configuración en esta aplicación.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)} disabled={isLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteInstance} disabled={isLoading} className="bg-destructive hover:bg-destructive/90">
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <div className="text-center py-12 rounded-lg border-2 border-dashed">
              <p className="text-muted-foreground">No hay ninguna instancia de Qyvoo WhatsApp configurada.</p>
              <p className="text-sm text-muted-foreground mt-2">Usa el botón "Agregar Instancia" para comenzar.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {whatsAppInstance && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings2 className="mr-2 h-5 w-5 text-primary" />
                Configuración Avanzada
              </CardTitle>
              <CardDescription>
                Gestiona el comportamiento del chatbot y el modo de prueba para esta instancia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="chatbotEnabled"
                  checked={chatbotEnabled}
                  onCheckedChange={setChatbotEnabled}
                  disabled={!whatsAppInstance || isSavingSettings}
                />
                <Label htmlFor="chatbotEnabled" className="flex items-center">
                  <Bot className="mr-2 h-4 w-4" />
                  Activar Chatbot
                </Label>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                   <Switch
                    id="demoMode"
                    checked={isDemoMode}
                    onCheckedChange={setIsDemoMode}
                    disabled={!whatsAppInstance || isSavingSettings}
                  />
                  <Label htmlFor="demoMode" className="flex items-center">
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Activar Modo Demo
                  </Label>
                </div>
                {isDemoMode && (
                  <div className="pl-8 space-y-2">
                    <Label htmlFor="demoPhoneNumber">Número de Teléfono para Simulación</Label>
                    <Input
                      id="demoPhoneNumber"
                      value={demoPhoneNumber}
                      onChange={(e) => setDemoPhoneNumber(e.target.value)}
                      placeholder="Ej: +1234567890"
                      disabled={!whatsAppInstance || isSavingSettings}
                    />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveInstanceSettings} disabled={!whatsAppInstance || isSavingSettings}>
                {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                Guardar Configuración
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="mr-2 h-5 w-5 text-primary"/>
                Acceso a la API para Envíos
              </CardTitle>
              <CardDescription>
                Usa este endpoint y tu API Key para enviar mensajes desde tus propias aplicaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="endpointUrl" className="flex items-center"><LinkIcon className="h-4 w-4 mr-2"/>Endpoint URL (POST)</Label>
                <div className="flex items-center space-x-2">
                  <Input id="endpointUrl" readOnly value={`${process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.qyvoo.com'}/api/send-message`} className="font-mono"/>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.qyvoo.com'}/api/send-message`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qyvooApiKey">Tu API Key</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="qyvooApiKey"
                    type={showApiKey ? "text" : "password"}
                    readOnly
                    value={whatsAppInstance.apiKey || "No disponible"}
                    className="flex-grow font-mono"
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
              <div>
                <Label className="flex items-center"><Code2 className="h-4 w-4 mr-2"/>Ejemplo de Petición (cURL)</Label>
                <div className="mt-2 p-4 rounded-md bg-muted text-sm font-mono relative">
                  <pre className="whitespace-pre-wrap break-all"><code>{apiExampleCurl}</code></pre>
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => copyToClipboard(apiExampleCurl)}>
                    <Copy className="h-4 w-4"/>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isQrCodeModalOpen} onOpenChange={setIsQrCodeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanea el Código QR</DialogTitle>
            <DialogDescription>
              Usa WhatsApp en tu teléfono para escanear este código y conectar tu instancia. El estado se actualizará automáticamente.
            </DialogDescription>
          </DialogHeader>
          {qrCodeDataUri ? (
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={qrCodeDataUri} alt="Código QR de WhatsApp" className="mx-auto max-w-xs" data-ai-hint="qr code" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Generando código QR...</p>
            </div>
          )}
          <DialogFooter className="sm:justify-center">
            <Button type="button" variant="secondary" onClick={() => setIsQrCodeModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
