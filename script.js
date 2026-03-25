// ============================================================
// 1. VARIABLES GLOBALES Y OBJETOS
// ============================================================

// Objeto de estado general de la app
const APP = {
    gastos:      [],     // arreglo de transacciones
    config:      {       // objeto de configuración
        presupuesto: 0,
        umbral:      80
    },
    categorias:  [],     // arreglo cargado desde JSON (Fetch)
    filtro:      "todas" // filtro activo del historial
};

// Matriz de emojis por categoría (arreglo de arreglos)
const EMOJIS_CAT = [
    ["Alimentación", "🍔"],
    ["Arriendo",     "🏠"],
    ["Servicios",    "💡"],
    ["Transporte",   "🚗"],
    ["Salud",        "💊"],
    ["Educación",    "📚"],
    ["Diversión",    "🎉"],
    ["Ropa",         "👕"],
    ["Tecnología",   "📱"],
    ["Otros",        "📦"]
];

// ============================================================
// 2. DOCUMENT READY — jQuery
// ============================================================
$(document).ready(function () {

    // 1. Cargar datos del JSON via Fetch
    cargarDatosJSON();

    // 2. Cargar configuración y gastos desde LocalStorage
    cargarConfigLS();
    cargarGastosLS();

    // 3. Poner fecha de hoy por defecto en formulario
    $("#inp-fecha").val(getFechaHoy());

    // 4. Mostrar mes actual
    $("#mesActual").text(getMesActual());
    $("#fyear").text(new Date().getFullYear());

    // 5. Iniciar eventos y componentes
    configurarEventos();
    iniciarScrollTop();
    renderizarTodo();

    // 6. BOM: info del navegador
    registrarInfoNavegador();

    console.log("✅ MisGastos iniciado | Navegador:", navigator.userAgent.split(")")[0].split("(")[1]);
});

// ============================================================
// 3. FETCH — Cargar datos externos desde archivo.json
// ============================================================
function cargarDatosJSON() {
    fetch("gastos_archivo.json")
        .then(function (res) {
            if (!res.ok) throw new Error("Error " + res.status);
            return res.json();
        })
        .then(function (data) {
            // Guardar arreglo de categorías en estado
            APP.categorias = data.categorias;

            // Leer config por defecto del JSON (solo si no hay guardada en LS)
            const configGuardada = localStorage.getItem("mg_config");
            if (!configGuardada && data.config_default) {
                APP.config.presupuesto = data.config_default.presupuesto;
                APP.config.umbral      = data.config_default.umbral_alerta;
            }

            // Mostrar frase aleatoria del JSON en consola (arreglo)
            const frases = data.frases;
            const frase  = frases[Math.floor(Math.random() * frases.length)];
            console.log("💡 Consejo del día:", frase);

            renderizarTodo();
        })
        .catch(function (err) {
            console.warn("⚠️ Fetch falló, usando datos locales:", err.message);
            // Cargar categorías de respaldo (arreglo de objetos)
            APP.categorias = EMOJIS_CAT.map(function (par) {
                return { nombre: par[0], emoji: par[1] };
            });
        });
}

// ============================================================
// 4. LOCAL STORAGE — guardar / recuperar / eliminar
// ============================================================
function guardarGastosLS() {
    // JSON.stringify para convertir arreglo a string
    localStorage.setItem("mg_gastos", JSON.stringify(APP.gastos));
}

function cargarGastosLS() {
    const stored = localStorage.getItem("mg_gastos");
    if (stored) {
        // JSON.parse para convertir string a arreglo
        APP.gastos = JSON.parse(stored);
    }
}

function guardarConfigLS() {
    localStorage.setItem("mg_config", JSON.stringify(APP.config));
}

function cargarConfigLS() {
    const stored = localStorage.getItem("mg_config");
    if (stored) {
        APP.config = JSON.parse(stored);
    }
}

function eliminarTodosLS() {
    // BOM: confirm antes de eliminar
    const ok = confirm("¿Estás seguro de que quieres eliminar TODOS los gastos?\nEsta acción no se puede deshacer.");
    if (!ok) return;

    // Eliminar clave específica del LocalStorage
    localStorage.removeItem("mg_gastos");
    APP.gastos = [];
    renderizarTodo();
    mostrarToast("🗑️ Todos los gastos han sido eliminados.");
}

function eliminarGasto(id) {
    // Filtrar arreglo para remover el gasto por id
    const antes = APP.gastos.length;
    APP.gastos = APP.gastos.filter(function (g) { return g.id !== id; });

    if (APP.gastos.length < antes) {
        guardarGastosLS();
        renderizarTodo();
        mostrarToast("✅ Gasto eliminado.");
    }
}

// ============================================================
// 5. CONFIGURAR EVENTOS — jQuery + DOM
// ============================================================
function configurarEventos() {

    // ----- Formulario: submit -----
    $("#formGasto").on("submit", function (e) {
        e.preventDefault();
        agregarGasto();
    });

    // ----- Limpiar formulario -----
    $("#btnLimpiarForm").on("click", function () {
        limpiarFormulario();
        mostrarToast("🧹 Formulario limpiado.");
    });

    // ----- Abrir modal de presupuesto -----
    $("#btnPresupuesto").on("click", function () {
        // Precargar valores actuales en el modal
        $("#inp-presupuesto").val(APP.config.presupuesto || "");
        $("#inp-umbral").val(APP.config.umbral);
        $("#pctLabel").text(APP.config.umbral);

        // jQuery: fadeIn modal
        $("#modalPresupuesto").fadeIn(280);
        $("body").css("overflow", "hidden");
    });

    // ----- Guardar presupuesto -----
    $("#btnGuardarPresupuesto").on("click", function () {
        const pres  = parseFloat($("#inp-presupuesto").val());
        const umbral = parseInt($("#inp-umbral").val());

        // Validación con condicional
        if (!pres || pres <= 0) {
            mostrarToast("⚠️ Ingresa un presupuesto válido.");
            return;
        }

        // Actualizar objeto de configuración
        APP.config.presupuesto = pres;
        APP.config.umbral      = umbral;
        guardarConfigLS();

        cerrarModal();
        renderizarTodo();
        mostrarToast("💰 Presupuesto guardado: " + formatPeso(pres));
    });

    // ----- Cerrar modal -----
    $(document).on("click", ".modal-close, .modal-close-btn, .modal-overlay", function () {
        cerrarModal();
    });

    // ----- Filtro de categorías (evento change) -----
    $("#filtroCategoria").on("change", function () {
        APP.filtro = $(this).val();
        // jQuery: hide/show con animación en la lista
        renderizarHistorial();
    });

    // ----- Eliminar todos -----
    $("#btnEliminarTodo").on("click", eliminarTodosLS);

    // ----- Exportar resumen -----
    $("#btnExportar").on("click", exportarResumen);

    // ----- Menú móvil: jQuery slideToggle -----
    $("#menuToggle").on("click", function () {
        $("#mobileMenu").slideToggle(280);
    });

    $("#mobileMenu a").on("click", function () {
        $("#mobileMenu").slideUp(250);
    });

    // ----- Evento: change en monto/descripción para feedback en tiempo real -----
    $("#inp-monto").on("input", function () {
        const val = parseFloat($(this).val());
        const presupuesto = APP.config.presupuesto;
        const totalMes    = calcularTotalMes();

        // Condicional: alerta anticipada si el gasto supera lo disponible
        if (presupuesto > 0 && val > 0 && (totalMes + val) > presupuesto) {
            $(this).css("border-color", "#B83232");
        } else {
            $(this).css("border-color", "");
        }
    });

    // ----- Evento mouseover en tarjetas de resumen -----
    $(document).on("mouseenter", ".card", function () {
        // jQuery: find dentro de la card, animate en el valor
        $(this).find(".card-valor").animate({ fontSize: "2rem" }, 180);
    });
    $(document).on("mouseleave", ".card", function () {
        $(this).find(".card-valor").animate({ fontSize: "1.9rem" }, 180);
    });

    // ----- Tecla ESC para cerrar modal (BOM/DOM keydown) -----
    $(document).on("keydown", function (e) {
        if (e.key === "Escape" && $("#modalPresupuesto").is(":visible")) {
            cerrarModal();
        }
    });

    // ----- Scroll top -----
    $(window).on("scroll", function () {
        if ($(this).scrollTop() > 300) {
            $("#scrollTop").fadeIn(250);
        } else {
            $("#scrollTop").fadeOut(250);
        }
    });

    $("#scrollTop").on("click", function () {
        $("html, body").animate({ scrollTop: 0 }, 500);
    });

    // ----- Links de nav: smooth scroll -----
    $(document).on("click", ".nav-link", function (e) {
        const href = $(this).attr("href");
        if (href && href.startsWith("#")) {
            e.preventDefault();
            const destino = $(href);
            if (destino.length) {
                $("html, body").animate(
                    { scrollTop: destino.offset().top - 70 },
                    500
                );
            }
        }
    });
}

// ============================================================
// 6. AGREGAR GASTO — Validación + objeto + LocalStorage
// ============================================================
function agregarGasto() {
    // Leer valores del formulario
    const desc      = $("#inp-desc").val().trim();
    const monto     = parseFloat($("#inp-monto").val());
    const categoria = $("#inp-categoria").val();
    const fecha     = $("#inp-fecha").val();
    const nota      = $("#inp-nota").val().trim();

    // Validaciones con condicionales
    if (!desc) {
        mostrarToast("⚠️ Escribe una descripción.");
        $("#inp-desc").focus();
        return;
    }
    if (!monto || monto <= 0) {
        mostrarToast("⚠️ Ingresa un monto válido.");
        $("#inp-monto").focus();
        return;
    }
    if (!categoria) {
        mostrarToast("⚠️ Selecciona una categoría.");
        $("#inp-categoria").focus();
        return;
    }
    if (!fecha) {
        mostrarToast("⚠️ Selecciona una fecha.");
        return;
    }

    // Crear objeto gasto (JSON object)
    const gasto = {
        id:        Date.now(),           // identificador único
        desc:      desc,
        monto:     monto,
        categoria: categoria,
        fecha:     fecha,
        nota:      nota,
        emoji:     obtenerEmoji(categoria)
    };

    // Agregar al arreglo
    APP.gastos.unshift(gasto);   // unshift: inserta al inicio

    // Guardar en LocalStorage (stringify)
    guardarGastosLS();

    // Verificar alertas de presupuesto
    verificarAlerta();

    // Actualizar interfaz
    renderizarTodo();
    limpiarFormulario();

    mostrarToast("✅ Gasto registrado: " + formatPeso(monto));

    // BOM: alert si se sobrepasa el presupuesto
    const totalMes = calcularTotalMes();
    const presupuesto = APP.config.presupuesto;
    if (presupuesto > 0 && totalMes > presupuesto) {
        alert("⚠️ ¡Atención!\n\nHas superado tu presupuesto mensual.\n" +
              "Gastado: " + formatPeso(totalMes) + "\n" +
              "Presupuesto: " + formatPeso(presupuesto));
    }
}

// ============================================================
// 7. RENDERIZAR TODO — Actualiza toda la UI
// ============================================================
function renderizarTodo() {
    renderizarResumen();
    renderizarCategorias();
    renderizarHistorial();
    verificarAlerta();
}

// ============================================================
// 8. RENDERIZAR RESUMEN — DOM + jQuery animate
// ============================================================
function renderizarResumen() {
    const presupuesto = APP.config.presupuesto;
    const totalMes    = calcularTotalMes();
    const disponible  = presupuesto - totalMes;
    const pct         = presupuesto > 0 ? Math.min(Math.round((totalMes / presupuesto) * 100), 100) : 0;

    // Actualizar tarjetas — manipulación del DOM con jQuery
    $("#cardIngreso").text(presupuesto > 0 ? formatPeso(presupuesto) : "Sin configurar");
    $("#cardGasto").text(formatPeso(totalMes));

    if (presupuesto > 0) {
        $("#cardSaldo").text(formatPeso(Math.abs(disponible)));

        if (disponible < 0) {
            // Excedido
            $("#cardSaldoBox").addClass("peligro");
            $("#cardSaldoHint").text("¡Presupuesto superado!");
        } else if (pct >= APP.config.umbral) {
            // Cerca del límite
            $("#cardSaldoBox").removeClass("peligro");
            $("#cardSaldoHint").text("Cerca del límite");
        } else {
            $("#cardSaldoBox").removeClass("peligro");
            $("#cardSaldoHint").text("Puedes seguir gastando");
        }
    } else {
        $("#cardSaldo").text("—");
        $("#cardSaldoHint").text("Configura tu presupuesto");
    }

    // Barra de progreso con jQuery animate
    let clase = "";
    if (pct >= 100) clase = "danger";
    else if (pct >= APP.config.umbral) clase = "warn";

    $("#barFill")
        .removeClass("warn danger")
        .addClass(clase)
        .animate({ width: pct + "%" }, 700);

    // Texto del porcentaje — manipulación DOM
    $("#barPct").text(presupuesto > 0 ? pct + "%" : "—");
}

// ============================================================
// 9. RENDERIZAR CATEGORÍAS — DOM dinámico + ciclos
// ============================================================
function renderizarCategorias() {
    const gastosDelMes = filtrarGastosMesActual();
    const container    = document.getElementById("resumenCategorias");

    if (gastosDelMes.length === 0) {
        container.innerHTML = '<p class="empty-msg">Aún no hay gastos registrados este mes.</p>';
        return;
    }

    // Calcular totales por categoría usando un objeto (mapa)
    const totalesCat = {};
    for (let i = 0; i < gastosDelMes.length; i++) {
        const g   = gastosDelMes[i];
        const cat = g.categoria;
        if (!totalesCat[cat]) {
            totalesCat[cat] = { total: 0, emoji: g.emoji };
        }
        totalesCat[cat].total += g.monto;
    }

    // Calcular total general del mes
    const totalMes = calcularTotalMes();

    // Ordenar de mayor a menor (arreglo de pares)
    const categoriasSorted = Object.keys(totalesCat)
        .map(function (cat) {
            return { nombre: cat, total: totalesCat[cat].total, emoji: totalesCat[cat].emoji };
        })
        .sort(function (a, b) { return b.total - a.total; });

    // Limpiar y construir DOM
    container.innerHTML = "";

    // Ciclo for para crear elementos
    for (let i = 0; i < categoriasSorted.length; i++) {
        const cat = categoriasSorted[i];
        const pct = totalMes > 0 ? Math.round((cat.total / totalMes) * 100) : 0;

        // Crear elemento div — DOM dinámico
        const fila = document.createElement("div");
        fila.className = "cat-row";
        fila.innerHTML = `
            <span class="cat-emoji">${cat.emoji}</span>
            <span class="cat-nombre">${cat.nombre}</span>
            <div class="cat-bar-mini">
                <div class="cat-bar-fill" data-pct="${pct}" style="width:0%"></div>
            </div>
            <span class="cat-pct">${pct}%</span>
            <span class="cat-monto">${formatPeso(cat.total)}</span>
        `;
        container.appendChild(fila);
    }

    // Animar barras mini con jQuery
    setTimeout(function () {
        $(".cat-bar-fill").each(function () {
            const pct = $(this).data("pct");
            $(this).animate({ width: pct + "%" }, 600);
        });
    }, 100);
}

// ============================================================
// 10. RENDERIZAR HISTORIAL — DOM + jQuery hide/show + filtro
// ============================================================
function renderizarHistorial() {
    const lista = document.getElementById("listaGastos");

    // Aplicar filtro de categoría
    let gastosFiltrados;
    if (APP.filtro === "todas") {
        gastosFiltrados = APP.gastos;
    } else {
        // Filtrar arreglo con filter()
        gastosFiltrados = APP.gastos.filter(function (g) {
            return g.categoria === APP.filtro;
        });
    }

    // Estado vacío
    if (gastosFiltrados.length === 0) {
        lista.innerHTML = '<p class="empty-msg">No hay gastos' +
            (APP.filtro !== "todas" ? ' en "' + APP.filtro + '"' : '') +
            ' registrados.</p>';
        $("#totalFiltrado").hide();
        return;
    }

    lista.innerHTML = "";

    // Ciclo para construir la lista de transacciones
    gastosFiltrados.forEach(function (gasto) {
        const item = document.createElement("div");
        item.className = "tx-item";
        item.setAttribute("data-id", gasto.id);

        // Formatear fecha
        const fechaStr = formatFecha(gasto.fecha);

        item.innerHTML = `
            <span class="tx-emoji">${gasto.emoji}</span>
            <div class="tx-info">
                <div class="tx-desc">${gasto.desc}</div>
                <div class="tx-meta">
                    <span class="tx-cat">${gasto.categoria}</span>
                    ${fechaStr}
                    ${gasto.nota ? ' · <em>' + gasto.nota + '</em>' : ''}
                </div>
            </div>
            <span class="tx-monto">${formatPeso(gasto.monto)}</span>
            <button class="tx-del" title="Eliminar gasto" onclick="confirmarEliminar(${gasto.id})">✕</button>
        `;

        // jQuery: fadeIn al insertar el elemento
        $(item).hide();
        lista.appendChild(item);
        $(item).fadeIn(250);
    });

    // Total filtrado
    const totalFiltrado = gastosFiltrados.reduce(function (acc, g) { return acc + g.monto; }, 0);
    const textoTotal    = APP.filtro !== "todas"
        ? `Total en "${APP.filtro}": ${formatPeso(totalFiltrado)} (${gastosFiltrados.length} gastos)`
        : `Total: ${formatPeso(totalFiltrado)} (${gastosFiltrados.length} gastos)`;

    // jQuery: slideDown para mostrar total
    $("#totalFiltrado").text(textoTotal).slideDown(300);
}

// ============================================================
// 11. VERIFICAR ALERTA DE PRESUPUESTO — Condicionales + DOM
// ============================================================
function verificarAlerta() {
    const presupuesto = APP.config.presupuesto;
    if (presupuesto <= 0) {
        $("#alertaBanner").slideUp(300);
        return;
    }

    const totalMes = calcularTotalMes();
    const pct      = (totalMes / presupuesto) * 100;
    const banner   = $("#alertaBanner");

    // Condicional para tipo de alerta
    if (pct >= 100) {
        // Superado
        $("#alertaTexto").text(
            "🚨 ¡Presupuesto superado! Gastaste " + formatPeso(totalMes) +
            " de " + formatPeso(presupuesto) + " (" + Math.round(pct) + "%)."
        );
        banner.removeClass("warn").addClass("danger");
        banner.slideDown(350);
    } else if (pct >= APP.config.umbral) {
        // Cerca del límite
        const restante = presupuesto - totalMes;
        $("#alertaTexto").text(
            "⚠️ Llevas el " + Math.round(pct) + "% de tu presupuesto. " +
            "Te quedan " + formatPeso(restante) + "."
        );
        banner.removeClass("danger").addClass("warn");
        banner.slideDown(350);
    } else {
        // Todo bien
        banner.slideUp(300);
    }
}

// ============================================================
// 12. CONFIRMAR ELIMINAR — BOM confirm
// ============================================================
function confirmarEliminar(id) {
    // Buscar el gasto en el arreglo
    const gasto = APP.gastos.find(function (g) { return g.id === id; });
    if (!gasto) return;

    // BOM: confirm con detalle del gasto
    const ok = confirm(
        "¿Eliminar este gasto?\n\n" +
        "📌 " + gasto.desc + "\n" +
        "💰 " + formatPeso(gasto.monto) + " — " + gasto.categoria
    );

    if (ok) eliminarGasto(id);
}

// ============================================================
// 13. EXPORTAR RESUMEN — Clipboard API + BOM
// ============================================================
function exportarResumen() {
    const totalMes    = calcularTotalMes();
    const presupuesto = APP.config.presupuesto;
    const mes         = getMesActual();
    const gastosDelMes = filtrarGastosMesActual();

    // Calcular por categoría
    const totalesCat = {};
    gastosDelMes.forEach(function (g) {
        if (!totalesCat[g.categoria]) totalesCat[g.categoria] = 0;
        totalesCat[g.categoria] += g.monto;
    });

    // Construir texto de resumen
    let texto = "📊 RESUMEN DE GASTOS — " + mes.toUpperCase() + "\n";
    texto += "═══════════════════════════\n";
    if (presupuesto > 0) {
        texto += "Presupuesto: " + formatPeso(presupuesto) + "\n";
    }
    texto += "Total gastado: " + formatPeso(totalMes) + "\n";
    if (presupuesto > 0) {
        const disponible = presupuesto - totalMes;
        texto += "Disponible: " + formatPeso(disponible) + "\n";
    }
    texto += "───────────────────────────\n";
    texto += "POR CATEGORÍA:\n";

    // Ciclo para listar categorías en el texto
    for (const cat in totalesCat) {
        if (totalesCat.hasOwnProperty(cat)) {
            texto += "  " + obtenerEmoji(cat) + " " + cat + ": " + formatPeso(totalesCat[cat]) + "\n";
        }
    }

    texto += "═══════════════════════════\n";
    texto += "Generado con MisGastos · " + new Date().toLocaleDateString("es-CO");

    // BOM: clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
            mostrarToast("📋 Resumen copiado al portapapeles.");
        }).catch(function () {
            // Fallback: prompt con el texto
            prompt("Copia este resumen:", texto);
        });
    } else {
        // Fallback si clipboard no disponible (BOM: prompt)
        prompt("Copia este resumen:", texto);
    }
}

// ============================================================
// 14. FUNCIONES DE CÁLCULO (Matemáticas)
// ============================================================

// Total gastado en el mes actual
function calcularTotalMes() {
    const mesActual = getFechaHoy().substring(0, 7); // "YYYY-MM"
    let total = 0;

    // Ciclo for para sumar gastos del mes
    for (let i = 0; i < APP.gastos.length; i++) {
        const g = APP.gastos[i];
        if (g.fecha && g.fecha.startsWith(mesActual)) {
            total += g.monto;
        }
    }
    return total;
}

// Filtrar gastos del mes actual
function filtrarGastosMesActual() {
    const mesActual = getFechaHoy().substring(0, 7);
    return APP.gastos.filter(function (g) {
        return g.fecha && g.fecha.startsWith(mesActual);
    });
}

// ============================================================
// 15. UTILIDADES
// ============================================================

function obtenerEmoji(categoria) {
    // Buscar en la matriz de emojis (ciclo)
    for (let i = 0; i < EMOJIS_CAT.length; i++) {
        if (EMOJIS_CAT[i][0] === categoria) return EMOJIS_CAT[i][1];
    }
    // Si hay categorías del JSON, buscar ahí también
    if (APP.categorias) {
        const encontrada = APP.categorias.find(function (c) { return c.nombre === categoria; });
        if (encontrada) return encontrada.emoji;
    }
    return "📦";
}

function formatPeso(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return "$0";
    return "$" + Math.round(valor).toLocaleString("es-CO");
}

function getFechaHoy() {
    // BOM: Date object
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes  = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia  = String(hoy.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

function getMesActual() {
    const hoy   = new Date();
    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                   "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return meses[hoy.getMonth()] + " " + hoy.getFullYear();
}

function formatFecha(fechaStr) {
    if (!fechaStr) return "";
    const partes = fechaStr.split("-");
    if (partes.length < 3) return fechaStr;
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const mes   = meses[parseInt(partes[1]) - 1] || partes[1];
    return partes[2] + " " + mes + " " + partes[0];
}

function limpiarFormulario() {
    // Resetear formulario
    document.getElementById("formGasto").reset();
    // Poner fecha de hoy de nuevo
    $("#inp-fecha").val(getFechaHoy());
    // Quitar bordes de error
    $("#inp-monto").css("border-color", "");
}

function cerrarModal() {
    // jQuery: fadeOut modal
    $("#modalPresupuesto").fadeOut(250);
    $("body").css("overflow", "");
}

function mostrarToast(msg) {
    // jQuery: fadeIn → delay → fadeOut (animaciones encadenadas)
    $("#toast").text(msg).stop(true).fadeIn(300).delay(2800).fadeOut(400);
}

// ============================================================
// 16. SCROLL TOP
// ============================================================
function iniciarScrollTop() {
    // El evento scroll ya está en configurarEventos()
    // El botón también
}

// ============================================================
// 17. BOM — Registrar información del navegador
// ============================================================
function registrarInfoNavegador() {
    // Objeto con info del BOM navigator
    const infoNav = {
        idioma:     navigator.language,
        plataforma: navigator.platform,
        online:     navigator.onLine,
        cookies:    navigator.cookieEnabled
    };

    // Guardar info como objeto JSON en localStorage
    localStorage.setItem("mg_nav_info", JSON.stringify(infoNav));

    // Condicional: sin conexión
    if (!navigator.onLine) {
        mostrarToast("⚠️ Sin conexión a Internet. Los datos se guardan localmente.");
    }

    // Verificar si hay datos previos (sesión anterior)
    const historialPrevio = localStorage.getItem("mg_gastos");
    if (historialPrevio) {
        const gastos = JSON.parse(historialPrevio);
        if (gastos.length > 0) {
            const ultimo = gastos[0];
            console.log("📌 Último gasto registrado:", ultimo.desc, "—", formatPeso(ultimo.monto));
        }
    }
}

// ============================================================
// 18. PROMPT AL PRIMER USO — BOM
// ============================================================
$(window).on("load", function () {
    // Si no hay presupuesto configurado, BOM: prompt para configurarlo
    const configGuardada = localStorage.getItem("mg_config");
    const tienePresupuesto = configGuardada && JSON.parse(configGuardada).presupuesto > 0;

    if (!tienePresupuesto) {
        setTimeout(function () {
            // BOM: prompt
            const pres = prompt(
                "👋 ¡Bienvenido a MisGastos!\n\n" +
                "Para empezar, ¿cuál es tu presupuesto mensual?\n" +
                "(Escribe solo el número, sin puntos ni comas)"
            );

            if (pres && parseFloat(pres) > 0) {
                APP.config.presupuesto = parseFloat(pres);
                guardarConfigLS();
                renderizarResumen();
                mostrarToast("💰 Presupuesto configurado: " + formatPeso(APP.config.presupuesto));
            }
        }, 800);
    }
});
