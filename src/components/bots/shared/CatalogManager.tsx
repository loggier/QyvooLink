
"use client";

import { produce } from 'immer';
import { generateSafeId } from '@/lib/uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface CatalogManagerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    serviceCatalog: ServiceCategory[];
    onUpdate: (newCatalog: ServiceCategory[]) => void;
}

export function CatalogManager({ isOpen, onOpenChange, serviceCatalog, onUpdate }: CatalogManagerProps) {
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

    const handleAddService = (catIndex: number) => {
        const newCatalog = produce(serviceCatalog, (draft) => {
            if (!draft[catIndex].services) {
                draft[catIndex].services = [];
            }
            draft[catIndex].services.push({ id: generateSafeId(), name: "", price: "", notes: "" });
        });
        onUpdate(newCatalog);
    };

    const handleRemoveService = (catIndex: number, serviceId: string) => {
        const newCatalog = produce(serviceCatalog, (draft) => {
            draft[catIndex].services = draft[catIndex].services.filter((srv) => srv.id !== serviceId);
        });
        onUpdate(newCatalog);
    };

    const handleServiceChange = (catIndex: number, srvIndex: number, field: keyof Service, value: string) => {
        const newCatalog = produce(serviceCatalog, (draft) => {
            draft[catIndex].services[srvIndex][field] = value;
        });
        onUpdate(newCatalog);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Gestionar Catálogo de Servicios</DialogTitle>
                    <DialogDescription>
                        Añade, edita o elimina categorías y servicios de tu catálogo. Los cambios se guardarán al cerrar esta ventana.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow pr-6 -mr-6">
                    <div className="space-y-4 py-4">
                        {serviceCatalog.map((category, catIndex) => (
                            <Card key={category.id} className="p-4 border rounded-md space-y-3 bg-muted/30">
                                <div className="flex justify-between items-center mb-2">
                                    <Input
                                        value={category.categoryName}
                                        onChange={(e) => handleCategoryNameChange(catIndex, e.target.value)}
                                        className="text-lg font-semibold bg-background"
                                        placeholder="Nombre de la Categoría"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveCategory(category.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                                {category.services?.map((service, srvIndex) => (
                                    <Card key={service.id} className="p-3 bg-background">
                                        <div className="space-y-2">
                                            <Label>Servicio</Label>
                                            <Input value={service.name} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'name', e.target.value)} placeholder="Nombre del servicio" />
                                            <Label>Precio</Label>
                                            <Input value={service.price} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'price', e.target.value)} placeholder="Ej: $100" />
                                            <Label>Notas</Label>
                                            <Textarea value={service.notes} onChange={(e) => handleServiceChange(catIndex, srvIndex, 'notes', e.target.value)} placeholder="Notas adicionales" rows={2}/>
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <Button variant="outline" size="sm" onClick={() => handleRemoveService(catIndex, service.id)}>
                                                <Trash2 className="h-3 w-3 mr-1" /> Eliminar Servicio
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                                <Button variant="outline" onClick={() => handleAddService(catIndex)}>
                                    <PlusCircle className="h-4 w-4 mr-2" /> Añadir Servicio a esta Categoría
                                </Button>
                            </Card>
                        ))}
                        <Button onClick={handleAddCategory} className="w-full">
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
