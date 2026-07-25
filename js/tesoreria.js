// ══ TESORERÍA ═════════════════════════════════════════════════════════════

function mostrarFormTesoreria() {
  document.getElementById('form-tesoreria-container').style.display = 'block';
  document.getElementById('t-fecha').value = new Date().toISOString().split('T')[0];
  cargarTesoreria();
}

function cerrarFormTesoreria() {
  document.getElementById('form-tesoreria-container').style.display = 'none';
}

async function guardarMovimientoTesoreria() {
  const btn = document.getElementById('btn-guardar-tes');
  const msg = document.getElementById('tes-msg');
  const fecha = document.getElementById('t-fecha').value;
  const tipo = document.getElementById('t-tipo').value;
  const monto = document.getElementById('t-monto').value;
  if (!fecha || !monto) {
    mostrarMensajeForm('tes-msg', 'error', '⚠️ Fecha y monto son obligatorios.');
    return;
  }
  if (parseFloat(monto) <= 0) {
    mostrarMensajeForm('tes-msg', 'error', '⚠️ El monto debe ser mayor a 0.');
    return;
  }
  btn.disabled=true; btn.textContent='⏳ Guardando...';
  try {
    const accessToken = await obtenerAccessToken();
    const idMov = 'TES-MAN-' + Date.now();
    const fila = [
      idMov, fecha, tipo,
      document.getElementById('t-categoria').value,
      document.getElementById('t-medio-pago').value,
      monto,
      document.getElementById('t-destino').value,
      document.getElementById('t-descripcion').value,
      'MANUAL', idMov, ''
    ];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/TESORERIA!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [fila] })
    });
    if (resp.ok) {
      mostrarMensajeForm('tes-msg', 'ok', '✅ Movimiento guardado.');
      cerrarFormTesoreria();
      setTimeout(() => cargarTesoreria(), 1500);
    } else { await lanzarErrorSheets(resp); }
  } catch(err) {
    mostrarMensajeForm('tes-msg', 'error', '❌ Error al guardar: ' + err.message);
  } finally { btn.disabled=false; btn.textContent='💾 Guardar'; }
}

async function cargarTesoreria() {
  const tbody = document.getElementById('tes-tbody');
  const count = document.getElementById('tes-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const filas = await obtenerDatosProtegidos('obtenerTesoreria');
    if (!filas || filas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:32px; color:#A0AEC0;">Sin movimientos registrados.</td></tr>';
      if (count) count.textContent = '0 registros'; return;
    }
    const rows = filas.reverse(); // más recientes primero
    if (count) count.textContent = rows.length + ' movimiento(s)';
    tbody.innerHTML = rows.map(row => {
      const tipo = (row[2]||'').toString().trim();
      const badgeTipo = tipo === 'INGRESO' ? '<span class="badge badge-verde">INGRESO</span>' : '<span class="badge badge-rojo">EGRESO</span>';
      const saldo = parseFloat(row[10]||0);
      const saldoClass = saldo >= 0 ? 'style="color:var(--verde); font-weight:700;"' : 'style="color:var(--rojo); font-weight:700;"';
      return `<tr>
        <td>${row[0]||'-'}</td><td>${row[1]||'-'}</td><td>${badgeTipo}</td>
        <td>${row[3]||'-'}</td><td>${row[4]||'-'}</td>
        <td><b>S/. ${parseFloat(row[5]||0).toFixed(2)}</b></td>
        <td>${row[6]||'-'}</td><td>${row[7]||'-'}</td>
        <td>${row[8]||'-'}</td><td>${row[9]||'-'}</td>
        <td ${saldoClass}>S/. ${saldo.toFixed(2)}</td>
      </tr>`;
    }).join('');
  } catch(err) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:32px; color:var(--rojo);">❌ ${err.message}</td></tr>`;
  }
}
