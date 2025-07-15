
"use client";

import { useState } from 'react';
import type { BotData } from '@/app/(app)/dashboard/bots/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Building, Phone, Bell, BookOpen } from 'lucide-react';
import DriveLinksForm from './shared/DriveLinksForm';
import { CatalogManager } from './shared/CatalogManager';

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
    
    const [isCatalogManagerOpen, setIsCatalogManagerOpen] = useState(false);

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
    
    const catalogSummary = () => {
        const numCategories = serviceCatalog.length;
        const numServices = serviceCatalog.reduce((acc: number, cat: any) => acc + (cat.services?.length || 0), 0);
        if (numCategories === 0 && numServices === 0) {
            return "No se ha configurado ningún servicio.";
        }
        return `${numCategories} categorías, ${numServices} servicios definidos.`;
    };

  return (
    <>
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
        <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground mb-4">{catalogSummary()}</p>
            <Button type="button" variant="outline" onClick={() => setIsCatalogManagerOpen(true)}>
                <BookOpen className="mr-2 h-4 w-4" />
                Gestionar Catálogo de Servicios
            </Button>
        </CardContent>
      </Card>
      
      <DriveLinksForm data={data} onDataChange={onDataChange} />

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
    
    <CatalogManager 
        isOpen={isCatalogManagerOpen}
        onOpenChange={setIsCatalogManagerOpen}
        serviceCatalog={serviceCatalog}
        onUpdate={(newCatalog) => onDataChange({ serviceCatalog: newCatalog })}
    />
    </>
  );
}
