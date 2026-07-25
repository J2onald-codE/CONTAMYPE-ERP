// ══ LIBROS CONTABLES ══════════════════════════════════════════════════════

function mostrarLibro(tipo) {
  document.getElementById('card-libro-diario').style.display = tipo === 'diario' ? 'block' : 'none';
  document.getElementById('card-libro-mayor').style.display = tipo === 'mayor' ? 'block' : 'none';
  document.getElementById('card-er').style.display = tipo === 'er' ? 'block' : 'none';
  document.getElementById('btn-libro-diario').className = tipo === 'diario' ? 'btn-action' : 'btn-action btn-secondary-action';
  document.getElementById('btn-libro-mayor').className = tipo === 'mayor' ? 'btn-action' : 'btn-action btn-secondary-action';
  document.getElementById('btn-estado-resultados').className = tipo === 'er' ? 'btn-action' : 'btn-action btn-secondary-action';
  if (tipo === 'diario') cargarLibroDiario();
  if (tipo === 'mayor') cargarLibroMayor();
  if (tipo === 'er') cargarEstadoResultados();
}

async function cargarLibroDiario() {
  const tbody = document.getElementById('ld-tbody');
  const count = document.getElementById('ld-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/LIBRO%20DIARIO%205.1!A2:I500?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.values || data.values.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#A0AEC0;">Sin asientos registrados.</td></tr>';
      if (count) count.textContent = '0 asientos'; return;
    }
    const rows = data.values;
    if (count) count.textContent = rows.length + ' línea(s)';
    tbody.innerHTML = rows.map(row => `<tr>
      <td>${row[0]||'-'}</td><td>${row[1]||'-'}</td><td>${row[2]||'-'}</td>
      <td>${row[3]||'-'}</td><td><b>${row[4]||'-'}</b></td><td>${row[5]||'-'}</td>
      <td style="color:var(--azul-oscuro);">S/. ${parseFloat(row[6]||0).toFixed(2)}</td>
      <td style="color:var(--verde);">S/. ${parseFloat(row[7]||0).toFixed(2)}</td>
    </tr>`).join('');
  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--rojo);">Error al cargar.</td></tr>';
  }
}

async function cargarLibroMayor() {
  const container = document.getElementById('lm-container');
  const count = document.getElementById('lm-count');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Cargando...</div>';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/LIBRO%20MAYOR!A2:H500?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.values || data.values.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#A0AEC0; padding:32px;">Sin registros en Libro Mayor.</p>';
      if (count) count.textContent = '0 línea(s)'; return;
    }
    const rows = data.values;
    if (count) count.textContent = rows.length + ' línea(s)';
    const cuentas = {};
    rows.forEach(row => {
      const cuenta = (row[1]||'').toString().trim();
      if (!cuenta) return;
      if (!cuentas[cuenta]) cuentas[cuenta] = [];
      cuentas[cuenta].push(row);
    });
    const p = (val) => {
      if (!val && val !== 0) return '0.00';
      if (typeof val === 'number') return val.toFixed(2);
      return (parseFloat(val.toString().replace(/,/g, '')) || 0).toFixed(2);
    };
    const nombresCuenta = {
      '104':'CUENTAS CORRIENTES','4017':'IMPUESTO A LA RENTA','4031':'ESSALUD',
      '4032':'ONP','4111':'SUELDOS Y SALARIOS POR PAGAR','4151':'CTS POR PAGAR',
      '417':'AFP','421':'FACTURAS POR PAGAR','6211':'SUELDOS Y SALARIOS',
      '6213':'COMPENSACION POR TIEMPO DE SERVICIOS','6271':'REGIMEN DE PRESTACIONES DE SALUD',
      '881':'IMPUESTO A LAS GANANCIAS - CORRIENTE'
    };
    let html = '<div>';
    Object.keys(cuentas).sort().forEach(cuenta => {
      const movimientos = cuentas[cuenta];
      const nombre = nombresCuenta[cuenta] || 'CUENTA ' + cuenta;
      let totalDebe = 0, totalHaber = 0;
      const filas = movimientos.map(row => {
        const debe = typeof row[5]==='number' ? row[5] : parseFloat((row[5]||'0').toString().replace(/,/g,''))||0;
        const haber = typeof row[6]==='number' ? row[6] : parseFloat((row[6]||'0').toString().replace(/,/g,''))||0;
        const saldo = typeof row[7]==='number' ? row[7] : parseFloat((row[7]||'0').toString().replace(/,/g,''))||0;
        totalDebe += debe; totalHaber += haber;
        return `<tr>
          <td style="padding:6px 8px; border:1px solid #E2E8F0; font-size:0.82rem;">${row[2]||'-'}</td>
          <td style="padding:6px 8px; border:1px solid #E2E8F0; font-size:0.82rem; text-align:center;">${row[3]||'-'}</td>
          <td style="padding:6px 8px; border:1px solid #E2E8F0; font-size:0.82rem;">${row[4]||'-'}</td>
          <td style="padding:6px 8px; border:1px solid #E2E8F0; font-size:0.82rem; text-align:right; color:${debe>0?'var(--azul-oscuro)':'#A0AEC0'};">${debe>0?'S/. '+p(debe):'-'}</td>
          <td style="padding:6px 8px; border:1px solid #E2E8F0; font-size:0.82rem; text-align:right; color:${haber>0?'var(--rojo)':'#A0AEC0'};">${haber>0?'S/. '+p(haber):'-'}</td>
          <td style="padding:6px 8px; border:1px solid #E2E8F0; font-size:0.82rem; text-align:right; font-weight:600; color:${saldo>=0?'var(--verde)':'var(--rojo)'};">S/. ${p(saldo)}</td>
        </tr>`;
      }).join('');
      html += `<div style="margin-bottom:24px; border:1px solid #E2E8F0; border-radius:10px; overflow:hidden;">
        <div style="background:var(--azul-oscuro); padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div>
            <span style="font-weight:700; color:#FFFFFF; font-size:0.95rem;">Cuenta: ${cuenta}</span>
            <span style="color:#BEE3F8; font-size:0.8rem; margin-left:10px;">${nombre}</span>
          </div>
          <span style="color:#BEE3F8; font-size:0.8rem;">${movimientos.length} movimiento(s)</span>
        </div>
        <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#EBF8FF;">
              <th style="padding:8px; border:1px solid #E2E8F0; font-size:0.8rem; text-align:left; color:var(--azul-oscuro);">Fecha</th>
              <th style="padding:8px; border:1px solid #E2E8F0; font-size:0.8rem; text-align:center; color:var(--azul-oscuro);">N° Corr. Libro Diario</th>
              <th style="padding:8px; border:1px solid #E2E8F0; font-size:0.8rem; text-align:left; color:var(--azul-oscuro);">Glosa</th>
              <th style="padding:8px; border:1px solid #E2E8F0; font-size:0.8rem; text-align:right; color:var(--azul-oscuro);">Debe</th>
              <th style="padding:8px; border:1px solid #E2E8F0; font-size:0.8rem; text-align:right; color:var(--azul-oscuro);">Haber</th>
              <th style="padding:8px; border:1px solid #E2E8F0; font-size:0.8rem; text-align:right; color:var(--azul-oscuro);">Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
            <tr style="background:#F7FAFC;">
              <td colspan="3" style="padding:8px; border:1px solid #E2E8F0; font-weight:700; font-size:0.82rem; text-align:right; color:var(--azul-oscuro);">TOTALES (S/.)</td>
              <td style="padding:8px; border:1px solid #E2E8F0; font-weight:700; text-align:right; color:var(--azul-oscuro);">S/. ${p(totalDebe)}</td>
              <td style="padding:8px; border:1px solid #E2E8F0; font-weight:700; text-align:right; color:var(--rojo);">S/. ${p(totalHaber)}</td>
              <td style="padding:8px; border:1px solid #E2E8F0; font-weight:700; text-align:right;">S/. ${p(totalDebe-totalHaber)}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch(err) {
    container.innerHTML = '<p style="text-align:center; color:var(--rojo); padding:32px;">Error al cargar Libro Mayor.</p>';
    console.error(err);
  }
}

async function cargarEstadoResultados() {
  const body = document.getElementById('er-body');
  if (!body) return;
  body.innerHTML = '<div class="loading"><div class="spinner"></div> Cargando...</div>';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/ESTADOS%20RESULTADOS!A2:T2?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.values || data.values.length === 0) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Sin datos de Estado de Resultados.</p></div>'; return;
    }
    const row = data.values[0];
    const p = (i) => parseFloat(row[i]||0).toFixed(2);
    const color = (i) => parseFloat(row[i]||0) >= 0 ? 'var(--verde)' : 'var(--rojo)';
    const participacion = parseFloat(row[18]||0); // S = participación trabajadores
    body.innerHTML = `
      <div style="max-width:600px; margin:0 auto;">
        <div style="text-align:center; margin-bottom:24px;">
          <div style="font-family:var(--font-display); font-size:1.2rem; font-weight:800; color:var(--negro);">ESTADO DE RESULTADOS</div>
          <div style="font-size:0.85rem; color:var(--gris-texto);">Período: ${row[1]||'-'}</div>
        </div>
        ${erFila('(+) Ventas netas', p(2), 'var(--verde)')}
        ${erFila('(-) Costo de ventas', p(3), 'var(--rojo)')}
        ${erFilaSep('(=) Utilidad bruta', p(4), color(4))}
        ${erFila('(-) Gastos administrativos', p(5), 'var(--rojo)')}
        ${erFila('(-) Gastos de ventas', p(6), 'var(--rojo)')}
        ${erFilaSep('(=) Utilidad operativa', p(7), color(7))}
        ${erFila('(+) Ingresos financieros', p(8), 'var(--verde)')}
        ${erFila('(-) Gastos financieros', p(9), 'var(--rojo)')}
        ${erFila('(+) Otros ingresos', p(15), 'var(--verde)')}
        ${erFila('(-) Otros gastos', p(16), 'var(--rojo)')}
        ${participacion > 0 ? erFilaSep('(=) Utilidad antes de participaciones e impuestos', p(17), color(17)) : ''}
        ${participacion > 0 ? erFila('(-) Participación de los trabajadores', p(18), 'var(--rojo)') : ''}
        ${erFilaSep('(=) Utilidad antes de impuestos', p(10), color(10))}
        ${erFila('(-) Impuesto a la Renta', p(11), 'var(--rojo)')}
        ${erFilaFinal('(=) UTILIDAD NETA', p(12), color(12))}
      </div>`;
  } catch(err) {
    body.innerHTML = `<div style="text-align:center; color:var(--rojo); padding:32px;">❌ Error al cargar Estado de Resultados: ${err.message}</div>`;
  }
}

function erFila(label, val, color) {
  return `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--gris-claro); font-size:0.9rem;">
    <span style="color:var(--gris-texto);">${label}</span>
    <span style="font-weight:600; color:${color};">S/. ${val}</span>
  </div>`;
}

function erFilaSep(label, val, color) {
  return `<div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:2px solid var(--azul-med); margin:4px 0; font-size:0.95rem;">
    <span style="font-weight:700; color:var(--negro);">${label}</span>
    <span style="font-weight:700; color:${color};">S/. ${val}</span>
  </div>`;
}

function erFilaFinal(label, val, color) {
  return `<div style="display:flex; justify-content:space-between; padding:16px; background:var(--gris-fondo); border-radius:10px; margin-top:12px; font-size:1.1rem;">
    <span style="font-family:var(--font-display); font-weight:800; color:var(--negro);">${label}</span>
    <span style="font-family:var(--font-display); font-weight:800; color:${color};">S/. ${val}</span>
  </div>`;
}
