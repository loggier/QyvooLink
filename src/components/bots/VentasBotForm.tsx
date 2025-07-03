
"use client";

import type { BotData } from '@/app/(app)/dashboard/bots/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Trash2, Bot, Building, Phone, Bell } from 'lucide-react';
import { generateSafeId } from '@/lib/uuid';
import { produce } from 'immer';

interface VentasBotFormProps {
  data: BotData;
  onDataChange: (updatedData: Partial<BotData>) => void;
}

const availableRules = [
  "No devolver respuestas en HTML",
  "No puedes enviar documento ni generar PDF, solo texto",
  "No usar símbolos como ### o #####",
  "Evitar respuestas muy largas",
  "Ser directo y conciso",
];

export default function VentasBotForm({ data, onDataChange }: VentasBotFormProps) {
    const {
        agentRole = "Eres un asistente de ventas virtual para [Nombre de la Empresa]. Tu objetivo principal es entender las necesidades del cliente, ofrecer soluciones basadas en nuestro catálogo de servicios, proporcionar precios y cerrar la venta o agendar una demostración. Debes ser amable, profesional y eficiente.",
        selectedRules = [],
        businessContext = { description: "[Nombre de la Empresa] es una empresa líder en [Industria/Sector] que ofrece soluciones innovadoras para [Tipo de Cliente]. Llevamos [Número] años ayudando a nuestros clientes a alcanzar sus objetivos.", location: "[Ciudad, País]", mission: "Nuestra misión es [Declaración de Misión de la Empresa]." },
        serviceCatalog = [],
        contact = { phone: "+1-234-567-8900", email: "ventas@[dominioempresa].com", website: "https://www.[dominioempresa].com" },
        closingMessage = "¿Te gustaría agendar una llamada para discutir esto más a fondo o prefieres que te envíe una propuesta directamente? También puedes visitar nuestro sitio web para más información.",
        notificationPhoneNumber = "",
        notificationRule = ""
    } = data;

    const handleSimpleChange = (field: keyof BotData, value: any) => {
        onDataChange({ [field]: value });
    };

    const handleNestedChange = (parent: string, field: string, value: any) => {
        const currentParentState = data[parent] || {};
        onDataChange({ [parent]: { ...currentParentState, [field]: value } });
    };

    const handleRuleChange = (rule: string) => {
        const newRules = selectedRules.includes(rule)
          ? selectedRules.filter((r: string) => r !== rule)
          : [...selectedRules, rule];
        onDataChange({ selectedRules: newRules });
    };

    // Service Catalog handlers using Immer for easier nested state updates
    const handleAddCategory = () => {
        const newCatalog = produce(serviceCatalog, (draft: any) => {
            draft.push({ id: generateSafeId(), categoryName: "Nueva Categoría", services: [] });
        });
        onDataChange({ serviceCatalog: newCatalog });
    };

    const handleRemoveCategory = (categoryId: string) => {
        const newCatalog = serviceCatalog.filter((cat: any) => cat.id !== categoryId);
        onDataChange({ serviceCatalog: newCatalog });
    };

    const handleCategoryNameChange = (catIndex: number, newName: string) => {
        const newCatalog = produce(serviceCatalog, (draft: any) => {
            draft[catIndex].categoryName = newName;
        });
        onDataChange({ serviceCatalog: newCatalog });
    };
    
    const handleAddService = (catIndex: number) => {
        const newCatalog = produce(serviceCatalog, (draft: any) => {
            draft[catIndex].services.push({ id: generateSafeId(), name: "", price: "", notes: "" });
        });
        onDataChange({ serviceCatalog: newCatalog });
    };

    const handleRemoveService = (catIndex: number, serviceId: string) => {
        const newCatalog = produce(serviceCatalog, (draft: any) => {
            draft[catIndex].services = draft[catIndex].services.filter((srv: any) => srv.id !== serviceId);
        });
        onDataChange({ serviceCatalog: newCatalog });
    };

    const handleServiceChange = (catIndex: number, srvIndex: number, field: string, value: string) => {
        const newCatalog = produce(serviceCatalog, (draft: any) => {
            draft[catIndex].services[srvIndex][field] = value;
        });
        onDataChange({ serviceCatalog: newCatalog });
    };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary"/>Rol del Agente</CardTitle>
          <CardDescription>Define la personalidad y el objetivo principal de tu asistente de ventas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={agentRole} onChange={(e) => handleSimpleChange('agentRole', e.target.value)} rows={6} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas del Bot</CardTitle>
          <CardDescription>Selecciona las reglas generales que el bot debe seguir en todo momento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableRules.map(rule => (
            <div key={rule} className="flex items-center space-x-2">
              <Checkbox id={`rule-${rule}`} checked={selectedRules.includes(rule)} onCheckedChange={() => handleRuleChange(rule)} />
              <Label htmlFor={`rule-${rule}`} className="font-normal">{rule}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5 text-primary"/>Contexto del Negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bizDesc">Descripción</Label>
            <Textarea id="bizDesc" value={businessContext.description || ''} onChange={(e) => handleNestedChange('businessContext', 'description', e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="bizLocation">Ubicación</Label>
            <Input id="bizLocation" value={businessContext.location || ''} onChange={(e) => handleNestedChange('businessContext', 'location', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bizMission">Misión</Label>
            <Textarea id="bizMission" value={businessContext.mission || ''} onChange={(e) => handleNestedChange('businessContext', 'mission', e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Servicios</CardTitle>
          <CardDescription>Define los servicios que ofrece el bot. Puedes agruparlos por categorías.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {serviceCatalog.map((category: any, catIndex: number) => (
            <div key={category.id} className="p-4 border rounded-md space-y-3 bg-muted/30">
              <div className="flex justify-between items-center mb-2">
                <Input value={category.categoryName} onChange={(e) => handleCategoryNameChange(catIndex, e.target.value)} className="text-lg font-semibold"/>
                <Button variant="destructive" size="icon" onClick={() => handleRemoveCategory(category.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {category.services.map((service: any, srvIndex: number) => (
                <Card key={service.id} className="p-3 bg-background">
                  <div className="space-y-2">
                    <Label>Servicio</Label>
                    <Input value={service.name} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'name', e.target.value)} placeholder="Nombre del servicio"/>
                    <Label>Precio</Label>
                    <Input value={service.price} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'price', e.target.value)} placeholder="Ej: $100"/>
                    <Label>Notas</Label>
                    <Textarea value={service.notes} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'notes', e.target.value)} placeholder="Notas adicionales"/>
                  </div>
                   <Button variant="outline" size="sm" onClick={() => handleRemoveService(catIndex, service.id)} className="mt-2 float-right">
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar Servicio
                  </Button>
                </Card>
              ))}
              <Button variant="outline" onClick={() => handleAddService(catIndex)}><PlusCircle className="h-4 w-4 mr-2"/>Añadir Servicio</Button>
            </div>
          ))}
          <Button onClick={handleAddCategory} className="w-full"><PlusCircle className="h-4 w-4 mr-2"/>Añadir Categoría</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center"><Phone className="mr-2 h-5 w-5 text-primary"/>Datos de Contacto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <Label>Teléfono</Label><Input value={contact.phone || ''} onChange={(e) => handleNestedChange('contact', 'phone', e.target.value)} />
            <Label>Email</Label><Input value={contact.email || ''} onChange={(e) => handleNestedChange('contact', 'email', e.target.value)} />
            <Label>Sitio Web</Label><Input value={contact.website || ''} onChange={(e) => handleNestedChange('contact', 'website', e.target.value)} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Mensaje de Cierre</CardTitle></CardHeader>
        <CardContent>
            <Textarea value={closingMessage} onChange={(e) => handleSimpleChange('closingMessage', e.target.value)} rows={4} />
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" />Notificaciones</CardTitle>
            <CardDescription>Recibe notificaciones en WhatsApp bajo ciertas condiciones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Label>Número de WhatsApp para Notificaciones</Label>
                <Input value={notificationPhoneNumber} onChange={(e) => handleSimpleChange('notificationPhoneNumber', e.target.value)} placeholder="Ej: 528112345678"/>
            </div>
            <div>
                <Label>Regla de Notificación</Label>
                <Textarea value={notificationRule} onChange={(e) => handleSimpleChange('notificationRule', e.target.value)} rows={3} placeholder="Ej: Notificar cuando un cliente solicite hablar con un humano."/>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
