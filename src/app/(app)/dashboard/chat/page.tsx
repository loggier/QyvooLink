
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { 
  doc, getDoc, 
  collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, Timestamp as FirestoreTimestamp,
  setDoc, onSnapshot, limit
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EvolveLinkLogo } from '@/components/icons';
import { Loader2, MessageCircle, AlertTriangle, Info, User, Send, Save, Building, Mail, Phone, UserCheck, Bot, UserRound, MessageSquareDashed, Zap, ArrowLeft, ListTodo, UserCog, Filter, StickyNote } from 'lucide-react'; 
import type { WhatsAppInstance } from '../configuration/page'; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; 
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation'; 
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import ContactDetailsPanel, { type ContactDetails } from '@/components/dashboard/chat/contact-details-panel'; 
import { format, isToday, isYesterday, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TeamMember } from '../team/page';
import { sendAssignmentNotificationEmail } from '@/lib/email';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatMessageDocument {
  chat_id: string;
  from: string;
  instance: string;
  instanceId: string;
  mensaje: string;
  timestamp: FirestoreTimestamp; 
  to: string;
  user_name: 'User' | 'bot' | string; // 'agente' is now a generic string
  author?: {
    uid: string;
    name: string;
  };
  type?: 'message' | 'internal_note';
}

interface ChatMessage extends ChatMessageDocument {
  id: string; 
}

interface ConversationSummary {
  chat_id: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  lastMessageSender: string;
  lastMessageAuthorName?: string;
  nameLine1: string;
  nameLine2: string | null;
  avatarFallback?: string; 
  status?: ContactDetails['estadoConversacion'];
  assignedTo?: string; // Add assignedTo for filtering
  assignedToName?: string;
}

interface QuickReply {
  id: string;
  userId: string;
  tag: string;
  message: string;
}

const getContactDocId = (userId: string, chatId: string): string => `${userId}_${chatId.replace(/@/g, '_')}`;

function formatWhatsAppMessage(text: string | undefined | null): React.ReactNode[] {
  if (typeof text !== 'string' || !text) {
    return [text]; 
  }

  const elements: React.ReactNode[] = [];
  const regex = /(```(?:.|\n)*?```)|(\*(.+?)\*)|(_([^_]+?)_)|(~([^~]+?)~)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const startIndex = match.index;

    if (startIndex > lastIndex) {
      elements.push(text.substring(lastIndex, startIndex));
    }

    if (match[1]) { 
      elements.push(<code key={lastIndex} className="font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded text-xs">{match[1].slice(3, -3)}</code>);
    } else if (match[2]) { 
      elements.push(<strong key={lastIndex}>{match[3]}</strong>);
    } else if (match[4]) { 
      elements.push(<em key={lastIndex}>{match[5]}</em>);
    } else if (match[6]) { 
      elements.push(<del key={lastIndex}>{match[7]}</del>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  if (elements.length === 0 && text.length > 0) {
      elements.push(text);
  }

  return elements;
}
