
'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

/**
 * Server Action to remove a team member.
 * For now, this only deletes the user document from Firestore.
 * Firebase Auth user deletion is disabled to avoid admin SDK configuration issues.
 * @param uid The UID of the user to remove.
 * @returns An object indicating success or failure.
 */
export async function removeTeamMemberAction(uid: string): Promise<{ success: boolean; error?: string }> {
  if (!uid) {
    return { success: false, error: 'User ID is required.' };
  }

  try {
    const userDocRef = doc(db, 'users', uid);
    await deleteDoc(userDocRef);
    console.log(`Successfully deleted user document ${uid} from Firestore.`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting user document ${uid} from Firestore:`, error);
    return { success: false, error: 'Failed to delete user document from database.' };
  }
}
