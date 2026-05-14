'use strict';

/* ===== DATOS DE FILAMENTOS (Precios reales ARTILLERY / 3DTRONIX) ===== */
const FILAMENTS = {
  pla_normal:  { name: 'PLA Normal',                 pricePerKg: 18,  density: 1.24, hint: 'Marca ARTILLERY · PLA estándar · $18/kg (Promo 3DTRONIX)' },
  pla_silk:    { name: 'PLA Silk',                   pricePerKg: 20,  density: 1.24, hint: 'Marca ARTILLERY · Acabado brillante sedoso · $20/kg' },
  pla_especial:{ name: 'PLA Especial',               pricePerKg: 21,  density: 1.24, hint: 'Arcoíris, madera, mármol, fluorescente, bicolor/tricolor · $21/kg' },
  tpu:         { name: 'TPU / Flexible',             pricePerKg: 28,  density: 1.21, hint: 'Flexible y resistente · $28/kg' },
  tecnico:     { name: 'Técnico (Nylon/FC/ASA)',     pricePerKg: 25,  density: 1.10, hint: 'Nylon, Fibra de carbono, ASA · $25/kg (alta resistencia)' },
  abs:         { name: 'ABS',                        pricePerKg: 20,  density: 1.04, hint: 'ABS blanco/negro · $20/kg' },
  petg:        { name: 'PETG',                       pricePerKg: 20,  density: 1.27, hint: 'PETG · $20/kg · Buena resistencia química' },
};

/* Velocidad de impresión aproximada en g/hora según calidad */
const PRINT_SPEED_G_PER_H = {
  draft:    60,
  standard: 38,
  fine:     18,
  ultra:    8,
};

/* Multiplicador de tiempo según soportes */
const SUPPORT_TIME_MULT = {
  none:    1.00,
  normal:  1.20,
  complex: 1.45,
};

/* Costo de mano de obra por post-procesado ($/unidad base, escala con peso) */
const POSTPROCESS_BASE_COST = {
  none:     0,
  sanding:  1.5,
  painting: 4.0,
  full:     8.0,
};

/* Factor de precio extra por complejidad de figura */
const COMPLEXITY_FACTOR = {
  simple:  0.00,
  medium:  0.15,
  complex: 0.30,
};

/* ===== ESTADO ===== */
const state = {
  supports:    'none',
  postprocess: 'none',
  complexity:  'simple',
};

/* ===== DOM ===== */
const $ = id => document.getElementById(id);

/* ===== TOGGLE BUTTONS ===== */
function initToggleGroups() {
  ['supports', 'postprocess', 'complexity'].forEach(groupId => {
    const group = $(groupId);
    group.addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state[groupId] = btn.dataset.value;
      calculate();
    });
  });
}

/* ===== LECTURA DE INPUTS ===== */
function readInputs() {
  const filamentKey  = $('filament').value;
  const weight       = Math.max(1, parseFloat($('weight').value) || 50);
  const infill       = Math.min(100, Math.max(5, parseFloat($('infill').value) || 20));
  const qty          = Math.max(1, parseInt($('qty').value) || 1);
  const machineRate  = Math.max(0, parseFloat($('machine-rate').value) || 1);
  const marginPct    = Math.max(0, parseFloat($('margin').value) || 40);
  const failPct      = Math.max(0, Math.min(100, parseFloat($('fail-rate').value) || 5));
  const shipping     = Math.max(0, parseFloat($('shipping').value) || 0);
  const quality      = document.querySelector('input[name="quality"]:checked')?.value || 'standard';

  return { filamentKey, weight, infill, qty, machineRate, marginPct, failPct, shipping, quality };
}

/* ===== CÁLCULO PRINCIPAL ===== */
function calculate() {
  const { filamentKey, weight, infill, qty, machineRate, marginPct, failPct, shipping, quality } = readInputs();
  const fil = FILAMENTS[filamentKey];

  /* -- Material -- */
  const pricePerGram   = fil.pricePerKg / 1000;
  const materialCost   = weight * pricePerGram;                         // por unidad

  /* -- Tiempo de impresión -- */
  const baseSpeedGH    = PRINT_SPEED_G_PER_H[quality];
  const speedGH        = baseSpeedGH * (1 - (infill - 20) * 0.003);    // ajuste leve por infill
  const printTimeH     = (weight / speedGH) * SUPPORT_TIME_MULT[state.supports];

  /* -- Máquina -- */
  const machineCost    = printTimeH * machineRate;                       // por unidad

  /* -- Mano de obra / Post-procesado -- */
  const baseLabor      = POSTPROCESS_BASE_COST[state.postprocess];
  const laborCost      = baseLabor * (1 + weight / 200);                // escala con peso

  /* -- Complejidad -- */
  const complexityCost = (materialCost + machineCost) * COMPLEXITY_FACTOR[state.complexity];

  /* -- Subtotal por unidad -- */
  const subtotalUnit   = materialCost + machineCost + laborCost + complexityCost;

  /* -- Falla -- */
  const failCost       = subtotalUnit * (failPct / 100);

  /* -- Total de costo (todas las unidades + envío) -- */
  const totalCost      = (subtotalUnit + failCost) * qty + shipping;

  /* -- Ganancia -- */
  const profit         = totalCost * (marginPct / 100);

  /* -- Precio de venta -- */
  const salePrice      = totalCost + profit;
  const pricePerUnit   = salePrice / qty;

  /* -- Longitud de filamento (aprox) -- */
  const filamentMeters = (weight / (fil.density * Math.PI * (1.75 / 2) ** 2 * 100)).toFixed(2);

  /* ===== ACTUALIZAR DOM ===== */
  const fmt = v => '$' + v.toFixed(2);

  $('r-material').textContent     = fmt(materialCost * qty);
  $('r-machine').textContent      = fmt(machineCost * qty);
  $('r-labor').textContent        = fmt(laborCost * qty);
  $('r-complexity').textContent   = fmt(complexityCost * qty);
  $('r-fail').textContent         = fmt(failCost * qty);
  $('r-shipping').textContent     = fmt(shipping);
  $('r-cost').textContent         = fmt(totalCost);
  $('r-profit').textContent       = '+' + fmt(profit);
  $('r-total').textContent        = fmt(salePrice);
  $('r-unit').textContent         = fmt(pricePerUnit);
  $('r-qty-label').textContent    = qty;
  $('r-margin-label').textContent = marginPct;

  /* Tiempo */
  const totalPrintH = printTimeH * qty;
  const hours = Math.floor(totalPrintH);
  const mins  = Math.round((totalPrintH - hours) * 60);
  $('r-time').textContent = hours > 0
    ? `${hours}h ${mins}min`
    : `${mins} min`;

  /* Filamento */
  $('r-filament-used').textContent = `${(weight * qty).toFixed(0)} g (~${(filamentMeters * qty)} m)`;

  /* Hint del filamento */
  $('filament-hint').textContent = fil.hint;
}

/* ===== IMPRESIÓN / PDF ===== */
function buildPrintArea() {
  const { filamentKey, weight, infill, qty, machineRate, marginPct, failPct, shipping, quality } = readInputs();
  const fil = FILAMENTS[filamentKey];

  const client = $('q-client').value.trim() || 'Sin especificar';
  const desc   = $('q-desc').value.trim()   || 'Sin descripción';
  const notes  = $('q-notes').value.trim()  || '—';

  const now = new Date();
  $('p-date').textContent = `Fecha: ${now.toLocaleDateString('es-EC', { year:'numeric', month:'long', day:'numeric' })}`;

  const qualityLabel = { draft: 'Borrador 0.3mm', standard: 'Estándar 0.2mm', fine: 'Fino 0.1mm', ultra: 'Ultra 0.05mm' };
  const supportLabel = { none: 'Sin soportes', normal: 'Soportes normales', complex: 'Soportes complejos' };
  const postLabel    = { none: 'Ninguno', sanding: 'Lijado', painting: 'Pintado', full: 'Acabado completo' };
  const complexLabel = { simple: 'Simple', medium: 'Media', complex: 'Compleja' };

  const rows = [
    ['Cliente',                client],
    ['Descripción',            desc],
    ['Material',               `${fil.name} — $${fil.pricePerKg}/kg (ARTILLERY)`],
    ['Color / variante',       $('color').value.trim() || '—'],
    ['Peso estimado',          `${weight} g`],
    ['Cantidad',               `${qty} unidad(es)`],
    ['Calidad',                qualityLabel[quality]],
    ['Relleno (Infill)',       `${infill}%`],
    ['Soportes',               supportLabel[state.supports]],
    ['Post-procesado',         postLabel[state.postprocess]],
    ['Complejidad',            complexLabel[state.complexity]],
    ['Tarifa de máquina',      `$${machineRate}/h`],
    ['Margen de ganancia',     `${marginPct}%`],
    ['Reserva por fallas',     `${failPct}%`],
    ['Costo de envío',         `$${shipping.toFixed(2)}`],
    ['Notas',                  notes],
    ['Precio por unidad',      $('r-unit').textContent],
  ];

  $('p-body').innerHTML = rows.map(([k, v]) =>
    `<tr><td>${k}</td><td>${v}</td></tr>`
  ).join('');

  $('p-total').textContent = $('r-total').textContent + ` (${qty} ud.)`;
}

/* ===== EVENT LISTENERS ===== */
function initListeners() {
  /* Recalcular en cualquier cambio */
  const inputs = ['filament','weight','infill','qty','machine-rate','margin','fail-rate','shipping'];
  inputs.forEach(id => {
    $(id).addEventListener('input', calculate);
    $(id).addEventListener('change', calculate);
  });
  document.querySelectorAll('input[name="quality"]').forEach(r =>
    r.addEventListener('change', calculate)
  );

  /* Botón explícito */
  $('btn-calc').addEventListener('click', calculate);

  /* Imprimir */
  $('btn-print').addEventListener('click', () => {
    buildPrintArea();
    window.print();
  });
}

/* ===== INIT ===== */
function init() {
  initToggleGroups();
  initListeners();
  calculate();
}

document.addEventListener('DOMContentLoaded', init);
