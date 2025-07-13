
"use client";

import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardHeader, CardFooter, CardTitle, CardContent } from '@/components/ui/card'; // Added CardContent
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, XCircle, Edit3, UserRound, Building, Mail, Phone, UserCheck, MapPin, Bot, MessageSquareDashed, MessageCircle, ListTodo, UserCog, CalendarClock } from 'lucide-react';
import type { TeamMember } from '@/app/(app)/dashboard/team/page';
import type { Appointment } from '@/app/(app)/dashboard/schedule/page';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface ContactDetails {
  id?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  ubicacion?: string;
  tipoCliente?: 'Prospecto' | 'Cliente' | 'Proveedor' | 'Otro';
  estadoConversacion?: 'Abierto' | 'Pendiente' | 'Cerrado';
  instanceId?: string;
  userId?: string;
  _chatIdOriginal?: string;
  chatbotEnabledForContact?: boolean;
  assignedTo?: string; // UID of the agent
  assignedToName?: string; // Name of the agent for display
}

interface ContactDetailsPanelProps {
  contactDetails: ContactDetails | null;
  initialContactDetails: ContactDetails | null; // Used for cancel
  isEditingContact: boolean;
  setIsEditingContact: (isEditing: boolean) => void;
  isLoadingContact: boolean;
  isSavingContact: boolean;
  teamMembers: TeamMember[];
  nextAppointment: Appointment | null;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onInputChange: (field: keyof Omit<ContactDetails, 'id' | 'instanceId' | 'userId' | 'tipoCliente' | '_chatIdOriginal' | 'chatbotEnabledForContact' | 'estadoConversacion' | 'assignedTo' | 'assignedToName'>, value: string) => void;
  onSelectChange: (value: ContactDetails['tipoCliente']) => void;
  onStatusChange: (value: ContactDetails['estadoConversacion']) => void;
  onSwitchChange: (checked: boolean) => void;
  onAssigneeChange: (memberId: string) => void;
  formatPhoneNumber: (chat_id: string | undefined) => string;
}

export default function ContactDetailsPanel({
  contactDetails,
  initialContactDetails,
  isEditingContact,
  setIsEditingContact,
  isLoadingContact,
  isSavingContact,
  teamMembers,
  nextAppointment,
  onSave,
  onCancel,
  onInputChange,
  onSelectChange,
  onStatusChange,
  onSwitchChange,
  onAssigneeChange,
  formatPhoneNumber,
}: ContactDetailsPanelProps) {

  if (isLoadingContact) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contactDetails) {
    return (
      <>
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg">Información del Contacto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
             <p className="text-muted-foreground text-center">Selecciona un chat para ver la información del contacto.</p>
        </CardContent>
      </>
    );
  }
  
  const currentDisplayDetails = contactDetails;


  return (
    <TooltipProvider>
      <CardHeader className="p-4 border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Información del Contacto</CardTitle>
          {!isEditingContact && (
            <Button variant="ghost" size="icon" onClick={() => setIsEditingContact(true)} disabled={isLoadingContact}>
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <ScrollArea className="flex-grow p-4">
        <div className="space-y-4">
           <div>
              <Label className="flex items-center text-sm text-muted-foreground"><CalendarClock className="h-4 w-4 mr-2" />Próxima Cita</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                   <Link href="/dashboard/schedule" className="block w-full">
                      <Input
                        value={nextAppointment ? format(nextAppointment.start, "dd/MM/yy 'a las' HH:mm", { locale: es }) : "Ninguna"}
                        readOnly
                        className="cursor-pointer hover:bg-muted/50"
                      />
                   </Link>
                </TooltipTrigger>
                {nextAppointment && (
                  <TooltipContent>
                    <p className="font-bold">{nextAppointment.title}</p>
                    <p>Haz clic para ver la agenda completa.</p>
                  </TooltipContent>
                )}
              </Tooltip>
           </div>
           <div>
            <Label htmlFor="contactStatus" className="flex items-center text-sm text-muted-foreground"><ListTodo className="h-4 w-4 mr-2" />Estado Conversación</Label>
            <Select
              value={currentDisplayDetails.estadoConversacion || 'Abierto'}
              onValueChange={(value) => onStatusChange(value as ContactDetails['estadoConversacion'])}
              disabled={!isEditingContact}
            >
              <SelectTrigger id="contactStatus">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Abierto">Abierto</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div>
            <Label htmlFor="contactAssignee" className="flex items-center text-sm text-muted-foreground"><UserCog className="h-4 w-4 mr-2" />Asignado a</Label>
            <Select
              value={currentDisplayDetails.assignedTo || "unassigned"}
              onValueChange={(value) => onAssigneeChange(value === 'unassigned' ? '' : value)}
              disabled={!isEditingContact}
            >
              <SelectTrigger id="contactAssignee">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {teamMembers.map(member => (
                    <SelectItem key={member.uid} value={member.uid}>{member.fullName || member.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="contactNombre" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-4 w-4 mr-2" />Nombre</Label>
            <Input id="contactNombre" value={currentDisplayDetails.nombre || ""} onChange={(e) => onInputChange('nombre', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible" />
          </div>
          <div>
            <Label htmlFor="contactApellido" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-4 w-4 mr-2" />Apellido</Label>
            <Input id="contactApellido" value={currentDisplayDetails.apellido || ""} onChange={(e) => onInputChange('apellido', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible" />
          </div>
          <div>
            <Label htmlFor="contactEmail" className="flex items-center text-sm text-muted-foreground"><Mail className="h-4 w-4 mr-2" />Correo Electrónico</Label>
            <Input id="contactEmail" type="email" value={currentDisplayDetails.email || ""} onChange={(e) => onInputChange('email', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible" />
          </div>
          <div>
            <Label htmlFor="contactTelefono" className="flex items-center text-sm text-muted-foreground"><Phone className="h-4 w-4 mr-2" />Teléfono</Label>
            <Input
              id="contactTelefono"
              value={currentDisplayDetails.telefono || ""}
              onChange={(e) => onInputChange('telefono', e.target.value)}
              readOnly={!isEditingContact}
              placeholder="No disponible"
            />
          </div>
          <div>
            <Label htmlFor="contactEmpresa" className="flex items-center text-sm text-muted-foreground"><Building className="h-4 w-4 mr-2" />Empresa</Label>
            <Input id="contactEmpresa" value={currentDisplayDetails.empresa || ""} onChange={(e) => onInputChange('empresa', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible" />
          </div>
          <div>
            <Label htmlFor="contactUbicacion" className="flex items-center text-sm text-muted-foreground"><MapPin className="h-4 w-4 mr-2" />Ubicación</Label>
            <Input id="contactUbicacion" value={currentDisplayDetails.ubicacion || ""} onChange={(e) => onInputChange('ubicacion', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible" />
          </div>
          <div>
            <Label htmlFor="contactTipoCliente" className="flex items-center text-sm text-muted-foreground"><UserCheck className="h-4 w-4 mr-2" />Tipo de Cliente</Label>
            <Select
              value={currentDisplayDetails.tipoCliente || ""}
              onValueChange={(value) => onSelectChange(value as ContactDetails['tipoCliente'])}
              disabled={!isEditingContact}
            >
              <SelectTrigger id="contactTipoCliente">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Prospecto">Prospecto</SelectItem>
                <SelectItem value="Cliente">Cliente</SelectItem>
                <SelectItem value="Proveedor">Proveedor</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div>
            <Label htmlFor="contactChatId" className="flex items-center text-sm text-muted-foreground"><MessageCircle className="h-4 w-4 mr-2" />Chat ID Original</Label>
            <Input id="contactChatId" value={currentDisplayDetails._chatIdOriginal || ""} readOnly placeholder="No disponible"/>
          </div>
          <div>
            <div className="flex items-center space-x-2 mt-2">
              <Switch
                id="chatbotEnabledForContact"
                checked={currentDisplayDetails.chatbotEnabledForContact ?? true}
                onCheckedChange={(checked) => {
                  if (isEditingContact) {
                    onSwitchChange(checked);
                  }
                }}
                disabled={!isEditingContact || isLoadingContact || isSavingContact}
              />
              <Label htmlFor="chatbotEnabledForContact" className="flex items-center text-sm text-muted-foreground">
                <Bot className="h-4 w-4 mr-2" />
                Chatbot Activo para este Contacto
              </Label>
            </div>
            {isEditingContact && !(currentDisplayDetails.chatbotEnabledForContact ?? true) && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 flex items-center">
                <MessageSquareDashed className="h-3 w-3 mr-1" /> El bot no responderá automáticamente a este contacto.
              </p>
            )}
          </div>

          {isEditingContact && (
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onCancel} disabled={isSavingContact}>
                <XCircle className="mr-2 h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={onSave} disabled={isSavingContact}>
                {isSavingContact ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
      <CardFooter className="p-2 border-t">
        <p className="text-xs text-muted-foreground text-center w-full">Información de contacto adicional.</p>
      </CardFooter>
    </TooltipProvider>
  );
}
