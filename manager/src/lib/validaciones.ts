/** Validaciones ecuatorianas (las mismas reglas que aplica la base de datos). */
export function validarCedula(c: string): boolean {
  if (!/^\d{10}$/.test(c)) return false;
  const prov = Number(c.slice(0, 2));
  if (prov < 1 || (prov > 24 && prov !== 30)) return false;
  if (Number(c[2]) > 5) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    suma += d;
  }
  return (10 - (suma % 10)) % 10 === Number(c[9]);
}

export function validarRuc(r: string): boolean {
  if (!/^\d{13}$/.test(r) || r.slice(10) === '000') return false;
  const tercer = Number(r[2]);
  const mod11 = (coef: number[], pos: number) => {
    const suma = coef.reduce((s, k, i) => s + Number(r[i]) * k, 0);
    const resto = suma % 11;
    return (resto === 0 ? 0 : 11 - resto) === Number(r[pos]);
  };
  if (tercer < 6) return validarCedula(r.slice(0, 10));
  if (tercer === 9) return mod11([4, 3, 2, 7, 6, 5, 4, 3, 2], 9);
  if (tercer === 6) return mod11([3, 2, 7, 6, 5, 4, 3, 2], 8);
  return false;
}

/** 0983890036 → 593983890036 (formato para wa.me) */
export function normalizarTelefono(t: string | null | undefined): string | null {
  const d = (t ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('593')) return d;
  if (d.startsWith('0') && d.length === 10) return '593' + d.slice(1);
  if (d.length === 9 && d.startsWith('9')) return '593' + d;
  return d;
}

export const enlaceWhatsApp = (tel: string | null | undefined, texto?: string) => {
  const n = normalizarTelefono(tel);
  if (!n) return null;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
};
