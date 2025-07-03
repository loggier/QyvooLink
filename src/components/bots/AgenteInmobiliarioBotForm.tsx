
"use client";

import type { BotData } from '@/app/(app)/dashboard/bots/page';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, User, Home, Calendar } from 'lucide-react';

interface AgenteInmobiliarioBotFormProps {
  data: BotData;
  onDataChange: (updatedData: Partial<BotData>) => void;
}

export default function AgenteInmobiliarioBotForm({ data, onDataChange }: AgenteInmobiliarioBotFormProps) {
    const {
        agentRole = "Eres un agente inmobiliario experto para [Nombre de la Inmobiliaria]. Tu objetivo es captar el interés de potenciales clientes, proporcionar información sobre tipos de propiedades y agendar visitas. Debes ser profesional, persuasivo y conocedor del mercado.",
        agentInfo = { name: "", license: "" },
        propertyTypes = "Casas en la ciudad, Apartamentos con vista al mar, Terrenos residenciales.",
        viewingInstructions = "Para agendar una visita, solicita el nombre completo del cliente, su número de teléfono y 2 o 3 opciones de horario en que le gustaría visitar la propiedad. Confirma que un agente se pondrá en contacto para finalizar la cita."
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
                    <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary"/>Rol del Agente Inmobiliario</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea value={agentRole} onChange={(e) => handleFieldChange('agentRole', e.target.value)} rows={5} />
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><User className="mr-2 h-5 w-5 text-primary"/>Información del Agente/Inmobiliaria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="agentName">Nombre del Agente o Inmobiliaria</Label>
                        <Input id="agentName" value={agentInfo.name} onChange={(e) => handleNestedChange('agentInfo', 'name', e.target.value)} placeholder="Ej: Juan Pérez o Inmobiliaria XYZ"/>
                    </div>
                    <div>
                        <Label htmlFor="agentLicense">Licencia (Opcional)</Label>
                        <Input id="agentLicense" value={agentInfo.license} onChange={(e) => handleNestedChange('agentInfo', 'license', e.target.value)} placeholder="Ej: Matrícula 12345"/>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Home className="mr-2 h-5 w-5 text-primary"/>Tipos de Propiedades</CardTitle>
                    <CardDescription>Describe en términos generales los tipos de propiedades que manejas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        value={propertyTypes} 
                        onChange={(e) => handleFieldChange('propertyTypes', e.target.value)} 
                        rows={5} 
                        placeholder="Ej: Apartamentos de 2 y 3 recámaras en zona centro, Casas con alberca en las afueras, Lotes comerciales en avenidas principales." 
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Calendar className="mr-2 h-5 w-5 text-primary"/>Instrucciones para Agendar Visitas</CardTitle>
                    <CardDescription>Define qué información debe solicitar el bot para agendar una visita a una propiedad.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea value={viewingInstructions} onChange={(e) => handleFieldChange('viewingInstructions', e.target.value)} rows={5} />
                </CardContent>
            </Card>
        </div>
    );
}
