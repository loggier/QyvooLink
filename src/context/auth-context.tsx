
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
import { doc, setDoc, getDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore'; // Import Timestamp
import type { RegisterFormData } from '@/components/auth/register-form';
import type { LoginFormData } from '@/components/auth/login-form';
import { useRouter } from 'next/navigation';

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
  role?: 'admin' | 'user'; // User role
  createdAt?: Timestamp; // Registration date
  isActive?: boolean; // Account status
  isVip?: boolean; // VIP access flag
  subscriptionStatus?: 'active' | 'trialing' | 'canceled' | 'inactive';
  isChatbotGloballyEnabled?: boolean; // Global bot status
  demo?: boolean; // Demo mode status
  onboardingCompleted?: boolean; // Onboarding status
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  registerUser: (data: RegisterFormData) => Promise<UserCredential | void>;
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
        // Fetch all user-related data in parallel
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const instanceDocRef = doc(db, 'instances', firebaseUser.uid);
        const subscriptionsRef = collection(db, 'users', firebaseUser.uid, 'subscriptions');
        const q = query(subscriptionsRef, where('status', 'in', ['trialing', 'active']));
        
        const [userDocSnap, instanceDocSnap, subscriptionSnap] = await Promise.all([
            getDoc(userDocRef),
            getDoc(instanceDocRef),
            getDocs(q),
        ]);
        
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
        }

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
          role: dbData.role || 'user',
          createdAt: dbData.createdAt,
          isActive: dbData.isActive ?? true,
          isVip: dbData.isVip ?? false,
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

  const registerUser = async (data: RegisterFormData) => {
    setLoading(true);
    try {
      // Check for unique username
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', data.username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        throw new Error("Este nombre de usuario ya está en uso. Por favor, elige otro.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;
      if (firebaseUser) {
        const userProfileData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          fullName: data.fullName,
          company: data.company,
          phone: data.phone,
          username: data.username,
          country: '', 
          city: '',
          sector: '',
          employeeCount: '',
          role: 'user', 
          createdAt: serverTimestamp(),
          isActive: true,
          isVip: false,
          onboardingCompleted: false, // Set onboarding to false for new users
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
        
        // onAuthStateChanged will handle the user state update.
        // We redirect to the subscription page immediately.
        router.push('/subscribe'); 
        return userCredential;
      }
    } catch (error: any) {
      console.error("Error de registro:", error);
      let errorMessage = error.message || "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este correo electrónico ya está en uso. Por favor, intenta con otro.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "La contraseña es demasiado débil. Por favor, elige una más segura.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "El formato del correo electrónico no es válido.";
      }
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (data: LoginFormData) => {
    setLoading(true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        const firebaseUser = userCredential.user;

        // The onAuthStateChanged listener will handle redirecting and setting user state.
        // We just need to check for active status here as a pre-check.
        if (firebaseUser) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDocSnap.data().isActive === false) {
                await firebaseSignOut(auth);
                throw new Error("Tu cuenta ha sido desactivada por un administrador.");
            }
        }
        // Redirect will be handled by onAuthStateChanged and the layout component logic
        return userCredential;
    } catch (error: any) {
      console.error("Error de inicio de sesión:", error.code, error.message);
      let errorMessage = "El correo electrónico o la contraseña son incorrectos. Por favor, inténtalo de nuevo.";

      if (error.message.includes("Tu cuenta ha sido desactivada")) {
          errorMessage = error.message;
      } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "El acceso a esta cuenta ha sido temporalmente deshabilitado debido a muchos intentos fallidos de inicio de sesión. Puedes restaurarlo inmediatamente restableciendo tu contraseña o puedes intentarlo de nuevo más tarde.";
      } else if (error.code === 'auth/network-request-failed') {
          errorMessage = "Error de red. Por favor, comprueba tu conexión a internet e inténtalo de nuevo.";
      }
      // For auth/user-not-found, auth/wrong-password, and auth/invalid-credential, we use the generic message to prevent user enumeration.
      
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
    <AuthContext.Provider value={{ user, loading, registerUser, loginUser, logoutUser, updateUserPassword, sendPasswordReset }}>
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
