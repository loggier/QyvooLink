
"use client";

import { useState } from 'react';
import { produce } from 'immer';
import { generateSafeId } from '@/lib/uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

interface NewServiceState {
    [categoryId: string]: Omit<Service, 'id'>;
}

interface CatalogManagerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    serviceCatalog: ServiceCategory[];
    onUpdate: (newCatalog: ServiceCategory[]) => void;
}

const initialServiceState: Omit<Service, 'id'> = { name: '', price: '', notes: '' };

export function CatalogManager({ isOpen, onOpenChange, serviceCatalog, onUpdate }: CatalogManagerProps) {
    const [newServiceForms, setNewServiceForms] = useState<NewServiceState>({});
    
    const handleAddCategory = () => {
        const newCatalog = produce(serviceCatalog, (draft) => {
            draft.push({ id: generateSafeId(), categoryName: "Nueva Categoría", services: [] });
        });
        onUpdate(newCatalog);
    };

    const handleRemoveCategory = (categoryId: string) => {
        const newCatalog = serviceCatalog.filter((cat) => cat.id !== categoryId);
        onUpdate(newCatalog);
    };

    const handleCategoryNameChange = (catIndex: number, newName: string) => {
        const newCatalog = produce(serviceCatalog, (draft) => {
            draft[catIndex].categoryName = newName;
        });
        onUpdate(newCatalog);
    };

    const handleAddService = (catIndex: number, categoryId: string) => {
        const serviceToAdd = newServiceForms[categoryId] || initialServiceState;
        if (!serviceToAdd.name) return; // Do not add empty services

        const newCatalog = produce(serviceCatalog, (draft) => {
            if (!draft[catIndex].services) {
                draft[catIndex].services = [];
            }
            draft[catIndex].services.push({ id: generateSafeId(), ...serviceToAdd });
        });
        onUpdate(newCatalog);
        // Reset the form for that category
        setNewServiceForms(prev => ({ ...prev, [categoryId]: initialServiceState }));
    };

    const handleRemoveService = (catIndex: number, serviceId: string) => {
        const newCatalog = produce(serviceCatalog, (draft) => {
            draft[catIndex].services = draft[catIndex].services.filter((srv) => srv.id !== serviceId);
        });
        onUpdate(newCatalog);
    };
    
    const handleServiceChange = (catIndex: number, srvIndex: number, field: keyof Service, value: string) => {
        const newCatalog = produce(serviceCatalog, (draft) => {
            (draft[catIndex].services[srvIndex] as any)[field] = value;
        });
        onUpdate(newCatalog);
    };

    const handleNewServiceFormChange = (categoryId: string, field: keyof Omit<Service, 'id'>, value: string) => {
        setNewServiceForms(prev => ({
            ...prev,
            [categoryId]: {
                ...(prev[categoryId] || initialServiceState),
                [field]: value,
            }
        }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Gestionar Catálogo de Servicios</DialogTitle>
                    <DialogDescription>
                        Añade, edita o elimina categorías y servicios de tu catálogo. Usa el acordeón para navegar entre categorías.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow pr-6 -mr-6">
                    <div className="space-y-2 py-4">
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            {serviceCatalog.map((category, catIndex) => (
                                <AccordionItem value={category.id} key={category.id} className="border-b-0">
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                        <AccordionTrigger className="flex-grow p-2 hover:no-underline">
                                            <Input
                                                value={category.categoryName}
                                                onChange={(e) => handleCategoryNameChange(catIndex, e.target.value)}
                                                className="text-lg font-semibold bg-background h-10 flex-grow"
                                                placeholder="Nombre de la Categoría"
                                                onClick={(e) => e.stopPropagation()} // Prevent accordion from toggling when clicking input
                                            />
                                        </AccordionTrigger>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveCategory(category.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                    <AccordionContent className="p-4 pt-2 border-l border-r border-b rounded-b-lg">
                                        <div className="p-4 bg-background rounded-md border space-y-3 mt-2">
                                            <h4 className="font-medium">Añadir Nuevo Servicio</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <Input 
                                                value={newServiceForms[category.id]?.name || ''} 
                                                onChange={(e) => handleNewServiceFormChange(category.id, 'name', e.target.value)} 
                                                placeholder="Nombre del servicio"
                                                />
                                                <Input 
                                                value={newServiceForms[category.id]?.price || ''}
                                                onChange={(e) => handleNewServiceFormChange(category.id, 'price', e.target.value)}
                                                placeholder="Precio (Ej: $100)"
                                                />
                                                <Input
                                                    value={newServiceForms[category.id]?.notes || ''}
                                                    onChange={(e) => handleNewServiceFormChange(category.id, 'notes', e.target.value)}
                                                    placeholder="Notas (opcional)"
                                                />
                                            </div>
                                            <Button size="sm" onClick={() => handleAddService(catIndex, category.id)} className="w-full md:w-auto">
                                                <PlusCircle className="h-4 w-4 mr-2"/>
                                                Añadir Servicio
                                            </Button>
                                        </div>

                                        {(category.services?.length > 0) && (
                                        <Table className="mt-4">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Precio</TableHead>
                                                    <TableHead>Notas</TableHead>
                                                    <TableHead className="text-right">Acción</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {category.services.map((service, srvIndex) => (
                                                    <TableRow key={service.id}>
                                                        <TableCell>
                                                            <Input value={service.name} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'name', e.target.value)} className="h-8"/>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input value={service.price} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'price', e.target.value)} className="h-8"/>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input value={service.notes} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'notes', e.target.value)} className="h-8"/>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveService(catIndex, service.id)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                        <Button onClick={handleAddCategory} className="w-full mt-4">
                            <PlusCircle className="h-4 w-4 mr-2" /> Añadir Nueva Categoría
                        </Button>
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button">Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
