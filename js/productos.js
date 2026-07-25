// ══ CACHÉ DE PRODUCTOS (compartido por ventas, compras, productos) ═════

let productosCache = [];

async function cargarProductos() {
  if (productosCache.length > 0) return;
  try {
    const rows = await obtenerDatosProtegidos('obtenerProductos');
    productosCache = rows.map(row => ({
      codigo: (row[0] || '').toString().trim(),
      sector: row[1] || '',
      subcategoria: row[2] || '',
      nombre: row[3] || '',
      precio: parseFloat(row[4]) || 0,
      codigoBarras: (row[5] || '').toString().trim(),
      stockMin: row[6] || 0
    }));
  } catch(e) {
    console.error('Error cargando productos:', e);
  }
}

async function buscarProductoPorCodigo(codigo) {
  if (!codigo || codigo.length < 3) return false;
  if (productosCache.length === 0) {
    await cargarProductos();
  }
  const prod = productosCache.find(p =>
    p.codigoBarras === codigo.trim() || p.codigo === codigo.trim()
  );
  if (prod) {
    document.getElementById('v-producto').value = prod.nombre;
    document.getElementById('v-precio').value = prod.precio || '';
    calcularTotalesVenta();
    mostrarScanResultado('✅ Producto encontrado: ' + prod.nombre, true);
    return true;
  } else {
    mostrarScanResultado('⚠️ Código no encontrado en Productos, sigue escaneando...', false);
    return false;
  }
}


// ══ MÓDULO PRODUCTOS ══════════════════════════════════════════════════════

function mostrarFormProducto() {
  document.getElementById('form-producto-container').style.display = 'block';
  cargarProductosLista();
}

function cerrarFormProducto() {
  document.getElementById('form-producto-container').style.display = 'none';
  limpiarFormProducto();
}

function limpiarFormProducto() {
  ['prod-codigo','prod-subcategoria','prod-nombre','prod-precio','prod-codigo-barras','prod-stock-min'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('prod-sector').value = '';
  const msg = document.getElementById('producto-msg');
  if (msg) { msg.style.display='none'; msg.textContent=''; }
}

async function guardarProducto() {
  const btn = document.getElementById('btn-guardar-producto');
  const msg = document.getElementById('producto-msg');
  const codigo = document.getElementById('prod-codigo').value.trim();
  const sector = document.getElementById('prod-sector').value;
  const nombre = document.getElementById('prod-nombre').value.trim();
  const precio = document.getElementById('prod-precio').value;

  if (!codigo || !sector || !nombre || !precio) {
    mostrarMensajeForm('producto-msg', 'error', '⚠️ Código, sector, nombre y precio son obligatorios.');
    return;
  }
  if (parseFloat(precio) <= 0) {
    mostrarMensajeForm('producto-msg', 'error', '⚠️ El precio debe ser mayor a 0.');
    return;
  }

  btn.disabled=true; btn.textContent='⏳ Guardando...';

  try {
    const accessToken = await obtenerAccessToken();
    const fila = [
      codigo,
      sector,
      document.getElementById('prod-subcategoria').value,
      nombre,
      precio,
      document.getElementById('prod-codigo-barras').value,
      document.getElementById('prod-stock-min').value || 0
    ];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/PRODUCTOS!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [fila] })
    });
    if (resp.ok) {
      mostrarMensajeForm('producto-msg', 'ok', '✅ Producto guardado correctamente.');
      productosCache = []; // Limpiar cache para que recargue
      limpiarFormProducto();
      setTimeout(() => cargarProductosLista(), 1500);
    } else { await lanzarErrorSheets(resp); }
  } catch(err) {
    mostrarMensajeForm('producto-msg', 'error', '❌ Error al guardar: ' + err.message);
  } finally { btn.disabled=false; btn.textContent='💾 Guardar'; }
}

async function cargarProductosLista() {
  const tbody = document.getElementById('productos-tbody');
  const count = document.getElementById('productos-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const rows = await obtenerDatosProtegidos('obtenerProductos');
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:#A0AEC0;">No hay productos registrados.</td></tr>';
      if (count) count.textContent = '0 productos'; return;
    }
    if (count) count.textContent = rows.length + ' producto(s)';
    tbody.innerHTML = rows.map(row => {
      const tieneBarras = row[5] && row[5].toString().trim() !== '';
      const badgeBarras = tieneBarras ? `<span class="badge badge-verde">📷 ${row[5]}</span>` : '<span class="badge badge-rojo">Sin código</span>';
      return `<tr>
        <td><b>${row[0]||'-'}</b></td>
        <td>${row[1]||'-'}</td>
        <td>${row[2]||'-'}</td>
        <td>${row[3]||'-'}</td>
        <td><b>S/. ${parseFloat(row[4]||0).toFixed(2)}</b></td>
        <td>${badgeBarras}</td>
        <td>${row[6]||'0'}</td>
      </tr>`;
    }).join('');
  } catch(err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--rojo);">❌ ${err.message}</td></tr>`;
  }
}
