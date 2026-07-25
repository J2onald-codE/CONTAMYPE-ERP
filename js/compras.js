// ══ MÓDULO COMPRAS ════════════════════════════════════════════════════════

let streamEscanerC = null;

let scannerIntervalC = null;

let proveedoresCache = [];

function mostrarFormCompra() {
  document.getElementById('form-compra-container').style.display = 'block';
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('c-fecha').value = hoy;
  document.getElementById('c-estado-pago').value = 'PAGADO';
  toggleCreditoCompra();
  cargarProveedores();
  cargarListaCompras();
}

function cerrarFormCompra() {
  document.getElementById('form-compra-container').style.display = 'none';
  detenerEscanerCompra();
  limpiarFormCompra();
}

function limpiarFormCompra() {
  ['c-fecha','c-numero','c-ruc','c-razon','c-producto','c-codigo-barras',
   'c-cantidad','c-precio','c-dias-credito','c-requiere-revision','c-snapshot','c-estado-venc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('c-tipo-comprobante').value = '';
  document.getElementById('c-forma-pago').value = 'EFECTIVO';
  document.getElementById('c-tipo-pago').value = 'CONTADO';
  document.getElementById('c-estado-pago').value = 'PAGADO';
  document.getElementById('c-dias-credito-group').style.display = 'none';
  document.getElementById('c-subtotal').textContent = 'S/. 0.00';
  document.getElementById('c-igv').textContent = 'S/. 0.00';
  document.getElementById('c-total').textContent = 'S/. 0.00';
}

function toggleCreditoCompra() {
  const tipo = document.getElementById('c-tipo-pago').value;
  document.getElementById('c-dias-credito-group').style.display = tipo === 'CREDITO' ? 'block' : 'none';
  document.getElementById('c-estado-pago').value = tipo === 'CREDITO' ? 'PENDIENTE' : 'PAGADO';
}

function calcularTotalesCompra() {
  const cantidad = parseFloat(document.getElementById('c-cantidad').value) || 0;
  const precio = parseFloat(document.getElementById('c-precio').value) || 0;
  const subtotal = Math.round(cantidad * precio * 100) / 100;
  const igv = Math.round(subtotal * 0.18 * 100) / 100;
  const total = Math.round((subtotal + igv) * 100) / 100;
  document.getElementById('c-subtotal').textContent = 'S/. ' + subtotal.toFixed(2);
  document.getElementById('c-igv').textContent = 'S/. ' + igv.toFixed(2);
  document.getElementById('c-total').textContent = 'S/. ' + total.toFixed(2);
  document.getElementById('c-snapshot').value = cantidad + '|' + precio + '|' + total;
}

async function generarNumeroComprobanteCompra() {
  const tipo = document.getElementById('c-tipo-comprobante').value;
  if (!tipo) return;
  const series = { 'FACTURA':'F001','BOLETA':'B001','TICKET':'T001','NOTA DE CREDITO':'NC01','NOTA DE DEBITO':'ND01' };
  const serie = series[tipo];
  if (!serie) return;
  const campo = document.getElementById('c-numero');
  campo.value = 'Generando...';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/REGISTRO%20DE%20COMPRAS!E2:E500?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    let maxCorr = 0;
    if (data.values) {
      data.values.forEach(row => {
        const num = (row[0] || '').toString();
        if (num.startsWith(serie)) {
          const partes = num.split('-');
          if (partes.length === 2) {
            const n = parseInt(partes[1], 10);
            if (!isNaN(n) && n > maxCorr) maxCorr = n;
          }
        }
      });
    }
    campo.value = serie + '-' + ('00000000' + (maxCorr + 1)).slice(-8);
  } catch(err) {
    campo.value = serie + '-00000001';
  }
}

async function cargarProveedores() {
  if (proveedoresCache.length > 0) return;
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/PROVEEDORES!A2:G500?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.values) {
      proveedoresCache = data.values.map(row => ({
        codigo: (row[0]||'').toString().trim(),
        nombre: (row[1]||'').toString().trim(),
        ruc: (row[2]||'').toString().trim()
      }));
    }
  } catch(e) {}
}

function buscarProveedor(ruc) {
  if (!ruc || ruc.length < 8) return;
  if (proveedoresCache.length === 0) { cargarProveedores().then(() => buscarProveedor(ruc)); return; }
  const prov = proveedoresCache.find(p => p.ruc === ruc.trim() || p.codigo === ruc.trim());
  if (prov) {
    document.getElementById('c-razon').value = prov.nombre;
    document.getElementById('c-razon').style.background = '#F0FFF4';
    document.getElementById('c-razon').style.borderColor = 'var(--verde)';
  } else {
    document.getElementById('c-razon').style.background = '';
    document.getElementById('c-razon').style.borderColor = '';
  }
}

async function buscarProductoCompra(codigo) {
  if (!codigo || codigo.length < 3) return false;
  if (productosCache.length === 0) {
    await cargarProductos();
  }
  const prod = productosCache.find(p => p.codigoBarras === codigo.trim() || p.codigo === codigo.trim());
  if (prod) {
    document.getElementById('c-producto').value = prod.nombre;
    const el = document.getElementById('scan-resultado-c');
    if (el) { el.style.display='block'; el.style.color='var(--verde)'; el.textContent='✅ Producto: ' + prod.nombre; }
    return true;
  } else {
    const el = document.getElementById('scan-resultado-c');
    if (el) { el.style.display='block'; el.style.color='var(--rojo)'; el.textContent='⚠️ Código no encontrado, sigue escaneando...'; }
    return false;
  }
}

async function iniciarEscanerCompra() {
  try {
    document.getElementById('scanner-container-c').style.display = 'block';
    document.getElementById('btn-iniciar-scan-c').style.display = 'none';
    document.getElementById('btn-detener-scan-c').style.display = 'inline-flex';
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    streamEscanerC = stream;
    document.getElementById('scanner-video-c').srcObject = stream;
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','qr_code'] });
      const video = document.getElementById('scanner-video-c');
      let yaEncontrado = false;
      scannerIntervalC = setInterval(async () => {
        if (yaEncontrado) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const codigo = barcodes[0].rawValue;
            document.getElementById('c-codigo-barras').value = codigo;
            const encontrado = await buscarProductoCompra(codigo);
            if (encontrado) { yaEncontrado = true; detenerEscanerCompra(); }
          }
        } catch(e) {}
      }, 500);
    } else {
      const el = document.getElementById('scan-resultado-c');
      if (el) { el.style.display='block'; el.style.color='var(--rojo)'; el.textContent='⚠️ Escáner no disponible. Ingresa el código manualmente.'; }
      detenerEscanerCompra();
    }
  } catch(err) {
    detenerEscanerCompra();
  }
}

function detenerEscanerCompra() {
  if (streamEscanerC) { streamEscanerC.getTracks().forEach(t => t.stop()); streamEscanerC = null; }
  if (scannerIntervalC) { clearInterval(scannerIntervalC); scannerIntervalC = null; }
  document.getElementById('scanner-container-c').style.display = 'none';
  document.getElementById('btn-iniciar-scan-c').style.display = 'inline-flex';
  document.getElementById('btn-detener-scan-c').style.display = 'none';
}

async function guardarCompra() {
  const btn = document.getElementById('btn-guardar-compra');
  const msg = document.getElementById('compra-msg');
  const fecha = document.getElementById('c-fecha').value;
  const tipoComp = document.getElementById('c-tipo-comprobante').value;
  const razon = document.getElementById('c-razon').value.trim();
  const producto = document.getElementById('c-producto').value.trim();
  const cantidad = document.getElementById('c-cantidad').value;
  const precio = document.getElementById('c-precio').value;
  if (!fecha || !tipoComp || !razon || !producto || !cantidad || !precio) {
    mostrarMensajeForm('compra-msg', 'error', '⚠️ Completa los campos obligatorios marcados con *');
    return;
  }
  if (parseFloat(cantidad) <= 0 || parseFloat(precio) <= 0) {
    mostrarMensajeForm('compra-msg', 'error', '⚠️ La cantidad y el precio deben ser mayores a 0.');
    return;
  }
  btn.disabled=true; btn.textContent='⏳ Guardando...';
  try {
    const subtotalNum = parseFloat(document.getElementById('c-subtotal').textContent.replace('S/. ',''))||0;
    const igvNum = parseFloat(document.getElementById('c-igv').textContent.replace('S/. ',''))||0;
    const totalNum = parseFloat(document.getElementById('c-total').textContent.replace('S/. ',''))||0;
    const tipoPago = document.getElementById('c-tipo-pago').value;
    const estadoPago = tipoPago === 'CREDITO' ? 'PENDIENTE' : 'PAGADO';
    const snapshot = cantidad + '|' + precio + '|' + totalNum;
    const fila = [
      '', // A - ID COMPRA (Apps Script)
      '', // B - N°CORR (Apps Script)
      fecha, // C
      tipoComp, // D
      document.getElementById('c-numero').value, // E
      razon, // F - RAZON SOCIAL
      document.getElementById('c-ruc').value, // G - RUC/DNI
      producto, // H - PRODUCTO
      cantidad, // I
      precio, // J
      subtotalNum, // K
      igvNum, // L
      totalNum, // M - IMPORTE TOTAL
      '', // N - FOTO COMPROBANTE
      document.getElementById('c-forma-pago').value, // O
      '', // P - CUENTA (sistema)
      '', // Q - PROCESADO (sistema)
      '', // R - ASIENTO (sistema)
      '', // S - PROCESADO TES (sistema)
      document.getElementById('c-requiere-revision').value, // T
      snapshot, // U
      tipoPago, // V
      estadoPago, // W - ESTADO DE PAGO
      document.getElementById('c-dias-credito').value||'', // X
      '', // Y - FECHA VENCIMIENTO (sistema)
      ''  // Z - ESTADO VENCIMIENTO (sistema)
    ];
    const accessToken = await obtenerAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/REGISTRO%20DE%20COMPRAS!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [fila] })
    });
    if (resp.ok) {
      mostrarMensajeForm('compra-msg', 'ok', '✅ Compra guardada correctamente.');
      limpiarFormCompra();
      setTimeout(() => cargarListaCompras(), 2000);
    } else { await lanzarErrorSheets(resp); }
  } catch(err) {
    mostrarMensajeForm('compra-msg', 'error', '❌ Error al guardar la compra: ' + err.message);
  } finally {
    btn.disabled=false; btn.textContent='💾 Guardar Compra';
  }
}

let comprasData = [];

async function cargarListaCompras() {
  const tbody = document.getElementById('compras-tbody');
  const count = document.getElementById('compras-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:24px; color:#A0AEC0;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const rows = await obtenerDatosProtegidos('obtenerCompras');
    if (!rows || rows.length === 0) {
      comprasData = [];
      tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:32px; color:#A0AEC0;">No hay compras registradas.</td></tr>';
      if (count) count.textContent = '0 registros'; return;
    }
    comprasData = rows;
    renderCompras(comprasData);
  } catch(err) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding:32px; color:var(--rojo);">❌ ${err.message}</td></tr>`;
  }
}

function renderCompras(rows) {
  const tbody = document.getElementById('compras-tbody');
  const count = document.getElementById('compras-count');
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:32px; color:#A0AEC0;">Sin resultados para este filtro.</td></tr>';
    if (count) count.textContent = '0 registros'; return;
  }
  if (count) count.textContent = rows.length + ' registro(s)';
  tbody.innerHTML = rows.map(row => {
    const estadoPago = (row[22]||'').trim();
    const tipoPago = (row[21]||'').trim();
    const badgePago = estadoPago === 'PAGADO' ? '<span class="badge badge-verde">PAGADO</span>' : '<span class="badge badge-amarillo">PENDIENTE</span>';
    const badgeTipo = tipoPago === 'CREDITO' ? '<span class="badge badge-rojo">CRÉDITO</span>' : '<span class="badge badge-verde">CONTADO</span>';
    return `<tr>
      <td>${row[2]||'-'}</td><td>${row[3]||'-'}</td><td>${row[4]||'-'}</td><td>${row[5]||'-'}</td>
      <td>${row[7]||'-'}</td><td>${row[8]||'-'}</td><td>S/. ${parseFloat(row[9]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[10]||0).toFixed(2)}</td><td>S/. ${parseFloat(row[11]||0).toFixed(2)}</td>
      <td><b>S/. ${parseFloat(row[12]||0).toFixed(2)}</b></td>
      <td>${row[14]||'-'}</td><td>${badgeTipo}</td><td>${badgePago}</td>
      <td>${row[23]||'-'}</td><td>${row[24]||'-'}</td><td>${row[25]||'-'}</td>
    </tr>`;
  }).join('');
}

function filtrarCompras() {
  const texto = (document.getElementById('c-filtro-texto').value || '').toLowerCase();
  const estado = document.getElementById('c-filtro-estado').value;

  const filtrado = comprasData.filter(row => {
    const comprobante = (row[4]||'').toString().toLowerCase();
    const proveedor = (row[5]||'').toString().toLowerCase();
    const producto = (row[7]||'').toString().toLowerCase();
    const matchTexto = !texto || comprobante.includes(texto) || proveedor.includes(texto) || producto.includes(texto);

    const estadoPago = (row[22]||'').toString().trim();
    const matchEstado = !estado || estadoPago === estado;

    return matchTexto && matchEstado;
  });

  renderCompras(filtrado);
}

function exportarComprasExcel() {
  if (!comprasData || comprasData.length === 0) { alert('No hay datos para exportar.'); return; }
  var headers = ['Fecha','Comprobante','Proveedor','Producto','Cantidad','Subtotal','IGV','Total','Forma Pago','Tipo Pago','Estado Pago'];
  var csv = 'sep=,\n' + headers.join(',') + '\n';
  var filas = [];
  comprasData.forEach(function(row) {
    csv += (row[2]||'') + ',' + (row[4]||'') + ',' + (row[5]||'') + ',' + (row[7]||'') + ',' + (row[8]||'') + ',' +
      parseFloat(row[9]||0).toFixed(2) + ',' + parseFloat(row[10]||0).toFixed(2) + ',' + parseFloat(row[12]||0).toFixed(2) + ',' +
      (row[14]||'') + ',' + (row[21]||'') + ',' + (row[22]||'') + '\n';
    filas.push([row[2]||'', row[4]||'', row[5]||'', row[7]||'', row[8]||'', parseFloat(row[9]||0), parseFloat(row[10]||0), parseFloat(row[12]||0), row[14]||'', row[21]||'', row[22]||'']);
  });
  exportarExcelConEstilo(headers, filas, 'compras_' + new Date().toISOString().split('T')[0] + '.xlsx', 'Compras', csv);
}

function exportarComprasPDF() {
  window.print();
}
