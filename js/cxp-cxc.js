// ══ CXP - CUENTAS POR PAGAR ═══════════════════════════════════════════════

async function cargarCXP() {
  const tbody = document.getElementById('cxp-tbody');
  const count = document.getElementById('cxp-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/REGISTRO%20DE%20COMPRAS!A2:Z500?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.values) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#A0AEC0;">Sin datos.</td></tr>'; return; }
    const pendientes = data.values.filter(row => (row[21]||'').trim().toUpperCase() === 'CREDITO' && (row[22]||'').trim().toUpperCase() !== 'PAGADO');
    if (count) count.textContent = pendientes.length + ' pendiente(s)';
    if (pendientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--verde);">✅ Sin cuentas por pagar pendientes.</td></tr>'; return;
    }
    tbody.innerHTML = pendientes.map(row => {
      const estadoVenc = (row[25]||'').trim();
      const badgeVenc = estadoVenc.includes('Vencido') ? '<span class="badge badge-rojo">'+estadoVenc+'</span>' :
                        estadoVenc.includes('hoy') ? '<span class="badge badge-amarillo">'+estadoVenc+'</span>' :
                        estadoVenc ? '<span class="badge badge-verde">'+estadoVenc+'</span>' : '-';
      return `<tr>
        <td>${row[2]||'-'}</td><td>${row[4]||'-'}</td><td>${row[5]||'-'}</td><td>${row[7]||'-'}</td>
        <td><b>S/. ${parseFloat(row[12]||0).toFixed(2)}</b></td>
        <td>${row[23]||'-'}</td><td>${row[24]||'-'}</td><td>${badgeVenc}</td>
        <td><button class="btn-action btn-secondary-action" style="padding:4px 10px; font-size:0.75rem;" onclick="marcarCompraPagada('${row[0]}')">💰 Marcar pagado</button></td>
      </tr>`;
    }).join('');
  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--rojo);">Error al cargar.</td></tr>';
  }
}


// ══ CXC - CUENTAS POR COBRAR ══════════════════════════════════════════════

async function cargarCXC() {
  const tbody = document.getElementById('cxc-tbody');
  const count = document.getElementById('cxc-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/REGISTRO%20DE%20VENTAS!A2:Z500?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.values) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#A0AEC0;">Sin datos.</td></tr>'; return; }
    const pendientes = data.values.filter(row => (row[21]||'').trim().toUpperCase() === 'CREDITO' && (row[22]||'').trim().toUpperCase() !== 'COBRADO');
    if (count) count.textContent = pendientes.length + ' pendiente(s)';
    if (pendientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--verde);">✅ Sin cuentas por cobrar pendientes.</td></tr>'; return;
    }
    tbody.innerHTML = pendientes.map(row => {
      const estadoVenc = (row[25]||'').trim();
      const badgeVenc = estadoVenc.includes('Vencido') ? '<span class="badge badge-rojo">'+estadoVenc+'</span>' :
                        estadoVenc.includes('hoy') ? '<span class="badge badge-amarillo">'+estadoVenc+'</span>' :
                        estadoVenc ? '<span class="badge badge-verde">'+estadoVenc+'</span>' : '-';
      return `<tr>
        <td>${row[2]||'-'}</td><td>${row[5]||'-'}</td><td>${row[6]||'-'}</td><td>${row[8]||'-'}</td>
        <td><b>S/. ${parseFloat(row[13]||0).toFixed(2)}</b></td>
        <td>${row[23]||'-'}</td><td>${row[24]||'-'}</td><td>${badgeVenc}</td>
        <td><button class="btn-action btn-secondary-action" style="padding:4px 10px; font-size:0.75rem;" onclick="marcarVentaCobrada('${row[0]}')">💰 Marcar cobrado</button></td>
      </tr>`;
    }).join('');
  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--rojo);">Error al cargar.</td></tr>';
  }
}

async function marcarCompraPagada(idCompra) {
  if (!confirm('¿Confirmas que esta compra ya fue pagada?')) return;
  try {
    const data = await llamarWebhookJSONP({
      token: WEBHOOK_TOKEN, accion: 'pagoCompraCredito', idCompra: idCompra
    });
    if (data.status === 'ok') {
      alert('✅ Pago registrado correctamente.');
      cargarCXP();
    } else {
      alert('⚠️ ' + (data.message || 'No se pudo registrar el pago.'));
    }
  } catch (err) {
    alert('❌ Error al registrar el pago: ' + err.message);
  }
}

async function marcarVentaCobrada(idVenta) {
  if (!confirm('¿Confirmas que esta venta ya fue cobrada?')) return;
  try {
    const data = await llamarWebhookJSONP({
      token: WEBHOOK_TOKEN, accion: 'cobroVentaCredito', idVenta: idVenta
    });
    if (data.status === 'ok') {
      alert('✅ Cobro registrado correctamente.');
      cargarCXC();
    } else {
      alert('⚠️ ' + (data.message || 'No se pudo registrar el cobro.'));
    }
  } catch (err) {
    alert('❌ Error al registrar el cobro: ' + err.message);
  }
}
