
"use client";

import type { BotData } from '@/app/(app)/dashboard/bots/page';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Building, BookOpen, Share2 } from 'lucide-react';
import DriveLinksForm from './shared/DriveLinksForm';

interface AtencionClienteBotFormProps {
  data: BotData;
  onDataChange: (updatedData: Partial<BotData>) => void;
}

export default function AtencionClienteBotForm({ data, onDataChange }: AtencionClienteBotFormProps) {
    const {
        agentRole = "Eres un agente de servicio al cliente para [Nombre de la Empresa]. Tu objetivo es responder preguntas frecuentes, ayudar a los clientes con sus consultas generales y dirigirlos al departamento correcto si es necesario. Debes ser paciente, empático y muy resolutivo.",
        companyInfo = { name: "", supportHours: "" },
        knowledgeBase = "",
        escalationPolicy = "Si el cliente muestra frustración o su problema requiere acceso a información privada de su cuenta, indica que transferirás la conversación a un agente especializado."
    } = data;

    const handleFieldChange = (field: keyof BotData, value: string) => {
        onDataChange({ [field]: value });
    };

    const handleNestedChange = (parent: string, field: string, value: string) => {
        const currentParentState = data[parent] || {};
        onDataChange({ [parent]: { ...currentParentState, [field]: value } });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary"/>Rol del Agente de Atención al Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea value={agentRole} onChange={(e) => handleFieldChange('agentRole', e.target.value)} rows={5} />
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5 text-primary"/>Información de la Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="companyName">Nombre de la Empresa</Label>
                        <Input id="companyName" value={companyInfo.name || ''} onChange={(e) => handleNestedChange('companyInfo', 'name', e.target.value)} placeholder="Ej: Mi Empresa S.A."/>
                    </div>
                    <div>
                        <Label htmlFor="supportHours">Horario de Atención</Label>
                        <Input id="supportHours" value={companyInfo.supportHours || ''} onChange={(e) => handleNestedChange('companyInfo', 'supportHours', e.target.value)} placeholder="Ej: Lunes a Viernes de 9am a 6pm"/>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><BookOpen className="mr-2 h-5 w-5 text-primary"/>Base de Conocimiento (FAQs)</CardTitle>
                    <CardDescription>Proporciona una lista de preguntas y respuestas frecuentes. Usa una línea para la pregunta y la siguiente para la respuesta.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        value={knowledgeBase} 
                        onChange={(e) => handleFieldChange('knowledgeBase', e.target.value)} 
                        rows={10} 
                        placeholder="Ej:\nPregunta: ¿Cuáles son sus métodos de pago?\nRespuesta: Aceptamos tarjetas de crédito, débito y transferencias.\n\nPregunta: ¿Dónde están ubicados?\nRespuesta: Nuestra oficina principal está en [Tu Dirección]." 
                    />
                </CardContent>
            </Card>

            <DriveLinksForm data={data} onDataChange={onDataChange} />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Share2 className="mr-2 h-5 w-5 text-primary"/>Política de Escalación</CardTitle>
                    <CardDescription>Define las instrucciones para el bot sobre cuándo transferir la conversación a un agente humano.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea value={escalationPolicy} onChange={(e) => handleFieldChange('escalationPolicy', e.target.value)} rows={4} />
                </CardContent>
            </Card>
        </div>
    );
}
