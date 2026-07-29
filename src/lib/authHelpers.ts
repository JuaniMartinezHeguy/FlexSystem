/**
 * Convierte un DNI a la convención de correo sintético interno para Supabase Auth.
 * Ejemplo: DNI '40123456' -> '+40123456@gimnasio.local'
 */
export function dniToEmail(dni: string): string {
  const cleanDni = dni.trim().replace(/\D/g, '');
  return `+${cleanDni}@gimnasio.local`;
}

/**
 * Extrae el DNI a partir de un correo sintético de Supabase Auth.
 */
export function emailToDni(email: string): string {
  if (!email || !email.includes('@gimnasio.local')) return '';
  return email.split('@')[0].replace('+', '');
}

/**
 * Genera la contraseña inicial por defecto para un nuevo alumno al dar de alta.
 */
export function generateInitialPassword(dni: string): string {
  const cleanDni = dni.trim().replace(/\D/g, '');
  return cleanDni; // La clave inicial es su propio DNI
}
