// ══ PLANILLA ══════════════════════════════════════════════════════════════

function mostrarFormPlanilla() {
  document.getElementById('form-planilla-container').style.display = 'block';
  const hoy = new Date();
  document.getElementById('p-mes').value = hoy.toISOString().slice(0,7);
  cargarPlanilla();
}

function cerrarFormPlanilla() {
  document.getElementById('form-planilla-container').style.display = 'none';
}

async function guardarPlanilla() {
  const btn = document.getElementById('btn-guardar-planilla');
  const msg = document.getElementById('planilla-msg');
  const nombres = document.getElementById('p-nombres').value.trim();
  const mes = document.getElementById('p-mes').value;
  const sueldo = document.getElementById('p-sueldo').value;
  const regimen = document.getElementById('p-regimen').value;
  if (!nombres || !mes || !sueldo || !regimen) {
    mostrarMensajeForm('planilla-msg', 'error', '⚠️ Nombres, mes, sueldo y régimen son obligatorios.');
    return;
  }
  if (parseFloat(sueldo) <= 0) {
    mostrarMensajeForm('planilla-msg', 'error', '⚠️ El sueldo debe ser mayor a 0.');
    return;
  }
  btn.disabled=true; btn.textContent='⏳ Guardando...';
  try {
    const accessToken = await obtenerAccessToken();
    const idPlanilla = 'PL-' + Date.now();
    // Columnas reales de la hoja PLANILLA (A:W):
    // A=ID, B=NOMBRES, C=MES PAGO, D=SUELDO, E=ASIG FAM, F=GRATIFICACION(auto),
    // G=VACACIONES(auto), H=AFP, I=AFP MONTO(auto), J=CTS(auto), K=5TA CAT,
    // L=ONP(auto), M=TOTAL DCTO(auto), N=NETO A PAGAR(auto), O=ESSALUD(auto),
    // P=TOTAL APORTE(auto), Q=MEDIO DE PAGO, R=ASIENTO LD(sistema-oculto),
    // S=REQUIERE AJUSTE, T=SUELDO BASE(sistema), U=DATOS ADICIONALES BASE(sistema),
    // V=REGIMEN, W=SALIO DE VACACIONES
    const fila = [
      idPlanilla, nombres, mes, sueldo,
      document.getElementById('p-asig').value || 0,
      '', // F - GRATIFICACION (Apps Script calcula)
      '', // G - VACACIONES (Apps Script calcula)
      document.getElementById('p-afp').value || '',
      '', // I - AFP MONTO (Apps Script calcula)
      '', // J - CTS (Apps Script calcula)
      document.getElementById('p-quinta').value || 0,
      '', // L - ONP (Apps Script calcula)
      '', // M - TOTAL DCTO (Apps Script calcula)
      '', // N - NETO A PAGAR (Apps Script calcula)
      '', // O - ESSALUD (Apps Script calcula)
      '', // P - TOTAL APORTE (Apps Script calcula)
      document.getElementById('p-medio-pago').value,
      '', // R - ASIENTO LD (sistema)
      '', // S - REQUIERE AJUSTE (sistema)
      '', // T - SUELDO BASE (sistema)
      '', // U - DATOS ADICIONALES BASE (sistema)
      regimen, // V - REGIMEN
      document.getElementById('p-vacaciones').value || 'NO' // W - SALIO DE VACACIONES
    ];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/PLANILLA!A:W:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [fila] })
    });
    if (resp.ok) {
      mostrarMensajeForm('planilla-msg', 'ok', '✅ Registro guardado. El sistema calculará los beneficios automáticamente.');
      cerrarFormPlanilla();
      setTimeout(() => cargarPlanilla(), 2000);
    } else { await lanzarErrorSheets(resp); }
  } catch(err) {
    mostrarMensajeForm('planilla-msg', 'error', '❌ Error al guardar: ' + err.message);
  } finally { btn.disabled=false; btn.textContent='💾 Guardar'; }
}

let planillaData = [];

async function cargarPlanilla() {
  const tbody = document.getElementById('planilla-tbody');
  const count = document.getElementById('planilla-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="19" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const rows = await obtenerDatosProtegidos('obtenerPlanilla');
    if (!rows || rows.length === 0) {
      planillaData = [];
      tbody.innerHTML = '<tr><td colspan="19" style="text-align:center; padding:32px; color:#A0AEC0;">Sin registros de planilla.</td></tr>';
      if (count) count.textContent = '0 registros'; return;
    }
    planillaData = rows;
    renderPlanilla(planillaData);
  } catch(err) {
    tbody.innerHTML = `<tr><td colspan="19" style="text-align:center; padding:32px; color:var(--rojo);">❌ ${err.message}</td></tr>`;
  }
}

function renderPlanilla(rows) {
  const tbody = document.getElementById('planilla-tbody');
  const count = document.getElementById('planilla-count');
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="19" style="text-align:center; padding:32px; color:#A0AEC0;">Sin resultados para este filtro.</td></tr>';
    if (count) count.textContent = '0 registros'; return;
  }
  if (count) count.textContent = rows.length + ' registro(s)';
  tbody.innerHTML = rows.map(row => {
    const reqAjuste = (row[18]||'').toString().trim(); // S - REQUIERE AJUSTE
    const badgeAjuste = reqAjuste ? '<span class="badge badge-amarillo">⚠️ Ajuste</span>' : '<span class="badge badge-verde">OK</span>';
    const regimen = (row[21]||'-').toString().trim(); // V - REGIMEN
    const salioVac = (row[22]||'-').toString().trim(); // W - SALIO DE VACACIONES
    return `<tr>
      <td>${row[1]||'-'}</td>
      <td>${row[2]||'-'}</td>
      <td>S/. ${parseFloat((row[3]||0).toString().replace(',','.')).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[4]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[5]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[6]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[9]||0).toFixed(2)}</td>
      <td>${row[7]||'-'}</td>
      <td>S/. ${parseFloat(row[8]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[10]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[11]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[12]||0).toFixed(2)}</td>
      <td><b>S/. ${parseFloat(row[13]||0).toFixed(2)}</b></td>
      <td>S/. ${parseFloat(row[14]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[15]||0).toFixed(2)}</td>
      <td>${row[16]||'-'}</td>
      <td>${regimen}</td>
      <td>${salioVac}</td>
      <td>${badgeAjuste}</td>
    </tr>`;
  }).join('');
}

function filtrarPlanilla() {
  const texto = (document.getElementById('p-filtro-texto').value || '').toLowerCase();
  const mes = document.getElementById('p-filtro-mes').value;

  const filtrado = planillaData.filter(row => {
    const nombre = (row[1]||'').toString().toLowerCase();
    const matchTexto = !texto || nombre.includes(texto);

    const mesPago = (row[2]||'').toString().toUpperCase();
    const matchMes = !mes || mesPago.includes(mes);

    return matchTexto && matchMes;
  });

  renderPlanilla(filtrado);
}

function exportarPlanillaExcel() {
  if (!planillaData || planillaData.length === 0) { alert('No hay datos para exportar.'); return; }
  var headers = ['Nombres','Mes','Sueldo','Asig Familiar','Gratificacion','Vacaciones','Neto a Pagar','Regimen'];
  var csv = 'sep=,\n' + headers.join(',') + '\n';
  var filas = [];
  planillaData.forEach(function(row) {
    var sueldo = parseFloat((row[3]||0).toString().replace(',','.'));
    csv += (row[1]||'') + ',' + (row[2]||'') + ',' + sueldo.toFixed(2) + ',' +
      parseFloat(row[4]||0).toFixed(2) + ',' + parseFloat(row[5]||0).toFixed(2) + ',' + parseFloat(row[6]||0).toFixed(2) + ',' +
      parseFloat(row[13]||0).toFixed(2) + ',' + (row[21]||'') + '\n';
    filas.push([row[1]||'', row[2]||'', sueldo, parseFloat(row[4]||0), parseFloat(row[5]||0), parseFloat(row[6]||0), parseFloat(row[13]||0), row[21]||'']);
  });
  exportarExcelConEstilo(headers, filas, 'planilla_' + new Date().toISOString().split('T')[0] + '.xlsx', 'Planilla', csv);
}

function exportarPlanillaPDF() {
  window.print();
}
