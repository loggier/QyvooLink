
"use client";

import type { BotData } from '@/app/(app)/dashboard/bots/page';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Wrench, BookOpen, Share2 } from 'lucide-react';
import DriveLinksForm from './shared/DriveLinksForm';

interface SoporteTecnicoBotFormProps {
  data: BotData;
  onDataChange: (updatedData: Partial<BotData>) => void;
}

export default function SoporteTecnicoBotForm({ data, onDataChange }: SoporteTecnicoBotFormProps) {
    const {
        agentRole = "Eres un agente de soporte técnico de Nivel 1 para [Nombre de la Empresa]. Tu objetivo es diagnosticar y resolver problemas comunes de los usuarios basados en la base de conocimiento. Si no puedes resolverlo, debes escalar el caso.",
        supportedProducts = "",
        commonSolutions = "",
        escalationPolicy = "Si el problema persiste o el cliente solicita hablar con un humano, indica que transferirás la conversación a un agente especializado y que se pondrán en contacto a la brevedad."
    } = data;
    
    const handleFieldChange = (field: keyof BotData, value: string) => {
        onDataChange({ [field]: value });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary"/>Rol del Agente de Soporte</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea value={agentRole} onChange={(e) => handleFieldChange('agentRole', e.target.value)} rows={5} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Wrench className="mr-2 h-5 w-5 text-primary"/>Productos o Servicios Soportados</CardTitle>
                    <CardDescription>Lista los productos o servicios que este bot puede soportar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea value={supportedProducts} onChange={(e) => handleFieldChange('supportedProducts', e.target.value)} rows={3} placeholder="Ej: Software de Contabilidad, App Móvil de Tareas, Servicio de Hosting Web" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><BookOpen className="mr-2 h-5 w-5 text-primary"/>Base de Conocimiento (Soluciones Comunes)</CardTitle>
                    <CardDescription>Proporciona una lista de problemas y soluciones. Usa una línea para el problema y la siguiente para la solución.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        value={commonSolutions} 
                        onChange={(e) => handleFieldChange('commonSolutions', e.target.value)} 
                        rows={10} 
                        placeholder="Ej:\nProblema: No puedo iniciar sesión.\nSolución: Asegúrate de usar el correo correcto y prueba restablecer tu contraseña en [enlace].\n\nProblema: La aplicación va lenta.\nSolución: Intenta limpiar la caché de la aplicación y reinicia tu dispositivo." 
                    />
                </CardContent>
            </Card>
            
            <DriveLinksForm data={data} onDataChange={onDataChange} />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Share2 className="mr-2 h-5 w-5 text-primary"/>Política de Escalación</CardTitle>
                    <CardDescription>Instrucciones para el bot sobre cuándo y cómo escalar una conversación a un agente humano.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea value={escalationPolicy} onChange={(e) => handleFieldChange('escalationPolicy', e.target.value)} rows={4} />
                </CardContent>
            </Card>
        </div>
    );
}
