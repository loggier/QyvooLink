
"use client";

import type { BotData } from '@/app/(app)/dashboard/bots/page';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, User, ClipboardList } from 'lucide-react';
import DriveLinksForm from './shared/DriveLinksForm';

interface AsistentePersonalBotFormProps {
  data: BotData;
  onDataChange: (updatedData: Partial<BotData>) => void;
}

export default function AsistentePersonalBotForm({ data, onDataChange }: AsistentePersonalBotFormProps) {
    const {
        agentRole = "Eres un asistente personal altamente eficiente. Tu objetivo es gestionar mi agenda, tomar notas, recordar tareas y filtrar comunicaciones. Debes ser proactivo, discreto y aprender mis preferencias. Utiliza la herramienta `createAppointment` para agendar citas y `getFutureAppointments` para consultar citas existentes.",
        userPreferences = "Prefiero comunicarme por texto. Mi horario de no molestar es de 10pm a 8am.",
        taskInstructions = "Para crear un recordatorio, pídeme el título, la fecha y la hora. Para agendar una cita, solicita el nombre del contacto, motivo y duración. Si el usuario pregunta por sus citas, usa la herramienta para buscarlas.",
    } = data;

    const handleFieldChange = (field: keyof BotData, value: string) => {
        onDataChange({ [field]: value });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary"/>Rol del Asistente Personal</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea value={agentRole} onChange={(e) => handleFieldChange('agentRole', e.target.value)} rows={5} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><User className="mr-2 h-5 w-5 text-primary"/>Mis Preferencias</CardTitle>
                    <CardDescription>Indica tus preferencias generales para que el asistente las conozca.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        value={userPreferences} 
                        onChange={(e) => handleFieldChange('userPreferences', e.target.value)} 
                        rows={4} 
                        placeholder="Ej: Prefiero las reuniones por la mañana. No agendar nada los viernes por la tarde. Recordarme mis citas 1 hora antes." 
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>Instrucciones para Tareas</CardTitle>
                    <CardDescription>Define cómo debe el asistente manejar tareas específicas como agendar citas, crear recordatorios, etc.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        value={taskInstructions} 
                        onChange={(e) => handleFieldChange('taskInstructions', e.target.value)} 
                        rows={6} 
                        placeholder="Ej: Si alguien quiere una reunión conmigo, primero ofréceles mi enlace de Calendly. Si insisten en un horario manual, pide 3 opciones y yo confirmaré."
                    />
                </CardContent>
            </Card>
            
            <DriveLinksForm data={data} onDataChange={onDataChange} />
            
        </div>
    );
}
