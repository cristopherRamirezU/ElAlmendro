import {
  aplicarColorMarcaEnDocumento,
  colorConAlfa,
  colorRgb,
  colorSecundarioDeMarca,
  colorTextoSobre,
  luminanciaRelativa,
  parseHex,
} from '@/lib/color';

describe('Utilidades de color y contraste WCAG', () => {
  it('parseHex soporta #rrggbb, #rgb, sin numeral y usa celeste por defecto en formatos invalidos', () => {
    expect(parseHex('#0ea5e9')).toEqual([14, 165, 233]);
    expect(parseHex('#f0a')).toEqual([255, 0, 170]);
    expect(parseHex('10b981')).toEqual([16, 185, 129]);
    expect(parseHex('no-es-hex')).toEqual([14, 165, 233]);
  });

  it('colorRgb y colorConAlfa formatean canales RGB correctamente', () => {
    expect(colorRgb('#ffffff')).toBe('255, 255, 255');
    expect(colorConAlfa('#0ea5e9', 0.25)).toBe('rgba(14, 165, 233, 0.25)');
  });

  it('luminanciaRelativa respeta los extremos y orden monotono', () => {
    expect(luminanciaRelativa('#000000')).toBe(0);
    expect(luminanciaRelativa('#ffffff')).toBe(1);
    expect(luminanciaRelativa('#334155')).toBeLessThan(luminanciaRelativa('#e2e8f0'));
  });

  it('colorTextoSobre garantiza contraste oscuro sobre fondos claros y blanco sobre oscuros', () => {
    expect(colorTextoSobre('#ffffff')).toBe('#0f172a');
    expect(colorTextoSobre('#facc15')).toBe('#0f172a');
    expect(colorTextoSobre('#a3e635')).toBe('#0f172a');
    expect(colorTextoSobre('#0f172a')).toBe('#ffffff');
    expect(colorTextoSobre('#0ea5e9')).toBe('#ffffff');
    expect(colorTextoSobre('#4f46e5')).toBe('#ffffff');
    expect(colorTextoSobre('#dc2626')).toBe('#ffffff');
  });

  it('colorSecundarioDeMarca genera hex validos en todo el circulo cromatico y neutros', () => {
    for (const muestra of ['#0ea5e9', '#f59e0b', '#eab308', '#10b981', '#8b5cf6', '#f43f5e', '#475569']) {
      expect(colorSecundarioDeMarca(muestra)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('aplicarColorMarcaEnDocumento inyecta todas las variables CSS de marca en un Document', () => {
    const vars = new Map<string, string>();
    const docMock = {
      documentElement: {
        style: {
          setProperty: (clave: string, valor: string) => vars.set(clave, valor),
        },
      },
    } as unknown as Document;

    aplicarColorMarcaEnDocumento(docMock, '#10b981');

    expect(vars.get('--color-primario')).toBe('#10b981');
    expect(vars.get('--color-primario-2')).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars.get('--tf-primario-rgb')).toBe('16, 185, 129');
    expect(vars.get('--tf-primario-2-rgb')).toBeTruthy();
    expect(vars.get('--tf-texto-primario')).toBe('#ffffff');
  });
});
