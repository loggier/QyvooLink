
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
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'; // Import Timestamp
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
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const dbData = userDocSnap.data();
          
          if (dbData.isActive === false) {
             await firebaseSignOut(auth);
             setUser(null);
             setLoading(false);
             // Optionally, show a toast message here before redirecting.
             router.push('/login?error=account-disabled');
             return;
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
            role: dbData.role || 'user', // Set role, default to 'user'
            createdAt: dbData.createdAt,
            isActive: dbData.isActive ?? true,
           } as UserProfile);
        } else {
          // Basic profile if not found in Firestore
          setUser({ 
            uid: firebaseUser.uid, 
            email: firebaseUser.email,
            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || undefined,
            role: 'user',
            isActive: true,
          });
        }
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
          role: 'user', // Default role for new users
          createdAt: serverTimestamp(), // Set registration timestamp
          isActive: true, // Default account status
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
        
        // We need to refetch the data to get the server-generated timestamp
        const newUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        setUser(newUserDoc.data() as UserProfile);

        router.push('/dashboard');
        return userCredential;
      }
    } catch (error: any) {
      console.error("Error de registro:", error);
      let errorMessage = "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este correo electrónico ya está en uso. Por favor, intenta con otro.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "La contraseña es demasiado débil. Por favor, elige una más segura.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "El formato del correo electrónico no es válido.";
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = "Error de configuración de autenticación. Contacta al administrador.";
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
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const dbData = userDocSnap.data();
          if (dbData.isActive === false) {
             await firebaseSignOut(auth);
             throw new Error("Tu cuenta ha sido desactivada por un administrador.");
          }
          const userProfile: UserProfile = { 
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
          };
          setUser(userProfile);
          if (userProfile.role === 'admin') {
            router.push('/admin/dashboard');
          } else {
            router.push('/dashboard');
          }
        } else {
           const basicProfile: UserProfile = { 
            uid: firebaseUser.uid, 
            email: firebaseUser.email,
            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || undefined,
            role: 'user',
            isActive: true,
          };
           setUser(basicProfile);
           router.push('/dashboard');
        }
        return userCredential;
      }
    } catch (error: any) {
      console.error("Error de inicio de sesión:", error);
      let errorMessage = error.message || "Correo electrónico o contraseña inválidos. Por favor, inténtalo de nuevo.";
       if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Correo electrónico o contraseña incorrectos.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "El formato del correo electrónico no es válido.";
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = "Error de configuración de autenticación. Contacta al administrador.";
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
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = "Error de configuración de autenticación. Contacta al administrador.";
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
