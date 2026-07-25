// ══ ROUTER ═══════════════════════════════════════════════════════════════
// Sobrescribe showPage para que, al entrar a cada módulo, se disparen sus
// funciones de carga de datos. Debe cargarse AL FINAL (después de todos los
// demás módulos), porque depende de que cargarListaVentas, cargarCXP, etc.
// ya estén definidas.
const originalShowPage = showPage;
window.showPage = function(page) {
  originalShowPage(page);
  if (page === 'ventas') cargarListaVentas();
  if (page === 'compras') cargarListaCompras();
  if (page === 'productos') cargarProductosLista();
  if (page === 'inventarios') cargarInventarios();
  if (page === 'tesoreria') cargarTesoreria();
  if (page === 'cxp') cargarCXP();
  if (page === 'cxc') cargarCXC();
  if (page === 'planilla') cargarPlanilla();
  if (page === 'libros') { cargarLibroDiario(); mostrarLibro('diario'); }
};
