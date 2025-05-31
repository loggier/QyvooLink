
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
import { Loader2, Save, Trash2, PlusCircle, Settings } from 'lucide-react';

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

interface BotConfigData {
  rules: string[];
  agentRole: string;
  businessContext: BusinessContext;
  serviceCatalog: ServiceCategory[];
  contact: BotContactDetails;
  closingMessage: string;
  promptXml?: string;
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
    id: crypto.randomUUID(),
    categoryName: "Servicios de Consultoría",
    services: [
      { id: crypto.randomUUID(), name: "Consultoría Estratégica", price: "$150/hora", notes: "Análisis de negocio, planificación y optimización de procesos." },
      { id: crypto.randomUUID(), name: "Consultoría Tecnológica", price: "$180/hora", notes: "Asesoramiento en infraestructura, software y transformación digital." },
    ],
  },
  {
    id: crypto.randomUUID(),
    categoryName: "Desarrollo de Software",
    services: [
      { id: crypto.randomUUID(), name: "Desarrollo Web a Medida", price: "Desde $5000", notes: "Creación de sitios web y aplicaciones web personalizadas." },
      { id: crypto.randomUUID(), name: "Desarrollo de Apps Móviles", price: "Desde $8000", notes: "Aplicaciones nativas e híbridas para iOS y Android." },
    ],
  },
];
const initialContactDetails: BotContactDetails = {
  phone: "+1-234-567-8900",
  email: "ventas@[dominioempresa].com",
  website: "https://www.[dominioempresa].com",
};
const initialClosingMessage = "¿Te gustaría agendar una llamada para discutir esto más a fondo o prefieres que te envíe una propuesta directamente? También puedes visitar nuestro sitio web para más información.";


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
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCategory[]>(initialServiceCatalog);
  const [contactDetails, setContactDetails] = useState<BotContactDetails>(initialContactDetails);
  const [closingMessage, setClosingMessage] = useState<string>(initialClosingMessage);
  const [generatedXml, setGeneratedXml] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load data from Firestore
  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'qybot', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as BotConfigData;
            setSelectedRules(data.rules || []);
            setAgentRole(data.agentRole || initialAgentRole);
            setBusinessContext(data.businessContext || initialBusinessContext);
            // Ensure loaded catalog has IDs
            const loadedCatalog = (data.serviceCatalog || initialServiceCatalog).map(cat => ({
              ...cat,
              id: cat.id || crypto.randomUUID(),
              services: (cat.services || []).map(srv => ({
                ...srv,
                id: srv.id || crypto.randomUUID()
              }))
            }));
            setServiceCatalog(loadedCatalog);
            setContactDetails(data.contact || initialContactDetails);
            setClosingMessage(data.closingMessage || initialClosingMessage);
            if (data.promptXml) setGeneratedXml(data.promptXml); // Load XML if exists
          } else {
            // Set initial defaults if no data found
            setSelectedRules([]);
            setAgentRole(initialAgentRole);
            setBusinessContext(initialBusinessContext);
            setServiceCatalog(initialServiceCatalog.map(cat => ({...cat, id: cat.id || crypto.randomUUID(), services: cat.services.map(srv => ({...srv, id: srv.id || crypto.randomUUID()})) })));
            setContactDetails(initialContactDetails);
            setClosingMessage(initialClosingMessage);
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
      setIsLoading(false); // No user, stop loading
    }
  }, [user, toast]);

  // Generate XML
  useEffect(() => {
    const generate = () => {
      const xml = `
<prompt>
  <rules>
    ${selectedRules.map(rule => `<rule>${escapeXml(rule)}</rule>`).join('\n    ')}
  </rules>
  <agentRole>${escapeXml(agentRole)}</agentRole>
  <businessContext>
    <description>${escapeXml(businessContext.description)}</description>
    <location>${escapeXml(businessContext.location)}</location>
    <mission>${escapeXml(businessContext.mission)}</mission>
  </businessContext>
  <serviceCatalog>
    ${serviceCatalog.map(category => `
    <category name="${escapeXml(category.categoryName)}">
      ${category.services.map(service => `
      <service>
        <name>${escapeXml(service.name)}</name>
        <price>${escapeXml(service.price)}</price>
        <notes>${escapeXml(service.notes)}</notes>
      </service>`).join('\n      ')}
    </category>`).join('\n    ')}
  </serviceCatalog>
  <contact>
    <phone>${escapeXml(contactDetails.phone)}</phone>
    <email>${escapeXml(contactDetails.email)}</email>
    <website>${escapeXml(contactDetails.website)}</website>
  </contact>
  <closingMessage>${escapeXml(closingMessage)}</closingMessage>
</prompt>
      `.trim();
      setGeneratedXml(xml);
    };
    if (!isLoading) { // Only generate if not loading initial data
        generate();
    }
  }, [selectedRules, agentRole, businessContext, serviceCatalog, contactDetails, closingMessage, isLoading]);

  const handleRuleChange = (rule: string) => {
    setSelectedRules(prev =>
      prev.includes(rule) ? prev.filter(r => r !== rule) : [...prev, rule]
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
          ? { ...cat, services: [...cat.services, { id: crypto.randomUUID(), name: "", price: "", notes: "" }] }
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
    try {
      const configToSave: BotConfigData = {
        rules: selectedRules,
        agentRole,
        businessContext,
        serviceCatalog,
        contact: contactDetails,
        closingMessage,
        promptXml: generatedXml,
      };
      await setDoc(doc(db, 'qybot', user.uid), configToSave);
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
      <h1 className="text-3xl font-bold text-foreground">Configurar Bot de Ventas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Configuration Form */}
        <ScrollArea className="h-auto md:h-[calc(100vh-12rem)] pr-4">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reglas del Bot</CardTitle>
              <CardDescription>Selecciona las reglas que el bot debe seguir.</CardDescription>
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
              <CardDescription>Información sobre tu empresa.</CardDescription>
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
              <CardDescription>Define los servicios que ofrece el bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {serviceCatalog.map((category, catIndex) => (
                <div key={category.id || catIndex} className="p-4 border rounded-md space-y-3 bg-muted/30">
                  <h3 className="text-lg font-semibold text-foreground">{category.categoryName}</h3>
                  {category.services.map((service, srvIndex) => (
                    <Card key={service.id || srvIndex} className="p-3 bg-background shadow-sm">
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
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveService(catIndex, service.id)} className="mt-2 float-right">
                        <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                      </Button>
                    </Card>
                  ))}
                  <Button variant="outline" onClick={() => handleAddService(catIndex)}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Añadir Servicio a {category.categoryName}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos de Contacto</CardTitle>
              <CardDescription>Información de contacto que el bot puede proporcionar.</CardDescription>
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

        {/* Right Column: XML Preview and Save Button */}
        <div className="space-y-6 sticky top-4 md:h-[calc(100vh-4rem)] flex flex-col">
          <Card className="flex-grow flex flex-col">
            <CardHeader>
              <CardTitle>Vista Previa del Prompt XML</CardTitle>
              <CardDescription>Este es el XML que se generará basado en tu configuración.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
              <ScrollArea className="h-full max-h-[calc(100vh-20rem)] md:max-h-full w-full border rounded-md p-2 bg-muted/50">
                <pre className="text-sm whitespace-pre-wrap break-all text-foreground">
                  <code>{generatedXml}</code>
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
          <Button onClick={handleSave} disabled={isSaving || !user} size="lg" className="w-full">
            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {isSaving ? "Guardando..." : "Guardar Configuración del Bot"}
          </Button>
        </div>
      </div>
    </div>
  );
}
