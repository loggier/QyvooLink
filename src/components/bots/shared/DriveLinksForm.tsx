
"use client";

import type { BotData, DriveLink } from '@/app/(app)/dashboard/bots/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { generateSafeId } from '@/lib/uuid';
import { produce } from 'immer';

interface DriveLinksFormProps {
  data: BotData;
  onDataChange: (updatedData: Partial<BotData>) => void;
}

const linkTypes = ['Catálogo de Productos', 'Base de Conocimiento', 'Preguntas Frecuentes', 'Otro'];

export default function DriveLinksForm({ data, onDataChange }: DriveLinksFormProps) {
    const { driveLinks = [] } = data;

    const handleAddLink = () => {
        const newLinks = produce(driveLinks, (draft: DriveLink[]) => {
            draft.push({ id: generateSafeId(), type: 'Otro', url: '' });
        });
        onDataChange({ driveLinks: newLinks });
    };

    const handleRemoveLink = (linkId: string) => {
        const newLinks = driveLinks.filter((link) => link.id !== linkId);
        onDataChange({ driveLinks: newLinks });
    };

    const handleLinkChange = (linkId: string, field: 'type' | 'url', value: string) => {
        const newLinks = produce(driveLinks, (draft: DriveLink[]) => {
            const link = draft.find(l => l.id === linkId);
            if (link) {
                if (field === 'type') {
                    link.type = value as DriveLink['type'];
                } else {
                    link.url = value;
                }
            }
        });
        onDataChange({ driveLinks: newLinks });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Documentos Externos (Google Drive)</CardTitle>
                <CardDescription>
                    Conecta documentos para que el bot los use como base de conocimiento extendida.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-start p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-5 w-5 mr-3 text-amber-500 mt-1 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-300">¡Importante!</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            Asegúrate de que tus documentos de Google Drive estén compartidos con "Cualquier persona con el enlace" y con permiso de "Lector" para que el sistema pueda acceder a ellos.
                        </p>
                    </div>
                </div>
                {driveLinks.map((link) => (
                    <div key={link.id} className="p-4 border rounded-md space-y-3 bg-muted/30 relative">
                         <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => handleRemoveLink(link.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                         </Button>
                        <div className="space-y-2">
                            <Label htmlFor={`link-type-${link.id}`}>Tipo de Documento</Label>
                            <Select
                                value={link.type}
                                onValueChange={(value) => handleLinkChange(link.id, 'type', value)}
                            >
                                <SelectTrigger id={`link-type-${link.id}`}>
                                    <SelectValue placeholder="Seleccionar tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {linkTypes.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`link-url-${link.id}`}>URL del Documento</Label>
                            <Input
                                id={`link-url-${link.id}`}
                                value={link.url}
                                onChange={(e) => handleLinkChange(link.id, 'url', e.target.value)}
                                placeholder="https://docs.google.com/document/d/..."
                            />
                        </div>
                    </div>
                ))}
                <Button variant="outline" onClick={handleAddLink} className="w-full">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Documento
                </Button>
            </CardContent>
        </Card>
    );
}
