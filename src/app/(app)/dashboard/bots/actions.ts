
'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, collection, addDoc, Timestamp } from 'firebase/firestore';
import { buildPromptForBot } from '@/lib/bot-prompt-builder';
import type { BotData } from './page';


export async function updateBotAndPrompt(botData: BotData) {
  if (!botData || !botData.id) {
    throw new Error("Invalid bot data provided.");
  }

  const botRef = doc(db, 'bots', botData.id);
  await setDoc(botRef, botData, { merge: true });

  if (botData.isActive) {
    const { promptXml, instanceIdAssociated } = await buildPromptForBot(botData);
    const qybotConfigRef = doc(db, 'qybot', botData.userId);
    await setDoc(qybotConfigRef, {
        activeBotId: botData.id,
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
    
    // Deactivate all other bots for this user
    const q = (await db.collection('bots').where('userId', '==', userId).get());
    q.forEach(doc => {
        if (doc.id !== botToActivate.id) {
            batch.update(doc.ref, { isActive: false });
        }
    });

    // Activate the selected bot
    const activeBotRef = doc(botsCollectionRef, botToActivate.id);
    batch.update(activeBotRef, { isActive: true });
    
    // Generate and save the active prompt config to the main 'qybot' document
    const botWithActiveState = { ...botToActivate, isActive: true };
    const { promptXml, instanceIdAssociated } = await buildPromptForBot(botWithActiveState);
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
