// Implementación segura para SSR y CSR
export const generateSafeId = (): string => {
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto.randomUUID();
    }
  
    // Fallback para Node.js y navegadores antiguos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };