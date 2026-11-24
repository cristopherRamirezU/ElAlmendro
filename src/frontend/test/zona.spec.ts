import { nombreZona } from '@/lib/zona';

describe('Utilidades de zona horaria', () => {
  it('nombreZona maneja valores nulos/vacios sin lanzar error y formatea zonas IANA o simples', () => {
    expect(nombreZona(undefined)).toBe('');
    expect(nombreZona(null)).toBe('');
    expect(nombreZona('')).toBe('');

    const santiago = nombreZona('America/Santiago');
    expect(santiago).toContain('Santiago (America)');
    expect(santiago).toContain('GMT');

    const utc = nombreZona('UTC');
    expect(utc.startsWith('UTC')).toBe(true);
    expect(utc.endsWith(' · ')).toBe(false);
  });
});
