
import type { BotData, DriveLink } from '@/app/(app)/dashboard/bots/page';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
        .filter(link => link.url && link.type) // Ensure link and type are not empty
        .map(link => `<document type="${escapeXml(link.type)}">${escapeXml(link.url)}</document>`)
        .join('\n    ');

    if (!documents) return ''; // Don't create the parent tag if there are no valid links

    return `<driveDocuments>\n    ${documents}\n  </driveDocuments>`;
}

function buildVentasPrompt(botData: BotData): string {
    const {
        agentRole = "Eres un asistente de ventas virtual.",
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

    return [
        rulesConfig,
        `<agentRole>${escapeXml(agentRole)}</agentRole>`,
        businessContextConfig,
        serviceCatalogConfigSection,
        driveLinksConfig,
        contactConfig,
        `<closingMessage>${escapeXml(closingMessage)}</closingMessage>`,
        notificationConfig,
    ].filter(Boolean).join('\n').trim();
}

function buildSoporteTecnicoPrompt(botData: BotData): string {
    const {
        agentRole = "Eres un agente de soporte técnico de Nivel 1.",
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
        agentRole = "Eres un asistente personal eficiente y proactivo.",
        rules = [],
        userPreferences = '',
        taskInstructions = '',
        calendarLink = ''
    } = botData;

    const rulesConfig = buildRulesXml(rules);
    const driveLinksConfig = buildDriveLinksXml(botData.driveLinks);

    return [
        rulesConfig,
        `<agentRole>${escapeXml(agentRole)}</agentRole>`,
        `<userPreferences>${escapeXml(userPreferences)}</userPreferences>`,
        `<taskInstructions>${escapeXml(taskInstructions)}</taskInstructions>`,
        driveLinksConfig,
        `<calendarLink>${escapeXml(calendarLink)}</calendarLink>`,
    ].filter(Boolean).join('\n').trim();
}


export async function buildPromptForBot(botData: BotData): Promise<{ promptXml: string; instanceIdAssociated?: string }> {
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
    
    // Fetch instanceId from the instance document
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
