"use client";
import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, PlusCircle, Settings, Trash, Bell } from 'lucide-react';
import { generateSafeId } from '@/lib/uuid';

// Types for Bot Configuration
interface Service {
  id: string;
  name: string;
  price: string;
  notes: string;
}

interface ServiceCategory {
  id: string;
  categoryName: string;
  services: Service[];
}

interface BusinessContext {
  description: string;
  location: string;
  mission: string;
}

interface BotContactDetails {
  phone: string;
  email: string;
  website: string;
}

export interface BotConfigData {
  rules: string[];
  agentRole: string;
  businessContext: BusinessContext;
  serviceCatalog: ServiceCategory[];
  contact: BotContactDetails;
  closingMessage: string;
  promptXml?: string;
  instanceIdAssociated?: string;
  notificationPhoneNumber?: string;
  notificationRule?: string;
}

const availableRules: string[] = [
  "No devolver respuestas en HTML",
  "No puedes enviar documento ni generar PDF, solo texto",
  "No usar símbolos como ### o #####",
  "Evitar respuestas muy largas",
  "Ser directo y conciso",
];

const initialAgentRole = "Eres un asistente de ventas virtual para [Nombre de la Empresa]. Tu objetivo principal es entender las necesidades del cliente, ofrecer soluciones basadas en nuestro catálogo de servicios, proporcionar precios y cerrar la venta o agendar una demostración. Debes ser amable, profesional y eficiente.";
const initialBusinessContext: BusinessContext = {
  description: "[Nombre de la Empresa] es una empresa líder en [Industria/Sector] que ofrece soluciones innovadoras para [Tipo de Cliente]. Llevamos [Número] años ayudando a nuestros clientes a alcanzar sus objetivos.",
  location: "[Ciudad, País]",
  mission: "Nuestra misión es [Declaración de Misión de la Empresa].",
};
const initialServiceCatalog: ServiceCategory[] = [ 
  {
    id:generateSafeId(), 
    categoryName: "Servicios de Consultoría",
    services: [
      { id: generateSafeId(), name: "Consultoría Estratégica", price: "$150/hora", notes: "Análisis de negocio, planificación y optimización de procesos." },
      { id: generateSafeId(), name: "Consultoría Tecnológica", price: "$180/hora", notes: "Asesoramiento en infraestructura, software y transformación digital." },
    ],
  },
];
const initialContactDetails: BotContactDetails = {
  phone: "+1-234-567-8900",
  email: "ventas@[dominioempresa].com",
  website: "https://www.[dominioempresa].com",
};
const initialClosingMessage = "¿Te gustaría agendar una llamada para discutir esto más a fondo o prefieres que te envíe una propuesta directamente? También puedes visitar nuestro sitio web para más información.";
const initialNotificationPhoneNumber = "";
const initialNotificationRule = "";


function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&"']/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

export default function BotConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [agentRole, setAgentRole] = useState<string>(initialAgentRole);
  const [businessContext, setBusinessContext] = useState<BusinessContext>(initialBusinessContext);
  // Inicializamos serviceCatalog con un array vacío, pero lo poblamos con initialServiceCatalog si no hay datos de Firebase
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCategory[]>([]); 
  const [contactDetails, setContactDetails] = useState<BotContactDetails>(initialContactDetails);
  const [closingMessage, setClosingMessage] = useState<string>(initialClosingMessage);
  const [notificationPhoneNumber, setNotificationPhoneNumber] = useState<string>(initialNotificationPhoneNumber);
  const [notificationRule, setNotificationRule] = useState<string>(initialNotificationRule);
  const [generatedPromptConfig, setGeneratedPromptConfig] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'qybot', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as BotConfigData;
            // Aseguramos que los arrays y strings tengan valores por defecto seguros
            setSelectedRules(data.rules || []);
            setAgentRole(data.agentRole || initialAgentRole);
            setBusinessContext(data.businessContext || initialBusinessContext);
            
            // --- CAMBIO CLAVE AQUÍ: Aseguramos que las propiedades de serviceCatalog sean strings ---
            const loadedCatalog = (data.serviceCatalog || []).map(cat => ({ 
              id: cat.id || generateSafeId(),
              categoryName: cat.categoryName || "", // Asegura que categoryName sea string
              services: (cat.services || []).map(srv => ({
                id: srv.id || generateSafeId(),
                name: srv.name || "",   // Asegura que name sea string
                price: srv.price || "", // Asegura que price sea string
                notes: srv.notes || "", // Asegura que notes sea string
              })),
            }));
            setServiceCatalog(loadedCatalog);
            // -------------------------------------------------------------------------------------

            setContactDetails(data.contact || initialContactDetails);
            setClosingMessage(data.closingMessage || initialClosingMessage);
            setNotificationPhoneNumber(data.notificationPhoneNumber || initialNotificationPhoneNumber);
            setNotificationRule(data.notificationRule || initialNotificationRule);
            if (data.promptXml) setGeneratedPromptConfig(data.promptXml);
          } else {
            // Si el documento no existe, inicializa con los valores por defecto definidos
            setSelectedRules([]);
            setAgentRole(initialAgentRole);
            setBusinessContext(initialBusinessContext);
            setServiceCatalog(initialServiceCatalog); // Utiliza el initialServiceCatalog si no hay datos
            setContactDetails(initialContactDetails);
            setClosingMessage(initialClosingMessage);
            setNotificationPhoneNumber(initialNotificationPhoneNumber);
            setNotificationRule(initialNotificationRule);
          }
        } catch (error) {
          console.error("Error loading bot configuration:", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la configuración del bot." });
        } finally {
          setIsLoading(false);
        }
      };
      loadData();
    } else {
      setIsLoading(false); 
    }
  }, [user, toast]);

  // Este useEffect se encarga de generar el XML cuando los datos estén listos
  useEffect(() => {
    const generate = () => {
      // --- CAMBIOS EN LA FUNCIÓN GENERATE PARA MAYOR ROBUSTEZ ---
      // Aseguramos que las propiedades de businessContext sean strings antes de trim()
      const safeBusinessContextDescription = businessContext.description || "";
      const safeBusinessContextLocation = businessContext.location || "";
      const safeBusinessContextMission = businessContext.mission || "";

      const businessContextIsEmpty = !safeBusinessContextDescription.trim() && 
                                     !safeBusinessContextLocation.trim() && 
                                     !safeBusinessContextMission.trim();

      // Aseguramos que las propiedades de contactDetails sean strings antes de trim()
      const safeContactPhone = contactDetails.phone || "";
      const safeContactEmail = contactDetails.email || "";
      const safeContactWebsite = contactDetails.website || "";

      const contactDetailsIsEmpty = !safeContactPhone.trim() && 
                                    !safeContactEmail.trim() && 
                                    !safeContactWebsite.trim();
      
      // Filtramos categorías para asegurar que sean válidas y tengan al menos un nombre o servicio
      const activeCategories = serviceCatalog.filter(
        category => category && (category.categoryName?.trim() !== "" || (category.services && category.services.length > 0))
      );
      const serviceCatalogIsEmpty = activeCategories.length === 0;

      // Aseguramos que las reglas seleccionadas y la de notificación sean strings
      const safeSelectedRules = selectedRules.filter(rule => typeof rule === 'string');
      const safeNotificationRule = notificationRule || ""; // Valor por defecto para notificationRule

      let allRulesForConfig = [...safeSelectedRules];
      if (safeNotificationRule.trim()) {
        allRulesForConfig.push(safeNotificationRule.trim());
      }

      let rulesConfig = '';
      if (allRulesForConfig.length > 0) {
        rulesConfig = `
  <rules>
    ${allRulesForConfig.map(rule => `<rule>${escapeXml(rule)}</rule>`).join('\n    ')}
  </rules>`;
      }

      let businessContextConfig = '';
      if (!businessContextIsEmpty) {
        businessContextConfig = `
  <businessContext>
    <description>${escapeXml(safeBusinessContextDescription)}</description>
    <location>${escapeXml(safeBusinessContextLocation)}</location>
    <mission>${escapeXml(safeBusinessContextMission)}</mission>
  </businessContext>`;
      }

      let serviceCatalogConfigSection = '';
      if (!serviceCatalogIsEmpty) {
        serviceCatalogConfigSection = `
  <serviceCatalog>
    ${activeCategories.map(category => {
      // Aseguramos que el nombre de la categoría sea una cadena válida
      const categoryNameForXml = category.categoryName || ''; 
      // Filtramos servicios nulos/undefined y mapeamos sus propiedades a strings
      const servicesForXml = (category.services || []).filter(srv => srv).map(service => { 
          const serviceNameForXml = service.name || '';
          const servicePriceForXml = service.price || '';
          const serviceNotesForXml = service.notes || '';
          return `
      <service>
        <name>${escapeXml(serviceNameForXml)}</name>
        <price>${escapeXml(servicePriceForXml)}</price>
        <notes>${escapeXml(serviceNotesForXml)}</notes>
      </service>`;
      }).join('\n      ');
      return `
    <category name="${escapeXml(categoryNameForXml)}">
      ${servicesForXml}
    </category>`;
    }).join('\n    ')}
  </serviceCatalog>`;
      }

      let contactConfig = '';
      if (!contactDetailsIsEmpty) {
        contactConfig = `
  <contact>
    <phone>${escapeXml(safeContactPhone)}</phone>
    <email>${escapeXml(safeContactEmail)}</email>
    <website>${escapeXml(safeContactWebsite)}</website>
  </contact>`;
      }
      
      let notificationConfig = '';
      const safeNotificationPhoneNumber = notificationPhoneNumber || ""; // Valor por defecto
      if (safeNotificationPhoneNumber.trim()) {
        notificationConfig = `
  <notification>${escapeXml(safeNotificationPhoneNumber.trim())}</notification>`;
      }

      const safeAgentRole = agentRole || ""; // Asegura que agentRole sea string
      const safeClosingMessage = closingMessage || ""; // Asegura que closingMessage sea string

      const finalPromptConfig = `
${rulesConfig.trim() ? rulesConfig.trim() : ''}
${safeAgentRole.trim() ? `<agentRole>${escapeXml(safeAgentRole)}</agentRole>` : ''}
${businessContextConfig.trim() ? businessContextConfig.trim() : ''}
${serviceCatalogConfigSection.trim() ? serviceCatalogConfigSection.trim() : ''}
${contactConfig.trim() ? contactConfig.trim() : ''}
${safeClosingMessage.trim() ? `<closingMessage>${escapeXml(safeClosingMessage)}</closingMessage>` : ''}
${notificationConfig.trim() ? notificationConfig.trim() : ''}
      `.trim().replace(/^\s*\n/gm, ""); 
      setGeneratedPromptConfig(finalPromptConfig);
    };
    // Solo generamos el prompt si los datos ya se cargaron (isLoading es false)
    if (!isLoading) { 
        generate();
    }
  }, [selectedRules, agentRole, businessContext, serviceCatalog, contactDetails, closingMessage, notificationPhoneNumber, notificationRule, isLoading]); // Dependencias

  const handleRuleChange = (rule: string) => {
    setSelectedRules(prev =>
      prev.includes(rule) ? prev.filter(r => r !== rule) : [...prev, rule]
    );
  };

  const handleAddCategory = () => {
    setServiceCatalog(prev => [
      ...prev,
      { id: generateSafeId(), categoryName: "Nueva Categoría", services: [] }
    ]);
  };

  const handleRemoveCategory = (categoryId: string) => {
    setServiceCatalog(prev => prev.filter(cat => cat.id !== categoryId));
  };

  const handleCategoryNameChange = (categoryIndex: number, newName: string) => {
    setServiceCatalog(prev => 
      prev.map((cat, idx) => 
        idx === categoryIndex ? { ...cat, categoryName: newName } : cat
      )
    );
  };

  const handleServiceChange = (categoryIndex: number, serviceIndex: number, field: keyof Service, value: string) => {
    setServiceCatalog(prev =>
      prev.map((cat, cIdx) =>
        cIdx === categoryIndex
          ? {
              ...cat,
              services: cat.services.map((srv, sIdx) =>
                sIdx === serviceIndex ? { ...srv, [field]: value } : srv
              ),
            }
          : cat
      )
    );
  };

  const handleAddService = (categoryIndex: number) => {
    setServiceCatalog(prev =>
      prev.map((cat, cIdx) =>
        cIdx === categoryIndex
          ? { ...cat, services: [...cat.services, { id: generateSafeId(), name: "", price: "", notes: "" }] }
          : cat
      )
    );
  };

  const handleRemoveService = (categoryIndex: number, serviceId: string) => {
    setServiceCatalog(prev =>
      prev.map((cat, cIdx) =>
        cIdx === categoryIndex
          ? { ...cat, services: cat.services.filter(srv => srv.id !== serviceId) }
          : cat
      )
    );
  };

  const handleSave = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado para guardar." });
      return;
    }
    setIsSaving(true);
    let instanceIdAssociated: string | undefined = undefined;
    try {
        const instanceDocRef = doc(db, 'instances', user.uid);
        const instanceDocSnap = await getDoc(instanceDocRef);
        if (instanceDocSnap.exists()) {
            const instanceData = instanceDocSnap.data();
            if (instanceData && instanceData.id) {
                instanceIdAssociated = instanceData.id;
            } else {
                console.warn("Instance data found but 'id' field is missing or undefined.");
            }
        } else {
            console.warn("Instance document not found for user:", user.uid);
        }
    } catch (error) {
        console.error("Error fetching instance ID for bot config:", error);
    }

    try {
      const configToSave: BotConfigData = {
        rules: selectedRules,
        agentRole,
        businessContext,
        serviceCatalog,
        contact: contactDetails,
        closingMessage,
        promptXml: generatedPromptConfig, // This field name in Firestore remains promptXml
        instanceIdAssociated,
        notificationPhoneNumber,
        notificationRule,
      };
      await setDoc(doc(db, 'qybot', user.uid), configToSave, { merge: true });
      toast({ title: "Éxito", description: "Configuración del bot guardada correctamente." });
    } catch (error) {
      console.error("Error saving bot configuration:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la configuración del bot." });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleTextAreaChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setter(e.target.value);
  };

  const handleBusinessContextChange = (field: keyof BusinessContext, value: string) => {
    setBusinessContext(prev => ({ ...prev, [field]: value }));
  };

  const handleContactDetailsChange = (field: keyof BotContactDetails, value: string) => {
    setContactDetails(prev => ({ ...prev, [field]: value }));
  };


  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-bold text-foreground">Configurar Prompt del Bot</h1>
      
      <div className="space-y-6">
        <ScrollArea className="h-auto pr-4">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reglas del Bot</CardTitle>
              <CardDescription>Selecciona las reglas generales que el bot debe seguir. La regla de notificación se añadirá aquí si se define.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableRules.map(rule => (
                <div key={rule} className="flex items-center space-x-2">
                  <Checkbox
                    id={`rule-${rule.replace(/\s+/g, '-')}`}
                    checked={selectedRules.includes(rule)}
                    onCheckedChange={() => handleRuleChange(rule)}
                  />
                  <Label htmlFor={`rule-${rule.replace(/\s+/g, '-')}`}>{rule}</Label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rol del Agente</CardTitle>
              <CardDescription>Define la personalidad y el objetivo del agente de ventas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={agentRole}
                onChange={handleTextAreaChange(setAgentRole)}
                rows={5}
                placeholder="Ej: Eres un asistente de ventas amigable..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contexto del Negocio</CardTitle>
              <CardDescription>Información sobre tu empresa. Se omitirá de la configuración del prompt si todos los campos están vacíos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bizDesc">Descripción</Label>
                <Textarea id="bizDesc" value={businessContext.description} onChange={(e) => handleBusinessContextChange('description', e.target.value)} rows={3} placeholder="Ej: Somos una empresa que vende..." />
              </div>
              <div>
                <Label htmlFor="bizLocation">Ubicación</Label>
                <Input id="bizLocation" value={businessContext.location} onChange={(e) => handleBusinessContextChange('location', e.target.value)} placeholder="Ej: Ciudad, País" />
              </div>
              <div>
                <Label htmlFor="bizMission">Misión</Label>
                <Textarea id="bizMission" value={businessContext.mission} onChange={(e) => handleBusinessContextChange('mission', e.target.value)} rows={3} placeholder="Ej: Nuestra misión es ayudar a..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Servicios</CardTitle>
              <CardDescription>Define los servicios que ofrece el bot. Se omitirá de la configuración del prompt si no hay categorías o servicios definidos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {serviceCatalog.map((category, catIndex) => (
                <div key={category.id} className="p-4 border rounded-md space-y-3 bg-muted/30">
                  <div className="flex justify-between items-center mb-2">
                    <Input 
                      value={category.categoryName}
                      onChange={(e) => handleCategoryNameChange(catIndex, e.target.value)}
                      placeholder="Nombre de la Categoría"
                      className="text-lg font-semibold text-foreground flex-grow mr-2"
                    />
                    <Button variant="destructive" size="icon" onClick={() => handleRemoveCategory(category.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  {category.services.map((service, srvIndex) => (
                    <Card key={service.id} className="p-3 bg-background shadow-sm">
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor={`srvName-${catIndex}-${srvIndex}`}>Nombre del Servicio</Label>
                          <Input id={`srvName-${catIndex}-${srvIndex}`} value={service.name} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'name', e.target.value)} placeholder="Nombre del servicio" />
                        </div>
                        <div>
                          <Label htmlFor={`srvPrice-${catIndex}-${srvIndex}`}>Precio</Label>
                          <Input id={`srvPrice-${catIndex}-${srvIndex}`} value={service.price} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'price', e.target.value)} placeholder="Ej: $100 o Desde $50" />
                        </div>
                        <div>
                          <Label htmlFor={`srvNotes-${catIndex}-${srvIndex}`}>Notas Adicionales</Label>
                          <Textarea id={`srvNotes-${catIndex}-${srvIndex}`} value={service.notes} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'notes', e.target.value)} rows={2} placeholder="Descripción breve o detalles" />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveService(catIndex, service.id)} className="mt-2 float-right">
                        <Trash2 className="h-4 w-4 mr-1" /> Eliminar Servicio
                      </Button>
                    </Card>
                  ))}
                  <Button variant="outline" onClick={() => handleAddService(catIndex)} className="mt-2">
                    <PlusCircle className="h-4 w-4 mr-2" /> Añadir Servicio a {category.categoryName || "esta categoría"}
                  </Button>
                </div>
              ))}
              <Button variant="default" onClick={handleAddCategory} className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Añadir Nueva Categoría de Servicios
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos de Contacto</CardTitle>
              <CardDescription>Información de contacto que el bot puede proporcionar. Se omitirá de la configuración del prompt si todos los campos están vacíos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contactPhone">Teléfono</Label>
                <Input id="contactPhone" value={contactDetails.phone} onChange={(e) => handleContactDetailsChange('phone', e.target.value)} placeholder="Ej: +1 555 1234" />
              </div>
              <div>
                <Label htmlFor="contactEmail">Email</Label>
                <Input id="contactEmail" type="email" value={contactDetails.email} onChange={(e) => handleContactDetailsChange('email', e.target.value)} placeholder="Ej: ventas@empresa.com" />
              </div>
              <div>
                <Label htmlFor="contactWebsite">Sitio Web</Label>
                <Input id="contactWebsite" value={contactDetails.website} onChange={(e) => handleContactDetailsChange('website', e.target.value)} placeholder="Ej: https://www.empresa.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5 text-primary" />
                Notificación
              </CardTitle>
              <CardDescription>Configura las notificaciones que el bot puede enviar. La regla se añadirá a las reglas generales del bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="notificationPhone">Número de WhatsApp para Notificaciones</Label>
                <Input 
                  id="notificationPhone" 
                  value={notificationPhoneNumber} 
                  onChange={handleTextAreaChange(setNotificationPhoneNumber)} 
                  placeholder="Ej: 528112345678 (solo dígitos, con código de país)" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresa el número completo sin espacios ni símbolos. Si se deja vacío, no se incluirá la información de notificación en el prompt del bot.
                </p>
              </div>
              <div>
                <Label htmlFor="notificationRule">Regla de Notificación</Label>
                <Textarea 
                  id="notificationRule" 
                  value={notificationRule} 
                  onChange={handleTextAreaChange(setNotificationRule)} 
                  rows={3} 
                  placeholder="Ej: Notificar cuando un cliente solicite hablar con un humano." 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Describe la condición bajo la cual el bot debe activar una notificación. Esta regla se agregará a la sección de reglas del prompt del bot. Si se deja vacía, no se añadirá.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensaje de Cierre</CardTitle>
              <CardDescription>La llamada a la acción final del bot.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={closingMessage}
                onChange={handleTextAreaChange(setClosingMessage)}
                rows={4}
                placeholder="Ej: ¿Te gustaría agendar una llamada?"
              />
            </CardContent>
          </Card>
        </div>
        </ScrollArea>

        <div className="flex justify-end pt-6">
          <Button onClick={handleSave} disabled={isSaving || !user} size="lg" className="w-full sm:w-auto">
            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {isSaving ? "Guardando..." : "Guardar Configuración del Bot"}
          </Button>
        </div>
      </div>
    </div>
  );
}