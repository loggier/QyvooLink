
'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, collection, addDoc, getDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import type { BotData, DriveLink } from './page';
// Import the schema directly from the new schemas file.
import { CreateAppointmentSchema } from '@/ai/schemas';

// --- Functions from the deleted bot-prompt-builder.ts, now living here ---

function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string' || !unsafe) return '';
  return unsafe.replace(/[<>&"']/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

function buildRulesXml(rules?: string[]): string {
    if (!rules || rules.length === 0) return '';
    return `<rules>\n    ${rules.map(rule => `<rule>${escapeXml(rule)}</rule>`).join('\n    ')}\n  </rules>`;
}

function buildDriveLinksXml(links?: DriveLink[]): string {
    if (!links || links.length === 0) return '';
    const documents = links
        .filter(link => link.url && link.type && link.name)
        .map(link => {
            const descriptionXml = link.description ? `<description>${escapeXml(link.description)}</description>` : '';
            return `<document type="${escapeXml(link.type)}">\n      <name>${escapeXml(link.name)}</name>\n      ${descriptionXml}\n      <url>${escapeXml(link.url)}</url>\n    </document>`;
        })
        .join('\n    ');

    if (!documents) return '';

    return `<driveDocuments>\n    ${documents}\n  </driveDocuments>`;
}

// Simplified tool description function
function buildToolsConfigXml(tools: { name: string, description: string }[]): string {
    if (tools.length === 0) return '';
    const toolDetails = tools.map((tool) => {
        // The description now includes the parameters in a human-readable format for the LLM.
        return `<tool>\n      <name>${escapeXml(tool.name)}</name>\n      <description>${escapeXml(tool.description)}</description>\n    </tool>`;
    }).join('\n    ');
    return `<available_tools>\n    ${toolDetails}\n  </available_tools>`;
}

function buildVentasPrompt(botData: BotData): string {
    const {
        agentRole = "Eres un asistente de ventas virtual para [Nombre de la Empresa]. Tu objetivo es entender las necesidades del cliente y cerrar ventas. Para citas, sigue estas reglas ESTRICTAS: si un cliente quiere AGENDAR, DEBES usar la herramienta 'createAppointment'. Si el cliente PREGUNTA por citas existentes (ej: '¿cuándo es mi cita?'), TIENES PROHIBIDO responder de memoria. DEBES usar OBLIGATORIAMENTE la herramienta 'getFutureAppointments' para obtener la información real y actualizada. NO inventes citas.",
        selectedRules = [],
        businessContext = { description: '', location: '', mission: '' },
        serviceCatalog = [],
        contact = { phone: '', email: '', website: '' },
        closingMessage = '',
        notificationPhoneNumber = '',
        notificationRule = ''
    } = botData;
    
    let allRules = [...(selectedRules || [])];
    if (notificationRule) allRules.push(notificationRule);

    const rulesConfig = buildRulesXml(allRules);
    
    const businessContextConfig = `<businessContext>\n    <description>${escapeXml(businessContext.description)}</description>\n    <location>${escapeXml(businessContext.location)}</location>\n    <mission>${escapeXml(businessContext.mission)}</mission>\n  </businessContext>`;

    const serviceCatalogConfigSection = `<serviceCatalog>\n    ${(serviceCatalog || []).map((category: any) => {
        const servicesForXml = (category.services || []).map((service: any) => 
            `<service>\n        <name>${escapeXml(service.name)}</name>\n        <price>${escapeXml(service.price)}</price>\n        <notes>${escapeXml(service.notes)}</notes>\n      </service>`
        ).join('\n      ');
        return `<category name="${escapeXml(category.categoryName)}">\n      ${servicesForXml}\n    </category>`;
    }).join('\n    ')}\n  </serviceCatalog>`;

    const contactConfig = `<contact>\n    <phone>${escapeXml(contact.phone)}</phone>\n    <email>${escapeXml(contact.email)}</email>\n    <website>${escapeXml(contact.website)}</website>\n  </contact>`;
    
    const notificationConfig = notificationPhoneNumber ? `<notification>${escapeXml(notificationPhoneNumber)}</notification>` : '';
    const driveLinksConfig = buildDriveLinksXml(botData.driveLinks);
    
    // Updated tool description to be more explicit for the LLM.
    const toolsConfig = buildToolsConfigXml([
        { 
            name: 'createAppointment', 
            description: `Crea una nueva cita. Usa esto cuando un usuario confirma que quiere agendar algo. Parámetros requeridos: 'title' (string), 'date' (string, YYYY-MM-DD), 'startTime' (string, HH:mm), 'endTime' (string, HH:mm), 'userId' (string), 'organizationId' (string), 'timezone' (string), y 'contactPhone' (string, el número del usuario).`,
        },
        {
            name: 'getFutureAppointments',
            description: `OBLIGATORIO: Usa esta herramienta para consultar las próximas citas de un cliente. NO USES TU MEMORIA. Úsala cuando pregunten '¿cuándo es mi cita?', '¿qué citas tengo?', etc. Parámetros requeridos: 'contactPhone' (string, el número del usuario), 'userId' (string), y 'organizationId' (string).`,
        }
    ]);

    return [
        rulesConfig,
        `<agentRole>${escapeXml(agentRole)}</agentRole>`,
        businessContextConfig,
        serviceCatalogConfigSection,
        driveLinksConfig,
        contactConfig,
        `<closingMessage>${escapeXml(closingMessage)}</closingMessage>`,
        notificationConfig,
        toolsConfig,
    ].filter(Boolean).join('\n').trim();
}

function buildSoporteTecnicoPrompt(botData: BotData): string {
    const {
        agentRole = "Eres un agente de soporte técnico de Nivel 1 para [Nombre de la Empresa]. Tu objetivo es diagnosticar y resolver problemas comunes de los usuarios basados en la base de conocimiento. Si no puedes resolverlo, debes escalar el caso.",
        rules = [],
        supportedProducts = '',
        commonSolutions = '',
        escalationPolicy = ''
    } = botData;

    const rulesConfig = buildRulesXml(rules);
    const driveLinksConfig = buildDriveLinksXml(botData.driveLinks);

    return [
        rulesConfig,
        `<agentRole>${escapeXml(agentRole)}</agentRole>`,
        `<supportedProducts>${escapeXml(supportedProducts)}</supportedProducts>`,
        `<knowledgeBase>${escapeXml(commonSolutions)}</knowledgeBase>`,
        driveLinksConfig,
        `<escalationPolicy>${escapeXml(escalationPolicy)}</escalationPolicy>`,
    ].filter(Boolean).join('\n').trim();
}

function buildAtencionClientePrompt(botData: BotData): string {
    const {
        agentRole = "Eres un agente de servicio al cliente.",
        rules = [],
        companyInfo = { name: '', supportHours: '' },
        knowledgeBase = '',
        escalationPolicy = ''
    } = botData;

    const rulesConfig = buildRulesXml(rules);
    const companyInfoConfig = `<companyInfo>\n    <name>${escapeXml(companyInfo.name)}</name>\n    <supportHours>${escapeXml(companyInfo.supportHours)}</supportHours>\n  </companyInfo>`;
    const driveLinksConfig = buildDriveLinksXml(botData.driveLinks);

    return [
        rulesConfig,
        `<agentRole>${escapeXml(agentRole)}</agentRole>`,
        companyInfoConfig,
        `<knowledgeBase>${escapeXml(knowledgeBase)}</knowledgeBase>`,
        driveLinksConfig,
        `<escalationPolicy>${escapeXml(escalationPolicy)}</escalationPolicy>`,
    ].filter(Boolean).join('\n').trim();
}

function buildAgenteInmobiliarioPrompt(botData: BotData): string {
    const {
        agentRole = "Eres un agente inmobiliario experto.",
        rules = [],
        agentInfo = { name: '', license: '' },
        propertyTypes = '',
        viewingInstructions = ''
    } = botData;
    
    const rulesConfig = buildRulesXml(rules);
    const agentInfoConfig = `<agentInfo>\n    <name>${escapeXml(agentInfo.name)}</name>\n    <license>${escapeXml(agentInfo.license)}</license>\n  </agentInfo>`;
    const driveLinksConfig = buildDriveLinksXml(botData.driveLinks);

    return [
        rulesConfig,
        `<agentRole>${escapeXml(agentRole)}</agentRole>`,
        agentInfoConfig,
        `<propertyTypes>${escapeXml(propertyTypes)}</propertyTypes>`,
        driveLinksConfig,
        `<viewingInstructions>${escapeXml(viewingInstructions)}</viewingInstructions>`,
    ].filter(Boolean).join('\n').trim();
}

function buildAsistentePersonalPrompt(botData: BotData): string {
    const {
        agentRole = "Eres un asistente personal altamente eficiente. Tu objetivo es gestionar mi agenda, tomar notas, recordar tareas y filtrar comunicaciones. Debes ser proactivo, discreto y aprender mis preferencias. Utiliza la herramienta `createAppointment` para agendar citas y `getFutureAppointments` para consultar citas existentes.",
        rules = [],
        userPreferences = '',
        taskInstructions = '',
    } = botData;

    const rulesConfig = buildRulesXml(rules);
    const driveLinksConfig = buildDriveLinksXml(botData.driveLinks);
    
     const toolsConfig = buildToolsConfigXml([
        { 
            name: 'createAppointment', 
            description: `Crea una nueva cita. Usa esto cuando un usuario confirma que quiere agendar algo. Parámetros requeridos: 'title' (string), 'date' (string, YYYY-MM-DD), 'startTime' (string, HH:mm), 'endTime' (string, HH:mm), 'userId' (string), 'organizationId' (string), 'timezone' (string), y 'contactPhone' (string, el número del usuario).`,
        },
        {
            name: 'getFutureAppointments',
            description: `OBLIGATORIO: Usa esta herramienta para consultar las próximas citas de un cliente. NO USES TU MEMORIA. Úsala cuando pregunten '¿cuándo es mi cita?', '¿qué citas tengo?', etc. Parámetros requeridos: 'contactPhone' (string, el número del usuario), 'userId' (string), y 'organizationId' (string).`,
        }
    ]);

    return [
        rulesConfig,
        `<agentRole>${escapeXml(agentRole)}</agentRole>`,
        `<userPreferences>${escapeXml(userPreferences)}</userPreferences>`,
        `<taskInstructions>${escapeXml(taskInstructions)}</taskInstructions>`,
        driveLinksConfig,
        toolsConfig,
    ].filter(Boolean).join('\n').trim();
}

async function buildPromptForBot(botData: BotData): Promise<{ promptXml: string; instanceIdAssociated?: string }> {
    let promptXml = '';
    
    switch (botData.category) {
        case 'Ventas':
            promptXml = buildVentasPrompt(botData);
            break;
        case 'Soporte Técnico':
            promptXml = buildSoporteTecnicoPrompt(botData);
            break;
        case 'Atención al Cliente':
            promptXml = buildAtencionClientePrompt(botData);
            break;
        case 'Agente Inmobiliario':
            promptXml = buildAgenteInmobiliarioPrompt(botData);
            break;
        case 'Asistente Personal':
            promptXml = buildAsistentePersonalPrompt(botData);
            break;
        default:
            promptXml = `<prompt><error>Categoría de bot no reconocida.</error></prompt>`;
    }
    
    let instanceIdAssociated: string | undefined = undefined;
    try {
        const instanceDocRef = doc(db, 'instances', botData.userId);
        const instanceDocSnap = await getDoc(instanceDocRef);
        if (instanceDocSnap.exists()) {
            instanceIdAssociated = instanceDocSnap.data().id;
        }
    } catch (error) {
        console.error("Error fetching instance ID for prompt builder:", error);
    }

    return { promptXml, instanceIdAssociated };
}


// --- Original Server Actions ---

export async function updateBotAndPrompt(botData: Partial<BotData>) {
  if (!botData || !botData.id) {
    throw new Error("Invalid bot data provided.");
  }

  // Fetch the original document to merge with, ensuring createdAt is preserved
  const botRef = doc(db, 'bots', botData.id);
  const botSnap = await getDoc(botRef);
  if (!botSnap.exists()) {
    throw new Error("Bot document not found.");
  }
  
  const originalData = botSnap.data();

  // Merge the new data with the original, keeping the original timestamp
  const dataToSave = {
      ...originalData,
      ...botData,
      createdAt: originalData.createdAt // Ensure timestamp is not overwritten
  };

  await setDoc(botRef, dataToSave, { merge: true });

  if (dataToSave.isActive) {
    const { promptXml, instanceIdAssociated } = await buildPromptForBot(dataToSave as BotData);
    const qybotConfigRef = doc(db, 'qybot', dataToSave.userId);
    await setDoc(qybotConfigRef, {
        activeBotId: dataToSave.id,
        promptXml: promptXml,
        instanceIdAssociated,
    }, { merge: true });
  }
}

export async function activateBot(botToActivate: BotData) {
    if (!botToActivate || !botToActivate.userId) {
        throw new Error("Invalid bot data for activation.");
    }
    const userId = botToActivate.userId;
    const batch = writeBatch(db);
    const botsCollectionRef = collection(db, 'bots');
    
    const q = (await getDocs(query(collection(db, 'bots'), where('userId', '==', userId))));
    q.forEach(doc => {
        if (doc.id !== botToActivate.id) {
            batch.update(doc.ref, { isActive: false });
        }
    });

    const activeBotRef = doc(botsCollectionRef, botToActivate.id);
    batch.update(activeBotRef, { isActive: true });
    
    const botWithActiveState = { ...botToActivate, isActive: true };
    const { promptXml, instanceIdAssociated } = await buildPromptForBot(botWithActiveState as BotData);
    const qybotConfigRef = doc(db, 'qybot', userId);

    batch.set(qybotConfigRef, {
      activeBotId: botToActivate.id,
      promptXml: promptXml,
      instanceIdAssociated: instanceIdAssociated,
    }, { merge: true });

    await batch.commit();
}


export async function migrateAndActivateLegacyBot(userId: string, legacyData: any) {
    const newBotData: Omit<BotData, 'id'> = {
        userId: userId,
        name: 'Bot de Ventas (Importado)',
        category: 'Ventas',
        isActive: true, 
        createdAt: legacyData.createdAt instanceof Timestamp ? legacyData.createdAt : Timestamp.now(),
        agentRole: legacyData.agentRole,
        selectedRules: legacyData.selectedRules || [],
        businessContext: legacyData.businessContext,
        serviceCatalog: legacyData.serviceCatalog || [],
        contact: legacyData.contact,
        closingMessage: legacyData.closingMessage,
        notificationPhoneNumber: legacyData.notificationPhoneNumber,
        notificationRule: legacyData.notificationRule,
    };

    const newBotDocRef = await addDoc(collection(db, 'bots'), newBotData);
    
    const botForPrompt = { id: newBotDocRef.id, ...newBotData };
    const { promptXml, instanceIdAssociated } = await buildPromptForBot(botForPrompt as BotData);

    const qybotConfigRef = doc(db, 'qybot', userId);
    await setDoc(qybotConfigRef, {
        activeBotId: newBotDocRef.id,
        promptXml: promptXml,
        instanceIdAssociated,
    }, { merge: true });
}
