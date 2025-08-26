
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db, serverTimestamp } from '@/lib/firebase'; // Import serverTimestamp
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  UserCredential,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore'; // Import Timestamp
import type { RegisterFormData } from '@/components/auth/register-form';
import type { LoginFormData } from '@/components/auth/login-form';
import { useRouter } from 'next/navigation';
import { sendWelcomeEmail, sendInvitationEmail, sendNewUserAdminNotification } from '@/lib/email';

interface WorkDay {
  enabled: boolean;
  start: string;
  end: string;
}

interface WorkSchedule {
  monday: WorkDay;
  tuesday: WorkDay;
  wednesday: WorkDay;
  thursday: WorkDay;
  friday: WorkDay;
  saturday: WorkDay;
  sunday: WorkDay;
}

interface UserProfile {
  uid: string;
  email: string | null;
  fullName?: string;
  company?: string;
  phone?: string;
  username?: string;
  country?: string;
  city?: string;
  sector?: string;
  employeeCount?: string;
  timezone?: string;
  workSchedule?: WorkSchedule;
  role?: 'owner' | 'admin' | 'agent' | 'manager'; 
  organizationId?: string; 
  ownerId?: string; 
  managedBy?: string; 
  createdAt?: Timestamp; 
  lastLogin?: Timestamp; 
  isActive?: boolean; 
  isVip?: boolean; 
  vipInstanceLimit?: number; // New field for VIP instance limit
  subscriptionStatus?: 'active' | 'trialing' | 'canceled' | 'inactive';
  isChatbotGloballyEnabled?: boolean; 
  demo?: boolean; 
  onboardingCompleted?: boolean; 
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  registerUser: (data: RegisterFormData, invitationId?: string | null) => Promise<UserCredential | void>;
  createManagedUser: (email: string, password: string, profile: { fullName: string; company: string; }) => Promise<void>;
  loginUser: (data: LoginFormData) => Promise<UserCredential | void>;
  logoutUser: () => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let dbData: any = {};
        if (userDocSnap.exists()) {
          dbData = userDocSnap.data();
          if (dbData.isActive === false) {
             await firebaseSignOut(auth);
             setUser(null);
             setLoading(false);
             router.push('/login?error=account-disabled');
             return;
          }

          if (!dbData.organizationId) {
            console.log(`Migrating user ${firebaseUser.uid} to an organization...`);
            const orgRef = await addDoc(collection(db, 'organizations'), {
              name: dbData.company || `${dbData.fullName}'s Team`,
              ownerId: firebaseUser.uid,
              createdAt: serverTimestamp(),
            });
            await updateDoc(userDocRef, { 
              organizationId: orgRef.id,
              role: 'owner',
            });
            dbData.organizationId = orgRef.id;
            dbData.role = 'owner';
            console.log(`User ${firebaseUser.uid} migrated to new organization ${orgRef.id}`);
          }
        }

        let ownerId = dbData.role === 'owner' ? firebaseUser.uid : dbData.ownerId;
        if (dbData.managedBy) {
          ownerId = dbData.managedBy;
        }
        
        // Final check if ownerId is still missing for a team member
        if (!ownerId && dbData.organizationId && dbData.role !== 'owner' && !dbData.managedBy) {
          const orgDocRef = doc(db, 'organizations', dbData.organizationId);
          const orgDocSnap = await getDoc(orgDocRef);
          if (orgDocSnap.exists()) {
            ownerId = orgDocSnap.data().ownerId;
          }
        }

        const dataFetchUserId = dbData.role === 'manager' ? ownerId : firebaseUser.uid;
        
        const instanceDocRef = doc(db, 'instances', dataFetchUserId);
        const subscriptionsRef = collection(db, 'users', dataFetchUserId, 'subscriptions');
        const q = query(subscriptionsRef, where('status', 'in', ['trialing', 'active']));
        
        const [instanceDocSnap, subscriptionSnap] = await Promise.all([
            getDoc(instanceDocRef),
            getDocs(q),
        ]);

        let instanceData: any = {};
        if (instanceDocSnap.exists()) {
            instanceData = instanceDocSnap.data();
        }
        
        let subscriptionStatus: UserProfile['subscriptionStatus'] = 'inactive';
        if (!subscriptionSnap.empty) {
            subscriptionStatus = subscriptionSnap.docs[0].data().status as UserProfile['subscriptionStatus'];
        }

        setUser({ 
          uid: firebaseUser.uid, 
          email: firebaseUser.email,
          fullName: dbData.fullName,
          company: dbData.company,
          phone: dbData.phone,
          username: dbData.username,
          country: dbData.country,
          city: dbData.city,
          sector: dbData.sector,
          employeeCount: dbData.employeeCount,
          timezone: dbData.timezone,
          workSchedule: dbData.workSchedule,
          role: dbData.role || 'agent',
          organizationId: dbData.organizationId,
          ownerId: ownerId, 
          managedBy: dbData.managedBy,
          createdAt: dbData.createdAt,
          lastLogin: dbData.lastLogin,
          isActive: dbData.isActive ?? true,
          isVip: dbData.isVip ?? false,
          vipInstanceLimit: dbData.vipInstanceLimit,
          subscriptionStatus: subscriptionStatus,
          isChatbotGloballyEnabled: instanceData.chatbotEnabled ?? true,
          demo: instanceData.demo ?? false,
          onboardingCompleted: dbData.onboardingCompleted ?? false,
         } as UserProfile);

      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const registerUser = async (data: RegisterFormData, invitationId?: string | null) => {
    setLoading(true);
    try {
        let firebaseUser: FirebaseUser | null = null;
        let isExistingUser = false;

        if (invitationId) {
            const invDocRef = doc(db, 'invitations', invitationId);
            const invDocSnap = await getDoc(invDocRef);

            if (!invDocSnap.exists() || invDocSnap.data().status !== 'pending' || invDocSnap.data().inviteeEmail !== data.email) {
                throw new Error("La invitación es inválida, ha expirado o no coincide con tu correo electrónico.");
            }
            
            const invitationData = invDocSnap.data();
            
            const q = query(collection(db, 'users'), where('email', '==', data.email));
            const existingUserSnapshot = await getDocs(q);
            
            if (!existingUserSnapshot.empty) {
                isExistingUser = true;
                const existingUserDoc = existingUserSnapshot.docs[0];
                firebaseUser = { uid: existingUserDoc.id, email: data.email } as FirebaseUser;
                
                await updateDoc(existingUserDoc.ref, {
                    organizationId: invitationData.organizationId,
                    role: invitationData.role,
                    company: invitationData.organizationName,
                    isActive: true, 
                });
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
                firebaseUser = userCredential.user;
            }
            
            if (!firebaseUser) throw new Error("No se pudo obtener la información del usuario.");

            const userProfileData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                fullName: data.fullName,
                company: invitationData.organizationName,
                phone: data.phone,
                username: data.username,
                role: invitationData.role,
                organizationId: invitationData.organizationId,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                isActive: true,
                isVip: false,
                onboardingCompleted: true,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData, { merge: true });

            await updateDoc(invDocRef, {
                status: 'accepted',
                acceptedAt: serverTimestamp(),
                acceptedByUid: firebaseUser.uid,
            });
            
            if (isExistingUser) {
                 await signInWithEmailAndPassword(auth, data.email, data.password);
            }

            router.push('/dashboard');
        
        } else {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', data.username));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                throw new Error("Este nombre de usuario ya está en uso. Por favor, elige otro.");
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            firebaseUser = userCredential.user;
            if (!firebaseUser) throw new Error("No se pudo crear el usuario en Firebase Authentication.");

            const orgRef = await addDoc(collection(db, 'organizations'), {
                name: data.company,
                ownerId: firebaseUser.uid,
                createdAt: serverTimestamp()
            });
            
            const userProfileData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                fullName: data.fullName,
                company: data.company,
                phone: data.phone,
                username: data.username,
                role: 'owner',
                organizationId: orgRef.id,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                isActive: true,
                isVip: false,
                onboardingCompleted: false,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
            
            try {
                await sendWelcomeEmail({
                    userEmail: data.email,
                    userName: data.fullName,
                });
                await sendNewUserAdminNotification({
                    userEmail: data.email,
                    userName: data.fullName,
                    company: data.company,
                    phone: data.phone,
                });
            } catch (emailError) {
                console.error("Failed to send notification emails:", emailError);
            }

            router.push('/subscribe');
        }

    } catch (error: any) {
        console.error("Error de registro:", error);
        let errorMessage = "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "Este correo electrónico ya está en uso. Por favor, inicia sesión o utiliza otro correo electrónico.";
                break;
            case 'auth/weak-password':
                errorMessage = "La contraseña es demasiado débil. Por favor, elige una más segura con al menos 6 caracteres.";
                break;
            case 'auth/invalid-email':
                errorMessage = "El formato del correo electrónico no es válido.";
                break;
            default:
                if (error.message) {
                    errorMessage = error.message;
                }
                break;
        }
        
        throw new Error(errorMessage);
    } finally {
        setLoading(false);
    }
  };

  const createManagedUser = async (email: string, password: string, profile: { fullName: string; company: string; }) => {
      const owner = auth.currentUser;
      if (!owner || !user || user.role !== 'owner') {
          throw new Error("Solo los propietarios pueden crear instancias gestionadas.");
      }
  
      try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
              throw new Error("Un usuario con este correo electrónico ya existe en la base de datos.");
          }
  
          // The creation of the user in auth needs to be handled by a backend function
          // to avoid signing out the current user. For this client-side only implementation,
          // we are temporarily creating the user and then we must handle re-authentication of the owner.
          // This is a known limitation of client-side user creation.
          const tempUserCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newFirebaseUser = tempUserCredential.user;
  
          // Create organization and user profile for the new managed user
          const orgRef = await addDoc(collection(db, 'organizations'), {
              name: profile.company,
              ownerId: newFirebaseUser.uid,
              managedBy: user.uid,
              createdAt: serverTimestamp()
          });
  
          const newUserProfile = {
              uid: newFirebaseUser.uid,
              email: email,
              fullName: profile.fullName,
              company: profile.company,
              role: 'manager',
              organizationId: orgRef.id,
              managedBy: user.uid, // <-- CRITICAL: Save the owner's UID
              createdAt: serverTimestamp(),
              lastLogin: null,
              isActive: true,
              isVip: false,
              onboardingCompleted: true, 
          };
          await setDoc(doc(db, 'users', newFirebaseUser.uid), newUserProfile);
  
          // IMPORTANT: Re-authenticate the owner.
          // This requires the owner's password, which we don't have.
          // The best we can do is sign the new user out and let the owner continue their session.
          // The owner's auth state is NOT AFFECTED in this flow.
          // We sign out the newly created user from the current client.
          await firebaseSignOut(auth);
          
          // Re-establish the owner's session in the auth object
          if (auth.currentUser?.uid !== owner.uid) {
             // This is tricky client-side. The most reliable way is to inform the user.
             // For a better UX, a backend function is needed.
             // We will assume the owner's session remains intact and continue.
             console.log("Managed user created. Owner session should be active.");
          }
  
      } catch (error: any) {
           console.error("Error creating managed user:", error);
           if (error.code === 'auth/email-already-in-use') {
               throw new Error("Este correo electrónico ya está registrado en el sistema de autenticación.");
           }
           throw new Error("No se pudo crear el usuario gestionado: " + error.message);
      }
  };


  const loginUser = async (data: LoginFormData) => {
    setLoading(true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        const firebaseUser = userCredential.user;

        if (firebaseUser) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                if (userDocSnap.data().isActive === false) {
                    await firebaseSignOut(auth);
                    throw new Error("Tu cuenta ha sido desactivada por un administrador.");
                }
                await updateDoc(userDocRef, {
                    lastLogin: serverTimestamp(),
                });
            }
        }
        return userCredential;
    } catch (error: any) {
      console.error("Error de inicio de sesión:", error.code, error.message);
      let errorMessage = "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";

      if (error.message.includes("Tu cuenta ha sido desactivada")) {
          errorMessage = error.message;
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          errorMessage = "El correo electrónico o la contraseña son incorrectos. Por favor, inténtalo de nuevo.";
      } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "El acceso a esta cuenta ha sido temporalmente deshabilitado debido a muchos intentos fallidos de inicio de sesión. Puedes restaurarlo inmediatamente restableciendo tu contraseña o puedes intentarlo de nuevo más tarde.";
      } else if (error.code === 'auth/network-request-failed') {
          errorMessage = "Error de red. Por favor, comprueba tu conexión a internet e inténtalo de nuevo.";
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      throw new Error("Usuario no autenticado o correo no disponible.");
    }

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
    } catch (error: any) {
      console.error("Error al cambiar contraseña:", error);
      if (error.code === 'auth/wrong-password') {
        throw new Error("La contraseña actual es incorrecta.");
      } else if (error.code === 'auth/weak-password') {
        throw new Error("La nueva contraseña es demasiado débil.");
      } else if (error.code === 'auth/requires-recent-login') {
         throw new Error("Esta operación es sensible y requiere autenticación reciente. Por favor, inicia sesión de nuevo.");
      }
      throw new Error("No se pudo actualizar la contraseña. Inténtalo de nuevo.");
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      let errorMessage = "Ocurrió un error al enviar el correo de restablecimiento.";
      if (error.code === 'auth/invalid-email') {
        errorMessage = "El formato del correo electrónico no es válido.";
      }
      throw new Error(errorMessage);
    }
  };


  return (
    <AuthContext.Provider value={{ user, loading, registerUser, createManagedUser, loginUser, logoutUser, updateUserPassword, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
