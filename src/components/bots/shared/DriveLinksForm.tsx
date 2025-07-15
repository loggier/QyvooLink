
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
import { useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface DriveLinksFormProps {
  data: BotData;
  onDataChange: (updatedData: Partial<BotData>) => void;
}

const allLinkTypes = ['Catálogo de Productos', 'Base de Conocimiento', 'Preguntas Frecuentes', 'Otro'] as const;

export default function DriveLinksForm({ data, onDataChange }: DriveLinksFormProps) {
    const { driveLinks = [] } = data;

    const usedTypes = useMemo(() => new Set(driveLinks.map(link => link.type)), [driveLinks]);

    const handleAddLink = () => {
        const firstAvailableType = allLinkTypes.find(type => !usedTypes.has(type));
        if (!firstAvailableType) return;

        const newLinks = produce(driveLinks, (draft: DriveLink[]) => {
            draft.push({ id: generateSafeId(), name: '', type: firstAvailableType, url: '' });
        });
        onDataChange({ driveLinks: newLinks });
    };

    const handleRemoveLink = (linkId: string) => {
        const newLinks = driveLinks.filter((link) => link.id !== linkId);
        onDataChange({ driveLinks: newLinks });
    };

    const handleLinkChange = (linkId: string, field: keyof DriveLink, value: string) => {
        const newLinks = produce(driveLinks, (draft: DriveLink[]) => {
            const link = draft.find(l => l.id === linkId);
            if (link) {
                (link as any)[field] = value;
            }
        });
        onDataChange({ driveLinks: newLinks });
    };

    const canAddMoreLinks = driveLinks.length < allLinkTypes.length;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Documentos Externos (Google Drive)</CardTitle>
                <CardDescription>
                    Conecta documentos para que el bot los use como base de conocimiento extendida. Solo se permite un documento por tipo.
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
                {driveLinks.map((link) => {
                    const otherUsedTypes = new Set(driveLinks.filter(l => l.id !== link.id).map(l => l.type));
                    const availableTypesForThisLink = allLinkTypes.filter(type => !otherUsedTypes.has(type));

                    return (
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
                                        {availableTypesForThisLink.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`link-name-${link.id}`}>Nombre del Documento (Obligatorio)</Label>
                                <Input
                                    id={`link-name-${link.id}`}
                                    value={link.name}
                                    onChange={(e) => handleLinkChange(link.id, 'name', e.target.value)}
                                    placeholder="Ej: Catálogo de Verano 2024"
                                    required
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor={`link-desc-${link.id}`}>Descripción (Opcional)</Label>
                                <Textarea
                                    id={`link-desc-${link.id}`}
                                    value={link.description || ''}
                                    onChange={(e) => handleLinkChange(link.id, 'description', e.target.value)}
                                    placeholder="Breve descripción del contenido del documento."
                                    rows={2}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`link-url-${link.id}`}>URL del Documento (Obligatorio)</Label>
                                <Input
                                    id={`link-url-${link.id}`}
                                    value={link.url}
                                    onChange={(e) => handleLinkChange(link.id, 'url', e.target.value)}
                                    placeholder="https://docs.google.com/document/d/..."
                                    required
                                />
                            </div>
                        </div>
                    );
                })}
                <Button variant="outline" onClick={handleAddLink} className="w-full" disabled={!canAddMoreLinks}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {canAddMoreLinks ? "Añadir Documento" : "Todos los tipos de documentos añadidos"}
                </Button>
            </CardContent>
        </Card>
    );
}
