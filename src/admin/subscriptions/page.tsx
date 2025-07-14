
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, CreditCard, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isTrial: boolean;
  trialDays: number;
  isActive: boolean;
  isComingSoon?: boolean;
  monthlyPriceId?: string; // Stripe Price ID for monthly plan
  yearlyPriceId?: string;  // Stripe Price ID for yearly plan
}

interface StripePrice {
  id: string;
  unit_amount: number;
  product: {
    name: string;
  };
}

const initialFormState: Omit<SubscriptionPlan, 'id'> = {
  name: '',
  priceMonthly: 0,
  priceYearly: 0,
  features: [],
  isTrial: false,
  trialDays: 0,
  isActive: true,
  isComingSoon: false,
  monthlyPriceId: '',
  yearlyPriceId: '',
};

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [currentFormData, setCurrentFormData] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);

  const [stripePrices, setStripePrices] = useState<{ monthly: StripePrice[], yearly: StripePrice[] }>({ monthly: [], yearly: [] });
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);

  const fetchPlans = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'subscriptions'));
      const fetchedPlans: SubscriptionPlan[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedPlans.push({ id: docSnap.id, ...(docSnap.data() as Omit<SubscriptionPlan, 'id'>) });
      });
      fetchedPlans.sort((a, b) => a.name.localeCompare(b.name));
      setPlans(fetchedPlans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los planes de suscripción." });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    const fetchStripePrices = async () => {
      if (!user) return;
      setIsLoadingPrices(true);
      try {
        const response = await fetch('/api/stripe-prices');
        if (!response.ok) {
          throw new Error('Failed to fetch Stripe prices from API');
        }
        const data = await response.json();
        setStripePrices(data);
      } catch (error) {
        console.error("Error fetching Stripe prices:", error);
        toast({ variant: "destructive", title: "Error de Stripe", description: "No se pudieron cargar los precios. Revisa la consola para más detalles." });
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchStripePrices();
  }, [user, toast]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setCurrentFormData(prev => ({ ...prev, [name]: isNumber ? Number(value) : value }));
  };
  
  const handleFeaturesChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentFormData(prev => ({ ...prev, features: e.target.value.split('\n') }));
  };

  const handleSwitchChange = (name: 'isTrial' | 'isActive' | 'isComingSoon', checked: boolean) => {
    setCurrentFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleOpenFormDialog = (plan: SubscriptionPlan | null = null) => {
    if (plan) {
      setEditingPlan(plan);
      setCurrentFormData({ ...initialFormState, ...plan, features: plan.features || [] });
    } else {
      setEditingPlan(null);
      setCurrentFormData(initialFormState);
    }
    setIsFormOpen(true);
  };
  
  const handleCloseFormDialog = () => {
    setIsFormOpen(false);
    setEditingPlan(null);
    setCurrentFormData(initialFormState);
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentFormData.name.trim()) {
      toast({ variant: "destructive", title: "Error de Validación", description: "El nombre del plan no puede estar vacío." });
      return;
    }
    setIsSaving(true);
    
    const planData = {
        ...currentFormData,
        features: currentFormData.features.map(f => f.trim()).filter(f => f), // Clean up features
    };

    try {
      if (editingPlan) {
        const planDocRef = doc(db, 'subscriptions', editingPlan.id);
        await updateDoc(planDocRef, planData);
        toast({ title: "Plan Actualizado", description: "Los cambios han sido guardados." });
      } else {
        await addDoc(collection(db, 'subscriptions'), planData);
        toast({ title: "Plan Creado", description: "El nuevo plan de suscripción ha sido guardado." });
      }
      fetchPlans();
      handleCloseFormDialog();
    } catch (error) {
      console.error("Error saving subscription plan:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el plan de suscripción." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = (plan: SubscriptionPlan) => {
    setPlanToDelete(plan);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeletePlan = async () => {
    if (!planToDelete) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'subscriptions', planToDelete.id));
      toast({ title: "Plan Eliminado" });
      fetchPlans();
      setIsDeleteDialogOpen(false);
      setPlanToDelete(null);
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el plan." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <CreditCard className="mr-3 h-8 w-8 text-primary" />
            Gestión de Suscripciones
          </h2>
          <p className="text-muted-foreground">Crea y administra los planes de suscripción para tus clientes.</p>
        </div>
        <Button onClick={() => handleOpenFormDialog()} className="mt-4 sm:mt-0">
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planes de Suscripción</CardTitle>
          <CardDescription>Listado de todos los planes de suscripción disponibles.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Cargando planes...</span>
            </div>
          ) : plans.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No has creado ningún plan de suscripción. ¡Añade uno!</p>
          ) : (
            <ScrollArea className="max-h-[600px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Plan</TableHead>
                    <TableHead>Precio Mensual</TableHead>
                    <TableHead>Precio Anual</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>${plan.priceMonthly.toFixed(2)}</TableCell>
                      <TableCell>${plan.priceYearly.toFixed(2)}</TableCell>
                      <TableCell>
                        {plan.isComingSoon ? (
                           <Badge variant="secondary" className="bg-blue-100 text-blue-800">Próximamente</Badge>
                        ) : plan.isTrial ? (
                           <Badge variant="secondary">Prueba ({plan.trialDays} días)</Badge>
                        ) : (
                           <Badge variant="outline">Estándar</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                         <Badge variant={plan.isActive ? 'default' : 'destructive'} className={plan.isActive ? 'bg-green-500' : ''}>
                          {plan.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(plan)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeletePlan(plan)} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={handleCloseFormDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plan de Suscripción' : 'Crear Nuevo Plan de Suscripción'}</DialogTitle>
            <DialogDescription>
              Define los detalles, precios y características del plan. Selecciona los precios desde tu dashboard de Stripe.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitForm}>
            <ScrollArea className="max-h-[70vh] p-1">
            <div className="space-y-4 py-4 pr-4">
                <div>
                  <Label htmlFor="name">Nombre del Plan</Label>
                  <Input id="name" name="name" value={currentFormData.name} onChange={handleInputChange} placeholder="Ej: Plan Básico" required />
                </div>
                
                <div>
                    <Label htmlFor="monthlyPriceId">Precio Mensual de Stripe</Label>
                    <Select
                        name="monthlyPriceId"
                        value={currentFormData.monthlyPriceId || ''}
                        onValueChange={(value) => {
                            const selectedPrice = stripePrices.monthly.find(p => p.id === value);
                            setCurrentFormData(prev => ({
                                ...prev,
                                monthlyPriceId: value,
                                priceMonthly: selectedPrice ? (selectedPrice.unit_amount || 0) / 100 : prev.priceMonthly,
                            }));
                        }}
                        disabled={isLoadingPrices}
                    >
                        <SelectTrigger id="monthlyPriceId">
                            <SelectValue placeholder={isLoadingPrices ? "Cargando precios..." : "Seleccionar precio mensual"} />
                        </SelectTrigger>
                        <SelectContent>
                            {stripePrices.monthly.length > 0 ? (
                                stripePrices.monthly.map(price => (
                                    <SelectItem key={price.id} value={price.id}>
                                        {price.product.name} - ${(price.unit_amount / 100).toFixed(2)}/mes
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="none" disabled>No hay precios mensuales activos en Stripe</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                  <Label htmlFor="yearlyPriceId">Precio Anual de Stripe</Label>
                    <Select
                        name="yearlyPriceId"
                        value={currentFormData.yearlyPriceId || ''}
                        onValueChange={(value) => {
                            const selectedPrice = stripePrices.yearly.find(p => p.id === value);
                            setCurrentFormData(prev => ({
                                ...prev,
                                yearlyPriceId: value,
                                priceYearly: selectedPrice ? (selectedPrice.unit_amount || 0) / 100 : prev.priceYearly,
                            }));
                        }}
                        disabled={isLoadingPrices}
                    >
                        <SelectTrigger id="yearlyPriceId">
                            <SelectValue placeholder={isLoadingPrices ? "Cargando precios..." : "Seleccionar precio anual"} />
                        </SelectTrigger>
                        <SelectContent>
                            {stripePrices.yearly.length > 0 ? (
                                stripePrices.yearly.map(price => (
                                    <SelectItem key={price.id} value={price.id}>
                                        {price.product.name} - ${(price.unit_amount / 100).toFixed(2)}/año
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="none" disabled>No hay precios anuales activos en Stripe</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priceMonthly">Precio Mensual (Display)</Label>
                    <div className="relative">
                       <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input id="priceMonthly" name="priceMonthly" type="number" value={currentFormData.priceMonthly} onChange={handleInputChange} placeholder="29.99" required className="pl-8"/>
                    </div>
                  </div>
                   <div>
                    <Label htmlFor="priceYearly">Precio Anual (Display)</Label>
                     <div className="relative">
                       <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input id="priceYearly" name="priceYearly" type="number" value={currentFormData.priceYearly} onChange={handleInputChange} placeholder="299.99" required className="pl-8"/>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="features">Características (una por línea)</Label>
                  <Textarea id="features" name="features" value={(currentFormData.features || []).join('\n')} onChange={handleFeaturesChange} rows={5} placeholder="Característica 1\nCaracterística 2" />
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                   <Switch id="isTrial" name="isTrial" checked={currentFormData.isTrial} onCheckedChange={(c) => handleSwitchChange('isTrial', c)} />
                   <Label htmlFor="isTrial">¿Es un plan de prueba?</Label>
                </div>

                {currentFormData.isTrial && (
                  <div>
                    <Label htmlFor="trialDays">Días de Prueba</Label>
                    <Input id="trialDays" name="trialDays" type="number" value={currentFormData.trialDays} onChange={handleInputChange} placeholder="14" />
                  </div>
                )}
                
                <div className="flex items-center space-x-2 pt-2">
                   <Switch id="isActive" name="isActive" checked={currentFormData.isActive} onCheckedChange={(c) => handleSwitchChange('isActive', c)} />
                   <Label htmlFor="isActive">Plan Activo</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    Los planes inactivos no se mostrarán a los nuevos usuarios.
                </p>

                <div className="flex items-center space-x-2 pt-2">
                   <Switch id="isComingSoon" name="isComingSoon" checked={currentFormData.isComingSoon ?? false} onCheckedChange={(c) => handleSwitchChange('isComingSoon', c)} />
                   <Label htmlFor="isComingSoon">Marcar como "Próximamente"</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    Los planes "Próximamente" se mostrarán pero no se podrán contratar.
                </p>


            </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseFormDialog} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingPlan ? 'Guardar Cambios' : 'Crear Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar este plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El plan "{planToDelete?.name}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPlanToDelete(null)} disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePlan} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
