/* ==========================================
   LÓGICA PRINCIPAL - EL QUINCHO RESERVAS
   ========================================== */

// Capturador de errores global para mostrar alertas en caso de fallos
window.onerror = function(message, source, lineno, colno, error) {
  alert("ERROR DETECTADO: " + message + "\nEn: " + source + " (Línea: " + lineno + ")\nDetalles: " + (error ? error.stack : ""));
  return false;
};

// Número de WhatsApp del dueño (Configurable en producción)
const OWNER_PHONE = "5492604552146"; // Configurado al WhatsApp del propietario 2604552146

// Cifrado simple XOR + Hexadecimal para proteger datos en archivos públicos
const SECRET_KEY = "admin3r";

function encrypt(text, key = SECRET_KEY) {
  if (text === undefined || text === null) return "";
  const str = String(text);
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += ("0" + charCode.toString(16)).slice(-2);
  }
  return result;
}

function decrypt(hex, key = SECRET_KEY) {
  if (!hex) return "";
  try {
    let result = "";
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16) ^ key.charCodeAt((i / 2) % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    return "[Cifrado]";
  }
}

// Obtener las reservas desencriptadas (solo para el admin logueado)
function getDecryptedBookings() {
  const isLogged = localStorage.getItem("admin_logged") === "true";
  const key = SECRET_KEY; // Usar siempre SECRET_KEY constante para encriptar/desencriptar de forma consistente
  return bookings.map(b => {
    if (b.isEncrypted) {
      return {
        ...b,
        name: isLogged ? decrypt(b.name, key) : "[Reservado]",
        phone: isLogged ? decrypt(b.phone, key) : "",
        notes: isLogged ? decrypt(b.notes, key) : "",
        totalPrice: isLogged ? (Number(decrypt(b.totalPrice, key)) || 0) : 0,
        deposit: isLogged ? (Number(decrypt(b.deposit, key)) || 0) : 0
      };
    }
    // Si no está encriptada pero la cargamos (respaldo local), simular la ocultación si no es admin
    if (!isLogged) {
      return {
        ...b,
        name: "[Reservado]",
        phone: "",
        notes: "",
        totalPrice: 0,
        deposit: 0
      };
    }
    return {
      ...b,
      totalPrice: Number(b.totalPrice) || 0,
      deposit: Number(b.deposit) || 0
    };
  });
}

// Estado Global de la Aplicación
let bookings = [];
let expenses = []; // Gastos de limpieza, servicios, mantenimiento, etc.
let currentDate = new Date();
let selectedDateStr = null;
let currentCarouselIndex = 0;

// Feriados nacionales en Argentina
let holidays = [];
let holidayNames = {};
let loadedHolidaysYear = null;
let adminSelectedDateStr = null; // Guardará la fecha seleccionada en el panel admin
let isEditMode = false;
let editOriginalDate = null;
let editOriginalSlot = null;

// Función para limpiar y normalizar la URL de Supabase eliminando subrutas duplicadas
function normalizeSupabaseUrl(url) {
  if (!url) return "";
  let cleanUrl = url.trim();
  if (cleanUrl.endsWith("/")) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  if (cleanUrl.endsWith("/rest/v1")) {
    cleanUrl = cleanUrl.slice(0, -8);
  }
  if (cleanUrl.endsWith("/")) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  return cleanUrl;
}

// Configuración de Supabase (valores fijos por defecto para que conecte automáticamente en todos los dispositivos)
const DEFAULT_SB_URL = "https://xmiuelsdeojlhhmjgxwt.supabase.co";
const DEFAULT_SB_KEY = "sb_publishable_d-jgifmPM7jWxOEWzgle4g_H_OjHAIY";

let supabaseUrl = normalizeSupabaseUrl(localStorage.getItem("sb_url") || DEFAULT_SB_URL);
let supabaseKey = (localStorage.getItem("sb_key") || DEFAULT_SB_KEY).trim();

// --- COMPORTAMIENTO DE DESLIZAMIENTO (SWIPE) PARA DISPOSITIVOS MÓVILES ---
function setupSwipeGestures() {
  // 1. Swipe para el carrusel principal
  const mainCarousel = document.querySelector(".carousel-container");
  if (mainCarousel) {
    let startX = 0;
    mainCarousel.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });
    
    mainCarousel.addEventListener("touchend", (e) => {
      const endX = e.changedTouches[0].clientX;
      const diffX = startX - endX;
      if (diffX > 50) {
        moveCarousel(1); // Deslizar a la izquierda -> siguiente
      } else if (diffX < -50) {
        moveCarousel(-1); // Deslizar a la derecha -> anterior
      }
    }, { passive: true });
  }

  // 2. Swipe para la galería de fotos de servicios
  const galleryCarousel = document.querySelector(".gallery-carousel-container");
  if (galleryCarousel) {
    let startX = 0;
    galleryCarousel.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });
    
    galleryCarousel.addEventListener("touchend", (e) => {
      const endX = e.changedTouches[0].clientX;
      const diffX = startX - endX;
      if (diffX > 50) {
        nextGallerySlide(); // Deslizar a la izquierda -> siguiente
      } else if (diffX < -50) {
        prevGallerySlide(); // Deslizar a la derecha -> anterior
      }
    }, { passive: true });
  }

  // 3. Swipe para el calendario de clientes (Cambio de mes)
  const clientCalendar = document.querySelector(".calendar-wrapper");
  if (clientCalendar) {
    let startX = 0;
    let startY = 0;
    clientCalendar.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    
    clientCalendar.addEventListener("touchend", (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = startX - endX;
      const diffY = startY - endY;
      
      // Permitir swipe solo si es predominantemente horizontal y supera los 60px
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
        if (diffX > 0) {
          // Deslizar izquierda -> siguiente mes
          currentDate.setMonth(currentDate.getMonth() + 1);
          renderCalendar();
        } else {
          // Deslizar derecha -> anterior mes
          currentDate.setMonth(currentDate.getMonth() - 1);
          renderCalendar();
        }
      }
    }, { passive: true });
  }

  // 4. Swipe para el calendario de administración (Cambio de mes)
  const adminCalendar = document.querySelector(".admin-calendar-wrapper");
  if (adminCalendar) {
    let startX = 0;
    let startY = 0;
    adminCalendar.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    
    adminCalendar.addEventListener("touchend", (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = startX - endX;
      const diffY = startY - endY;
      
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
        if (diffX > 0) {
          // Deslizar izquierda -> siguiente mes
          currentDate.setMonth(currentDate.getMonth() + 1);
          renderAdminCalendar();
          renderAdminBookings();
        } else {
          // Deslizar derecha -> anterior mes
          currentDate.setMonth(currentDate.getMonth() - 1);
          renderAdminCalendar();
          renderAdminBookings();
        }
      }
    }, { passive: true });
  }
}

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  // Registrar el Service Worker solo si NO es un entorno local (localhost, 127.0.0.1 o file://)
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' || 
                  window.location.protocol === 'file:';
  if ('serviceWorker' in navigator && !isLocal) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado con éxito', reg))
      .catch(err => console.warn('Error al registrar el Service Worker', err));
  } else if ('serviceWorker' in navigator && isLocal) {
    // Desregistrar cualquier service worker activo para evitar el cacheo durante pruebas locales
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
    console.log('Modo de prueba local detectado: Cacheo PWA desactivado para desarrollo rápido.');
  }

  // Cargar Reservas
  initApp();

  // Configurar gestos táctiles (swipe)
  setupSwipeGestures();

  // Si el administrador ya estaba logueado previamente, mostrar el botón de navegación
  if (localStorage.getItem("admin_logged") === "true") {
    const adminNav = document.getElementById("nav-admin-section");
    if (adminNav) adminNav.classList.remove("hidden");
  }

  // Entrada secreta al panel de Administración (5 clics en el logo del header)
  let logoClicksCount = 0;
  const headerLogo = document.getElementById("headerLogo");
  if (headerLogo) {
    headerLogo.addEventListener("click", () => {
      logoClicksCount++;
      if (logoClicksCount >= 5) {
        logoClicksCount = 0;
        const password = prompt("Ingrese la contraseña de Administrador para habilitar el panel:");
        if (password === "admin3r" || password === "admin123") {
          const adminNav = document.getElementById("nav-admin-section");
          if (adminNav) adminNav.classList.remove("hidden");
          localStorage.setItem("admin_logged", "true");
          sessionStorage.setItem("admin_key", password);
          switchTab("admin-section");
          showAdminPanel();
          alert("Acceso Administrador habilitado.");
        } else if (password !== null) {
          alert("Contraseña incorrecta.");
        }
      }
    });
  }

  // Controladores del Calendario Cliente
  document.getElementById("prev-month-btn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
    renderAdminCalendar();
    renderAdminBookings(); // Filtrar y refrescar listado
  });
  document.getElementById("next-month-btn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
    renderAdminCalendar();
    renderAdminBookings(); // Filtrar y refrescar listado
  });

  // Controladores del Calendario Admin
  const adminPrevBtn = document.getElementById("admin-prev-month-btn");
  const adminNextBtn = document.getElementById("admin-next-month-btn");
  if (adminPrevBtn) {
    adminPrevBtn.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
      renderAdminCalendar();
      renderAdminBookings(); // Filtrar y refrescar listado
    });
  }
  if (adminNextBtn) {
    adminNextBtn.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
      renderAdminCalendar();
      renderAdminBookings(); // Filtrar y refrescar listado
    });
  }

  // Autologin si ya estaba logueado
  if (localStorage.getItem("admin_logged") === "true") {
    showAdminPanel();
  }

  // Auto-slide en el Carrusel cada 5 segundos
  setInterval(() => {
    moveCarousel(1);
  }, 5000);
});

// --- CARGA DE DATOS (LOCAL O SUPABASE) ---
async function initApp() {
  await initCarouselGallery();
  await loadBookings();
  loadExpenses(); // Cargar Gastos
  renderCalendar();
  renderAdminCalendar(); // Cargar Calendario Admin
  
  // Inicializar fecha de reserva manual y gasto con el día de hoy
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  
  if (document.getElementById("admin-date")) document.getElementById("admin-date").value = todayStr;
  if (document.getElementById("expense-date")) document.getElementById("expense-date").value = todayStr;
  
  // Cargar costo de limpieza inicial
  const cleaningCost = localStorage.getItem("cleaning_cost") || "4000";
  const cleaningInput = document.getElementById("cleaning-cost-input");
  if (cleaningInput) cleaningInput.value = cleaningCost;

  // Escuchar cambios en el precio total para actualizar la seña si está activado Pago Completo
  const totalPriceInput = document.getElementById("admin-total-price");
  if (totalPriceInput) {
    totalPriceInput.addEventListener("input", () => {
      const paidFullCheckbox = document.getElementById("admin-paid-full");
      if (paidFullCheckbox && paidFullCheckbox.checked) {
        document.getElementById("admin-deposit").value = totalPriceInput.value || 0;
      }
    });
  }

  // Renderizar listados y balances financieros
  renderExpenses();
  populateFinanceYears();
  updateFinanceSummary();
  
  // Cargar campos de Supabase si existen
  if (supabaseUrl) document.getElementById("sb-url").value = supabaseUrl;
  if (supabaseKey) document.getElementById("sb-key").value = supabaseKey;
}

// Cargar reservas desde Supabase, bookings.json o localStorage
async function loadBookings() {
  // 1. Intentar desde Supabase si está configurado
  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/bookings?select=*`, {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      });
      if (response.ok) {
        bookings = await response.json();
        console.log("Reservas cargadas desde Supabase:", bookings);
        localStorage.setItem("local_bookings_backup", JSON.stringify(bookings));
        return;
      }
    } catch (e) {
      console.warn("Fallo de conexión a Supabase, intentando local...", e);
    }
  }

  // 2. Intentar desde LocalStorage (copia de trabajo reciente)
  const localData = localStorage.getItem("local_bookings_backup");
  if (localData) {
    bookings = JSON.parse(localData);
    console.log("Reservas cargadas desde LocalStorage");
    return;
  }

  // 3. Cargar desde bookings.json o usar datos iniciales en duro como respaldo absoluto (ideal para pruebas directas)
  const defaultMockBookings = [
    { "date": "2026-08-15", "slot": "night", "name": "Pedro", "phone": "5492611234567", "totalPrice": 50000, "deposit": 20000 },
    { "date": "2026-08-16", "slot": "day", "name": "Juan", "phone": "5492617654321", "totalPrice": 40000, "deposit": 40000 },
    { "date": "2026-08-22", "slot": "night", "name": "María", "totalPrice": 60000, "deposit": 0 },
    { "date": "2026-08-23", "slot": "day", "name": "Carlos", "phone": "5492615555555", "totalPrice": 55000, "deposit": 15000 }
  ];

  try {
    const response = await fetch("./bookings.json");
    if (response.ok) {
      bookings = await response.json();
      console.log("Reservas cargadas desde bookings.json");
    } else {
      bookings = defaultMockBookings;
      console.log("No se pudo obtener bookings.json de forma remota, cargando respaldo local");
    }
  } catch (err) {
    console.warn("Entorno local sin servidor (CORS) detectado, cargando reservas de respaldo:", err);
    bookings = defaultMockBookings;
  }
  localStorage.setItem("local_bookings_backup", JSON.stringify(bookings));
}

// Guardar reserva (Local o Supabase)
async function saveBooking(booking) {
  // Encriptar los campos si no están encriptados ya
  const encryptedBooking = booking.isEncrypted ? booking : {
    date: booking.date,
    slot: booking.slot,
    name: encrypt(booking.name),
    phone: encrypt(booking.phone),
    totalPrice: encrypt(booking.totalPrice),
    deposit: encrypt(booking.deposit),
    notes: encrypt(booking.notes || ""),
    isEncrypted: true,
    isGCal: booking.isGCal || false
  };

  bookings.push(encryptedBooking);
  localStorage.setItem("local_bookings_backup", JSON.stringify(bookings));

  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/bookings`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(encryptedBooking)
      });
      if (response.ok) {
        console.log("Reserva guardada en Supabase");
      }
    } catch (e) {
      console.error("Error al sincronizar con Supabase", e);
    }
  }
}

// Eliminar reserva (Local o Supabase)
async function deleteBooking(date, slot) {
  bookings = bookings.filter(b => !(b.date === date && b.slot === slot));
  localStorage.setItem("local_bookings_backup", JSON.stringify(bookings));

  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/bookings?date=eq.${date}&slot=eq.${slot}`, {
        method: "DELETE",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      });
      if (response.ok) {
        console.log("Reserva eliminada de Supabase");
      }
    } catch (e) {
      console.error("Error al eliminar en Supabase", e);
    }
  }
}

// --- CONTRAL DE SECCIONES (TABS) ---
function switchTab(sectionId) {
  // Desactivar todas las vistas
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });
  
  // Desactivar todos los botones de navegación
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("active");
  });

  // Activar la seleccionada
  document.getElementById(sectionId).classList.add("active");
  document.getElementById(`nav-${sectionId}`).classList.add("active");

  // Acciones especiales al cambiar de sección
  if (sectionId === "calendar-section") {
    renderCalendar();
    // Ocultar caja de detalles al cambiar de vista para empezar limpio
    document.getElementById("day-details-box").classList.add("hidden");
  } else if (sectionId === "admin-section") {
    if (localStorage.getItem("admin_logged") === "true") {
      renderAdminBookings();
    }
  }
}

// --- CONTROL DE CARRUSEL DE FOTOS ---
function moveCarousel(step) {
  const slides = document.querySelectorAll(".carousel-slide");
  const indicators = document.querySelectorAll(".carousel-indicators .indicator");
  
  slides[currentCarouselIndex].classList.remove("active");
  indicators[currentCarouselIndex].classList.remove("active");

  currentCarouselIndex = (currentCarouselIndex + step + slides.length) % slides.length;

  slides[currentCarouselIndex].classList.add("active");
  indicators[currentCarouselIndex].classList.add("active");
}

function setCarouselSlide(index) {
  const slides = document.querySelectorAll(".carousel-slide");
  const indicators = document.querySelectorAll(".carousel-indicators .indicator");
  
  slides[currentCarouselIndex].classList.remove("active");
  indicators[currentCarouselIndex].classList.remove("active");

  currentCarouselIndex = index;

  slides[currentCarouselIndex].classList.add("active");
  indicators[currentCarouselIndex].classList.add("active");
}

// --- GENERACIÓN DEL CALENDARIO ---
async function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Nombre del mes y año en el encabezado
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  document.getElementById("calendar-month-year").innerText = `${monthNames[month]} ${year}`;

  // Cargar feriados si cambiamos de año
  if (loadedHolidaysYear !== year) {
    loadedHolidaysYear = year;
    await fetchHolidays(year);
  }

  const grid = document.getElementById("calendar-days-grid");
  grid.innerHTML = "";

  // Primer día de la semana del mes (0 = Domingo, 1 = Lunes, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Cantidad de días del mes
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Días vacíos para completar el inicio del mes
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.classList.add("calendar-day", "empty");
    grid.appendChild(emptyDay);
  }

  // Días válidos del mes
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEl = document.createElement("div");
    dayEl.classList.add("calendar-day");

    // Determinar si es fin de semana (Domingo o Sábado)
    const dayOfWeek = new Date(year, month, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) {
      dayEl.classList.add("weekend");
    }

    // Determinar si es feriado en Argentina
    const isHoliday = holidays.includes(dateStr);
    if (isHoliday) {
      dayEl.classList.add("holiday");
      dayEl.setAttribute("title", holidayNames[dateStr] || "Feriado");
    }

    // Determinar si es feriado o fin de semana
    const isSpecialDay = isWeekend || isHoliday;

    // Buscar reservas para este día
    const dayBookings = bookings.filter(b => b.date === dateStr);
    const dayReserved = dayBookings.some(b => b.slot === "day");
    const nightReserved = dayBookings.some(b => b.slot === "night");

    // Colores correspondientes
    // Libre: Amarillo para Mañana, Gris Claro para Noche
    // Ocupado: Rojo para Feriados/Finde, Naranja para Días hábiles comunes
    const dayColor = dayReserved ? (isSpecialDay ? "#dc2626" : "#ea580c") : "#fef08a";
    const nightColor = nightReserved ? (isSpecialDay ? "#dc2626" : "#ea580c") : "#f3f4f6";

    // Aplicar gradiente horizontal (arriba/abajo)
    dayEl.style.background = `linear-gradient(to bottom, ${dayColor} 50%, ${nightColor} 50%)`;

    dayEl.innerHTML = `<span class="day-number">${day}</span>`;

    // Si es el día seleccionado actualmente
    if (selectedDateStr === dateStr) {
      dayEl.classList.add("selected");
    }

    // Click en el día
    dayEl.addEventListener("click", () => {
      // Remover selección previa
      document.querySelectorAll(".calendar-day").forEach(el => el.classList.remove("selected"));
      dayEl.classList.add("selected");
      selectedDateStr = dateStr;
      showDayDetails(dateStr);
      
      // Sincronizar automáticamente la fecha en el formulario de administración
      document.getElementById("admin-date").value = dateStr;
    });

    grid.appendChild(dayEl);
  }
}

// Mostrar los turnos de un día seleccionado
function showDayDetails(dateStr) {
  const [year, month, day] = dateStr.split("-");
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  // Convertir a formato legible
  const dateObj = new Date(year, parseInt(month) - 1, day);
  const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const dayName = weekdays[dateObj.getDay()];
  
  document.getElementById("selected-day-title").innerText = `${dayName}, ${day} de ${months[parseInt(month) - 1]}`;

  // Verificar reservas para este día
  const dayBookings = bookings.filter(b => b.date === dateStr);
  const dayReserved = dayBookings.find(b => b.slot === "day");
  const nightReserved = dayBookings.find(b => b.slot === "night");

  // Configurar Turno Mañana
  const dayStatus = document.getElementById("slot-day-status");
  const dayBtn = document.getElementById("slot-day-btn");
  if (dayReserved) {
    dayStatus.innerText = "Reservado";
    dayStatus.className = "badge badge-danger";
    dayBtn.innerText = "No Disponible";
    dayBtn.disabled = true;
    dayBtn.className = "btn btn-sm btn-outline-danger";
  } else {
    dayStatus.innerText = "Disponible";
    dayStatus.className = "badge badge-success";
    dayBtn.innerText = "Reservar";
    dayBtn.disabled = false;
    dayBtn.className = "btn btn-sm btn-outline-primary";
  }

  // Configurar Turno Noche
  const nightStatus = document.getElementById("slot-night-status");
  const nightBtn = document.getElementById("slot-night-btn");
  if (nightReserved) {
    nightStatus.innerText = "Reservado";
    nightStatus.className = "badge badge-danger";
    nightBtn.innerText = "No Disponible";
    nightBtn.disabled = true;
    nightBtn.className = "btn btn-sm btn-outline-danger";
  } else {
    nightStatus.innerText = "Disponible";
    nightStatus.className = "badge badge-success";
    nightBtn.innerText = "Reservar";
    nightBtn.disabled = false;
    nightBtn.className = "btn btn-sm btn-outline-primary";
  }

  // Mostrar el panel de detalles
  document.getElementById("day-details-box").classList.remove("hidden");
}

// --- FORMULARIO DE RESERVA (WHATSAPP) ---
function openBookingForm(slot) {
  if (!selectedDateStr) return;
  
  const slotName = slot === "day" ? "Turno Mañana (10:00 a 19:00 hs)" : "Turno Noche (20:30 a 04:30 hs)";
  
  // Llenar campos invisibles/lectura
  document.getElementById("form-date").value = selectedDateStr;
  document.getElementById("form-slot").value = slot;
  document.getElementById("form-display-date").value = selectedDateStr.split("-").reverse().join("/");
  document.getElementById("form-display-slot").value = slotName;

  // Abrir Modal
  document.getElementById("booking-modal").classList.remove("hidden");
}

function closeBookingModal() {
  document.getElementById("booking-modal").classList.add("hidden");
  document.getElementById("booking-form").reset();
}

function handleBookingSubmit(event) {
  event.preventDefault();

  const date = document.getElementById("form-date").value;
  const slot = document.getElementById("form-slot").value;
  const name = document.getElementById("client-name").value;
  const phone = document.getElementById("client-phone").value;
  const guests = document.getElementById("client-guests").value || "No especificado";
  const notes = document.getElementById("client-notes").value || "Ninguna";

  const slotLabel = slot === "day" ? "Mañana (10:00 a 19:00 hs)" : "Noche (20:30 a 04:30 hs)";
  const formattedDate = date.split("-").reverse().join("/");

  // Construir mensaje de WhatsApp
  const text = `¡Hola! Vengo de la aplicación móvil de reservas de Quincho Las 3R 🏡\n\n` + 
               `Quiero solicitar una reserva:\n` +
               `📅 *Fecha:* ${formattedDate}\n` +
               `⏰ *Turno:* ${slotLabel}\n` +
               `👤 *Nombre:* ${name}\n` +
               `📞 *WhatsApp:* ${phone}\n` +
               `👥 *Invitados:* ${guests} personas\n` +
               `💬 *Consulta:* ${notes}\n\n` +
               `*Espero su confirmación para coordinar la seña.*`;

  const url = `https://wa.me/${OWNER_PHONE}?text=${encodeURIComponent(text)}`;
  
  // Abrir WhatsApp
  window.open(url, "_blank");

  // Cerrar Modal
  closeBookingModal();
}

// --- PANEL DE ADMINISTRACIÓN ---

// Login
function handleAdminLogin(event) {
  event.preventDefault();
  const password = document.getElementById("admin-password").value;

  if (password === "admin3r" || password === "admin123") {
    localStorage.setItem("admin_logged", "true");
    sessionStorage.setItem("admin_key", password);
    showAdminPanel();
    document.getElementById("admin-password").value = "";
    document.getElementById("login-error").classList.add("hidden");
  } else {
    document.getElementById("login-error").classList.remove("hidden");
  }
}

function showAdminPanel() {
  document.getElementById("admin-login-box").classList.add("hidden");
  document.getElementById("admin-panel").classList.remove("hidden");
  renderAdminBookings();
  renderAdminCalendar(); // Generar calendario admin al entrar
  renderExpenses();
  populateFinanceYears();
  updateFinanceSummary();
}

// Logout
function handleAdminLogout() {
  localStorage.setItem("admin_logged", "false");
  document.getElementById("admin-panel").classList.add("hidden");
  document.getElementById("admin-login-box").classList.remove("hidden");
}

// Listado de reservas en el panel admin (Filtrado por el mes/año en pantalla y desde hoy hacia adelante)
function clearAdminDayFilter(event) {
  if (event) event.preventDefault();
  adminSelectedDateStr = null;
  
  // Quitar la selección del calendario
  document.querySelectorAll("#admin-calendar-days-grid .calendar-day").forEach(el => el.classList.remove("selected"));
  
  // Ocultar formulario colapsable
  const collapsible = document.getElementById("admin-booking-fields-collapsible");
  if (collapsible) {
    collapsible.classList.add("hidden");
  }
  
  renderAdminBookings();
}

function renderAdminBookings() {
  const tbody = document.getElementById("admin-bookings-list");
  if (!tbody) return;
  tbody.innerHTML = "";

  const viewYear = currentDate.getFullYear();
  const viewMonth = currentDate.getMonth() + 1; // 1-indexed

  const decryptedBookingsList = getDecryptedBookings();
  const filteredBookings = decryptedBookingsList.filter(b => {
    if (!b || !b.date || typeof b.date !== 'string') return false;
    const [y, m, d] = b.date.split("-").map(Number);
    
    // Primero, debe pertenecer al mes/año en pantalla
    if (y !== viewYear || m !== viewMonth) return false;
    
    // Segundo, si hay un día seleccionado, mostrar solo las reservas de ese día
    if (adminSelectedDateStr) {
      return b.date === adminSelectedDateStr;
    }
    
    return true;
  });

  // Ordenar reservas por fecha y luego por turno (mañana antes de noche)
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.slot.localeCompare(b.slot);
  });

  // Actualizar el título de la tarjeta para indicar qué mes o día estamos viendo
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const listTitle = document.getElementById("admin-bookings-title");
  if (listTitle) {
    if (adminSelectedDateStr) {
      const [y, m, d] = adminSelectedDateStr.split("-").map(Number);
      listTitle.innerHTML = `<i class="fa-solid fa-list-check"></i> Reservas del ${d}/${m}/${y} <a href="#" onclick="clearAdminDayFilter(event)" style="font-size: 11px; margin-left: 10px; color: var(--accent); text-decoration: underline;">[Ver todo el mes]</a>`;
    } else {
      listTitle.innerHTML = `<i class="fa-solid fa-list-check"></i> Reservas de ${monthNames[currentDate.getMonth()]} ${viewYear}`;
    }
  }

  if (sortedBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary">No hay reservas activas/futuras para este mes.</td></tr>`;
    return;
  }

  sortedBookings.forEach(b => {
    const tr = document.createElement("tr");
    const formattedDate = b.date.split("-").reverse().join("/");
    const slotLabel = b.slot === "day" ? "Mañana" : "Noche";

    // Formatear valores financieros
    const totalPrice = b.totalPrice !== undefined ? `$${b.totalPrice}` : "-";
    const deposit = b.deposit !== undefined ? `$${b.deposit}` : "-";
    const balance = (b.totalPrice !== undefined && b.deposit !== undefined) ? `$${b.totalPrice - b.deposit}` : "-";

    // Formatear teléfono y crear link de WhatsApp normalizado para Argentina
    let waLink = "";
    if (b.phone && b.phone !== "GCal") {
      let cleanPhone = b.phone.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = "549" + cleanPhone;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) {
        cleanPhone = "549" + cleanPhone.substring(1);
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith("9")) {
        cleanPhone = "54" + cleanPhone;
      } else if (cleanPhone.length === 12 && cleanPhone.startsWith("54")) {
        cleanPhone = "549" + cleanPhone.substring(2);
      }
      
      waLink = `<a href="https://wa.me/${cleanPhone}" target="_blank" class="badge" style="background-color: #25d366; color: white; margin-left: 8px; font-size: 11px; padding: 3px 7px; text-decoration: none; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;" title="Chatear por WhatsApp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>`;
    }
    
    const notesDiv = b.notes ? `<div class="text-muted text-xs" style="margin-top: 4px; font-style: italic;"><i class="fa-regular fa-comment-dots"></i> ${b.notes}</div>` : "";
    const clientName = `${b.name}${waLink}${notesDiv}`;

    tr.innerHTML = `
      <td><strong>${formattedDate}</strong></td>
      <td>${slotLabel}</td>
      <td>${clientName}</td>
      <td>${totalPrice}</td>
      <td>${deposit}</td>
      <td><span style="font-weight: 600; color: ${b.totalPrice - b.deposit > 0 ? 'var(--warning)' : 'var(--success)'}">${balance}</span></td>
      <td>
        <div class="btn-group-row">
          <button class="btn btn-sm btn-outline-primary" onclick="editBookingAdmin('${b.date}', '${b.slot}')" title="Editar Reserva">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteBookingAdmin('${b.date}', '${b.slot}')" title="Eliminar Reserva">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Eliminar reserva desde Admin
async function deleteBookingAdmin(date, slot) {
  if (confirm(`¿Seguro que deseas eliminar la reserva del ${date.split("-").reverse().join("/")} (${slot === 'day' ? 'Mañana' : 'Noche'})?`)) {
    await deleteBooking(date, slot);
    renderAdminBookings();
    renderAdminCalendar(); // Refrescar calendario admin
    renderCalendar();
    
    // Actualizar balances financieros
    updateFinanceSummary();
    populateFinanceYears();
    
    // Ocultar o refrescar el panel de detalles si estaba mostrando ese día
    if (selectedDateStr === date) {
      showDayDetails(date);
    }
  }
}

// Agregar o editar reserva manual (Bloqueo de fechas)
async function handleAdminManualBooking(event) {
  event.preventDefault();
  const date = document.getElementById("admin-date").value;
  const slot = document.getElementById("admin-slot").value;
  const name = document.getElementById("admin-name").value;
  const phone = document.getElementById("admin-phone").value.trim();
  const totalPriceVal = parseInt(document.getElementById("admin-total-price").value) || 0;
  const depositVal = parseInt(document.getElementById("admin-deposit").value) || 0;
  const notesVal = document.getElementById("admin-notes").value.trim();

  // Validar si ya está ocupado (excluyendo el registro que estamos editando si aplica)
  const exists = bookings.some(b => 
    b.date === date && 
    b.slot === slot && 
    !(isEditMode && editOriginalDate === date && editOriginalSlot === slot)
  );
  if (exists) {
    alert("Este turno ya se encuentra reservado.");
    return;
  }

  const newBooking = { 
    date, 
    slot, 
    name, 
    phone, 
    totalPrice: totalPriceVal, 
    deposit: depositVal,
    notes: notesVal
  };

  if (isEditMode) {
    // Borrar original y registrar nuevo
    await deleteBooking(editOriginalDate, editOriginalSlot);
    await saveBooking(newBooking);
    cancelAdminEdit();
    alert("Reserva modificada correctamente.");
  } else {
    await saveBooking(newBooking);
    alert("Reserva manual agregada correctamente.");
  }

  // Limpiar campos y refrescar
  document.getElementById("admin-name").value = "";
  document.getElementById("admin-phone").value = "";
  document.getElementById("admin-total-price").value = "";
  document.getElementById("admin-deposit").value = "0";
  document.getElementById("admin-deposit").disabled = false;
  document.getElementById("admin-notes").value = "";
  
  const paidFullCheckbox = document.getElementById("admin-paid-full");
  if (paidFullCheckbox) {
    paidFullCheckbox.checked = false;
  }
  
  // Ocultar campos colapsables
  document.getElementById("admin-booking-fields-collapsible").classList.add("hidden");
  adminSelectedDateStr = null;

  renderAdminBookings();
  renderAdminCalendar(); // Refrescar calendario admin
  renderCalendar();
  
  // Actualizar balances financieros
  updateFinanceSummary();
  populateFinanceYears();
}

// Descargar bookings.json para GitHub
function downloadBookingsJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bookings, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "bookings.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Guardar configuración de Supabase
function handleSupabaseSave(event) {
  event.preventDefault();
  const rawUrl = document.getElementById("sb-url").value.trim();
  const key = document.getElementById("sb-key").value.trim();

  const normalizedUrl = normalizeSupabaseUrl(rawUrl);

  localStorage.setItem("sb_url", normalizedUrl);
  localStorage.setItem("sb_key", key);
  
  supabaseUrl = normalizedUrl;
  supabaseKey = key;

  alert("Configuración de base de datos en la nube guardada. Intentando recargar...");
  initApp();
}

// --- GESTIÓN FINANCIERA Y DE GASTOS ---

// Guardar el costo de limpieza en localStorage
function saveCleaningCost() {
  const input = document.getElementById("cleaning-cost-input");
  if (input) {
    const cost = parseInt(input.value) || 0;
    localStorage.setItem("cleaning_cost", cost);
    updateFinanceSummary();
  }
}

// Escuchar cambios en el checkbox de Pago Completo
function handlePaidFullChange() {
  const isPaidFull = document.getElementById("admin-paid-full").checked;
  const totalPriceInput = document.getElementById("admin-total-price");
  const depositInput = document.getElementById("admin-deposit");
  
  if (isPaidFull) {
    depositInput.value = totalPriceInput.value || 0;
    depositInput.disabled = true;
  } else {
    depositInput.disabled = false;
  }
}

// Cargar Gastos desde LocalStorage con valores iniciales si no existen
function loadExpenses() {
  const localData = localStorage.getItem("local_expenses_backup");
  if (localData) {
    expenses = JSON.parse(localData);
  } else {
    expenses = [
      { id: 1, date: "2026-08-10", category: "Limpieza", desc: "Pago limpieza inicial", amount: 4000 },
      { id: 2, date: "2026-08-11", category: "Mantenimiento", desc: "Compra cloro piscina", amount: 3500 }
    ];
    saveExpenses();
  }
}

// Guardar Gastos en LocalStorage
function saveExpenses() {
  localStorage.setItem("local_expenses_backup", JSON.stringify(expenses));
}

// Rellenar dinámicamente los años con transacciones en el selector financiero
function populateFinanceYears() {
  const yearSelect = document.getElementById("finance-year");
  if (!yearSelect) return;
  
  const years = new Set();
  years.add(new Date().getFullYear());
  
  bookings.forEach(b => {
    if (b && b.date && typeof b.date === 'string') {
      const y = parseInt(b.date.split("-")[0]);
      if (y) years.add(y);
    }
  });
  
  expenses.forEach(e => {
    if (e && e.date && typeof e.date === 'string') {
      const y = parseInt(e.date.split("-")[0]);
      if (y) years.add(y);
    }
  });
  
  const currentVal = yearSelect.value;
  yearSelect.innerHTML = "";
  
  Array.from(years).sort((a, b) => b - a).forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.innerText = y;
    yearSelect.appendChild(opt);
  });
  
  if (currentVal && Array.from(years).map(String).includes(currentVal)) {
    yearSelect.value = currentVal;
  } else {
    yearSelect.value = new Date().getFullYear();
  }
}

// Calcular y renderizar el Resumen de Ganancias del mes/año seleccionado
function updateFinanceSummary() {
  const yearSelect = document.getElementById("finance-year");
  const monthSelect = document.getElementById("finance-month");
  if (!yearSelect || !monthSelect) return;

  const yearVal = parseInt(yearSelect.value);
  const monthVal = monthSelect.value; // "all" o índice de mes "0" a "11"
  
  // Filtrar Reservas (desencriptando las ganancias si corresponde)
  const decryptedBookingsList = getDecryptedBookings();
  let filteredBookings = decryptedBookingsList.filter(b => {
    if (!b || !b.date || typeof b.date !== 'string') return false;
    const [y, m, d] = b.date.split("-").map(Number);
    if (y !== yearVal) return false;
    if (monthVal !== "all" && (m - 1) !== parseInt(monthVal)) return false;
    return true;
  });
  
  // Filtrar Gastos
  let filteredExpenses = expenses.filter(e => {
    if (!e || !e.date || typeof e.date !== 'string') return false;
    const [y, m, d] = e.date.split("-").map(Number);
    if (y !== yearVal) return false;
    if (monthVal !== "all" && (m - 1) !== parseInt(monthVal)) return false;
    return true;
  });
  
  // Obtener fecha de hoy local en formato YYYY-MM-DD para determinar si el evento ya sucedió o es hoy
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Filtrar solo las reservas concluidas (fecha <= hoy) para aplicar el gasto de limpieza
  const pastBookings = filteredBookings.filter(b => b.date <= todayStr);

  // Cargar costo de limpieza por reserva
  const cleaningCost = parseInt(localStorage.getItem("cleaning_cost")) || 4000;
  const totalCleaningExpenses = pastBookings.length * cleaningCost;

  // Calcular sumas: ingresos sumando la seña (deposit) de cada reserva (lo cobrado hasta ahora)
  const totalIncome = filteredBookings.reduce((sum, b) => sum + (Number(b.deposit) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + totalCleaningExpenses;
  const netProfit = totalIncome - totalExpenses;
  
  // Actualizar estadísticas en UI
  document.getElementById("stat-total-income").innerText = `$${totalIncome.toLocaleString()}`;
  document.getElementById("stat-total-expenses").innerText = `$${totalExpenses.toLocaleString()}`;
  
  const netEl = document.getElementById("stat-net-profit");
  netEl.innerText = `$${netProfit.toLocaleString()}`;
  if (netProfit >= 0) {
    netEl.style.color = "var(--success)";
  } else {
    netEl.style.color = "var(--danger)";
  }

  // Nota de desglose de limpieza
  const cleaningNoteEl = document.getElementById("finance-cleaning-note");
  if (cleaningNoteEl) {
    cleaningNoteEl.innerHTML = `<i class="fa-solid fa-broom"></i> Gasto limpieza automático incluido: <strong>$${totalCleaningExpenses.toLocaleString()}</strong> (${pastBookings.length} de ${filteredBookings.length} reservas realizadas/hoy x $${cleaningCost.toLocaleString()})`;
  }
}

// Registrar un Gasto desde el formulario admin
function handleAdminAddExpense(event) {
  event.preventDefault();
  const date = document.getElementById("expense-date").value;
  const category = document.getElementById("expense-category").value;
  const desc = document.getElementById("expense-desc").value.trim();
  const amount = parseInt(document.getElementById("expense-amount").value) || 0;
  
  const newExpense = {
    id: Date.now(),
    date,
    category,
    desc,
    amount
  };
  
  expenses.push(newExpense);
  saveExpenses();
  
  // Limpiar campos del formulario
  document.getElementById("expense-desc").value = "";
  document.getElementById("expense-amount").value = "";
  
  renderExpenses();
  updateFinanceSummary();
  populateFinanceYears();
  alert("Gasto registrado correctamente.");
}

// Eliminar un Gasto
function deleteExpense(id) {
  if (confirm("¿Estás seguro de que deseas eliminar este gasto del historial?")) {
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses();
    
    renderExpenses();
    updateFinanceSummary();
    populateFinanceYears();
  }
}

// Renderizar la tabla de listado de gastos
function renderExpenses() {
  const tbody = document.getElementById("admin-expenses-list");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  // Ordenar gastos por fecha descendiente
  const sortedExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  
  if (sortedExpenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No hay gastos registrados en el historial.</td></tr>`;
    return;
  }
  
  sortedExpenses.forEach(e => {
    const tr = document.createElement("tr");
    const formattedDate = e.date.split("-").reverse().join("/");
    
    tr.innerHTML = `
      <td><strong>${formattedDate}</strong></td>
      <td><span class="badge ${getCategoryBadgeClass(e.category)}">${e.category}</span></td>
      <td>${e.desc}</td>
      <td style="font-weight: 600; color: var(--danger)">$${e.amount}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(${e.id})">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Retorna la clase de estilo del badge según la categoría del gasto
function getCategoryBadgeClass(cat) {
  switch (cat) {
    case "Limpieza": return "badge-success";
    case "Mantenimiento": return "badge-danger";
    case "Servicios": return "badge-warning";
    default: return "badge-secondary";
  }
}

// Descargar Gastos en formato JSON crudo
function downloadExpensesJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(expenses, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "gastos.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Descargar reporte de Gastos en formato Excel (CSV)
function downloadExpensesCSV() {
  let csvContent = "\uFEFF"; // Añadir BOM UTF-8 para compatibilidad de acentos en Excel
  csvContent += "Fecha,Categoría,Descripción,Monto ($)\n";
  
  expenses.forEach(e => {
    const formattedDate = e.date.split("-").reverse().join("/");
    const row = `"${formattedDate}","${e.category}","${e.desc}",${e.amount}`;
    csvContent += row + "\n";
  });
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "reporte_gastos_quincho.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Detecta imágenes adicionales subidas por el usuario en la carpeta assets (foto1.jpg, foto2.jpg, etc.)
async function initCarouselGallery() {
  const defaultSlides = [
    { url: "./assets/quincho-main.jpg", title: "Salón & Parrilla", desc: "Espacio climatizado con asador profesional." },
    { url: "./assets/quincho-pool.jpg", title: "Piscina & Parque", desc: "Hermoso parque iluminado con pileta cristalina." }
  ];

  // Escanear en paralelo por foto1.jpg hasta foto12.jpg
  const maxPhotos = 12;
  const scanPromises = [];

  for (let i = 1; i <= maxPhotos; i++) {
    const url = `./assets/foto${i}.jpg`;
    scanPromises.push(
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ url, title: `Instalaciones ${i}`, desc: "Vista de nuestro quincho para eventos." });
        img.onerror = () => resolve(null);
        img.src = url;
      })
    );
  }

  const scannedResults = await Promise.all(scanPromises);
  const validScanned = scannedResults.filter(slide => slide !== null);

  // Combinar los predeterminados con los escaneados
  const allSlides = [...defaultSlides, ...validScanned];

  // Si hay más fotos, regeneramos el carrusel
  if (validScanned.length > 0) {
    const track = document.getElementById("carousel-track");
    const indicators = document.getElementById("carousel-indicators");
    
    if (track && indicators) {
      track.innerHTML = "";
      indicators.innerHTML = "";

      allSlides.forEach((slide, index) => {
        // Generar Slide
        const slideEl = document.createElement("div");
        slideEl.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
        slideEl.innerHTML = `
          <img src="${slide.url}" alt="${slide.title}">
          <div class="slide-caption">
            <h3>${slide.title}</h3>
            <p>${slide.desc}</p>
          </div>
        `;
        track.appendChild(slideEl);

        // Generar Indicador
        const indEl = document.createElement("span");
        indEl.className = `indicator ${index === 0 ? 'active' : ''}`;
        indEl.addEventListener("click", () => setCarouselSlide(index));
        indicators.appendChild(indEl);
      });
      
      // Reiniciar index del carrusel
      currentCarouselIndex = 0;
    }
  }
}

// --- GALERÍA DE FOTOS DE SERVICIOS (LIGHTBOX) ---
let currentGallerySlides = [];
let currentGalleryIndex = 0;

async function openServiceGallery(serviceId, serviceTitle) {
  const modal = document.getElementById("gallery-modal");
  const titleEl = document.getElementById("gallery-modal-title");
  const track = document.getElementById("gallery-modal-track");
  const indicators = document.getElementById("gallery-modal-indicators");
  
  if (!modal || !track || !indicators) return;
  
  titleEl.innerHTML = `<i class="fa-solid fa-images"></i> Galería: ${serviceTitle}`;
  track.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); gap: 10px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--accent);"></i>
      <span style="font-size:12px;">Buscando fotos en la carpeta assets...</span>
    </div>
  `;
  indicators.innerHTML = "";
  modal.classList.remove("hidden");
  
  // Escanear dinámicamente hasta 8 fotos para este servicio (ej: pileta1.jpg, pileta2.jpg, etc.)
  const maxPhotos = 8;
  const scanPromises = [];
  
  for (let i = 1; i <= maxPhotos; i++) {
    const url = `./assets/${serviceId}${i}.jpg`;
    scanPromises.push(
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(null);
        img.src = url;
      })
    );
  }
  
  const results = await Promise.all(scanPromises);
  const validUrls = results.filter(url => url !== null);
  
  // Si no se encuentra ninguna foto personalizada, usar una de las principales
  if (validUrls.length === 0) {
    let defaultUrl = "./assets/quincho-main.jpg";
    if (serviceId === "pileta") defaultUrl = "./assets/quincho-pool.jpg";
    if (serviceId === "equipamiento") defaultUrl = "./assets/quincho-pool.jpg";
    validUrls.push(defaultUrl);
  }
  
  track.innerHTML = "";
  currentGallerySlides = validUrls;
  currentGalleryIndex = 0;
  
  currentGallerySlides.forEach((url, index) => {
    const slideEl = document.createElement("div");
    slideEl.className = `gallery-slide ${index === 0 ? 'active' : ''}`;
    slideEl.innerHTML = `<img src="${url}" alt="${serviceTitle} ${index + 1}">`;
    track.appendChild(slideEl);
    
    const indEl = document.createElement("span");
    indEl.className = `gallery-indicator ${index === 0 ? 'active' : ''}`;
    indEl.addEventListener("click", () => setGallerySlide(index));
    indicators.appendChild(indEl);
  });
}

function closeServiceGallery() {
  const modal = document.getElementById("gallery-modal");
  if (modal) modal.classList.add("hidden");
}

function closeServiceGalleryOnBackdrop(event) {
  // Cerrar solo si se hace clic fuera del modal-content
  if (event.target.id === "gallery-modal") {
    closeServiceGallery();
  }
}

function setGallerySlide(index) {
  if (index < 0 || index >= currentGallerySlides.length) return;
  currentGalleryIndex = index;
  
  const slides = document.querySelectorAll(".gallery-slide");
  const indicators = document.querySelectorAll(".gallery-indicator");
  
  slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === index);
  });
  
  indicators.forEach((indicator, i) => {
    indicator.classList.toggle("active", i === index);
  });
}

function nextGallerySlide() {
  if (currentGallerySlides.length <= 1) return;
  let nextIndex = currentGalleryIndex + 1;
  if (nextIndex >= currentGallerySlides.length) {
    nextIndex = 0;
  }
  setGallerySlide(nextIndex);
}

function prevGallerySlide() {
  if (currentGallerySlides.length <= 1) return;
  let prevIndex = currentGalleryIndex - 1;
  if (prevIndex < 0) {
    prevIndex = currentGallerySlides.length - 1;
  }
  setGallerySlide(prevIndex);
}

// Obtener feriados oficiales de Argentina desde la API o usar respaldo fijo
async function fetchHolidays(year) {
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AR`);
    if (response.ok) {
      const data = await response.json();
      holidays = data.map(h => h.date);
      holidayNames = {};
      data.forEach(h => {
        holidayNames[h.date] = h.localName;
      });
      console.log(`Feriados de Argentina para ${year} cargados con éxito:`, data.length);
    } else {
      throw new Error("Respuesta de API no exitosa");
    }
  } catch (err) {
    console.warn("No se pudieron obtener los feriados desde la API, usando feriados básicos de respaldo", err);
    // Respaldo de feriados nacionales fijos en Argentina
    const fixedHolidays = [
      { date: `${year}-01-01`, name: "Año Nuevo" },
      { date: `${year}-03-24`, name: "Día de la Memoria" },
      { date: `${year}-04-02`, name: "Día de Malvinas" },
      { date: `${year}-05-01`, name: "Día del Trabajador" },
      { date: `${year}-05-25`, name: "Revolución de Mayo" },
      { date: `${year}-06-20`, name: "Día de la Bandera" },
      { date: `${year}-07-09`, name: "Día de la Independencia" },
      { date: `${year}-08-17`, name: "Paso a la Inmortalidad del Gral. San Martín" },
      { date: `${year}-10-12`, name: "Día del Respeto a la Diversidad Cultural" },
      { date: `${year}-11-20`, name: "Día de la Soberanía Nacional" },
      { date: `${year}-12-08`, name: "Inmaculada Concepción" },
      { date: `${year}-12-25`, name: "Navidad" }
    ];
    holidays = fixedHolidays.map(h => h.date);
    holidayNames = {};
    fixedHolidays.forEach(h => {
      holidayNames[h.date] = h.name;
    });
  }
}

// --- CALENDARIO ADMINISTRADOR INTERACTIVO ---

// Renderizar el calendario de reservas dentro del panel de administración
async function renderAdminCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Nombre del mes y año en el encabezado del admin
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const headerEl = document.getElementById("admin-calendar-month-year");
  if (headerEl) {
    headerEl.innerText = `${monthNames[month]} ${year}`;
  }

  const grid = document.getElementById("admin-calendar-days-grid");
  if (!grid) return;
  grid.innerHTML = "";

  // Primer día de la semana del mes (0 = Domingo, 1 = Lunes, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Cantidad de días del mes
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Días vacíos para completar el inicio del mes
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.classList.add("calendar-day", "empty");
    grid.appendChild(emptyDay);
  }

  // Días válidos del mes
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEl = document.createElement("div");
    dayEl.classList.add("calendar-day");

    // Determinar si es fin de semana (Domingo o Sábado)
    const dayOfWeek = new Date(year, month, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) {
      dayEl.classList.add("weekend");
    }

    // Determinar si es feriado en Argentina
    const isHoliday = holidays.includes(dateStr);
    if (isHoliday) {
      dayEl.classList.add("holiday");
      dayEl.setAttribute("title", holidayNames[dateStr] || "Feriado");
    }

    // Determinar si es feriado o fin de semana
    const isSpecialDay = isWeekend || isHoliday;

    // Buscar reservas para este día
    const dayBookings = bookings.filter(b => b.date === dateStr);
    const dayReserved = dayBookings.some(b => b.slot === "day");
    const nightReserved = dayBookings.some(b => b.slot === "night");

    // Colores correspondientes
    // Libre: Amarillo para Mañana, Gris Claro para Noche
    // Ocupado: Rojo para Feriados/Finde, Naranja para Días hábiles comunes
    const dayColor = dayReserved ? (isSpecialDay ? "#dc2626" : "#ea580c") : "#fef08a";
    const nightColor = nightReserved ? (isSpecialDay ? "#dc2626" : "#ea580c") : "#f3f4f6";

    // Aplicar gradiente horizontal (arriba/abajo)
    dayEl.style.background = `linear-gradient(to bottom, ${dayColor} 50%, ${nightColor} 50%)`;

    dayEl.innerHTML = `<span class="day-number">${day}</span>`;

    // Si es el día seleccionado actualmente en el panel admin
    if (adminSelectedDateStr === dateStr) {
      dayEl.classList.add("selected");
    }

    // Click en el día en modo admin
    dayEl.addEventListener("click", () => {
      document.querySelectorAll("#admin-calendar-days-grid .calendar-day").forEach(el => el.classList.remove("selected"));
      dayEl.classList.add("selected");
      adminSelectedDateStr = dateStr;
      
      // Mostrar el formulario desplegable
      openAdminBookingForm(dateStr);

      // Filtrar y renderizar las reservas de ese día en la lista de abajo
      renderAdminBookings();
    });

    grid.appendChild(dayEl);
  }
}

// Desplegar campos para ingresar datos de la reserva
function openAdminBookingForm(dateStr) {
  const [year, month, day] = dateStr.split("-");
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  // Guardar la fecha en el input oculto
  document.getElementById("admin-date").value = dateStr;
  
  // Actualizar el título de los campos de datos
  document.getElementById("admin-booking-fields-title").innerText = `Registrar reserva para el día ${day} de ${months[parseInt(month) - 1]} de ${year}`;
  
  // Mostrar el contenedor collapsible (remover clase hidden)
  const collapsible = document.getElementById("admin-booking-fields-collapsible");
  collapsible.classList.remove("hidden");
  
  // Hacer scroll suave hacia el formulario para pantallas móviles
  collapsible.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Importar reservas desde un archivo JSON local y subirlas a Supabase si aplica
function handleImportJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const importedBookings = JSON.parse(e.target.result);
      if (!Array.isArray(importedBookings)) {
        alert("El archivo JSON debe contener un arreglo de reservas.");
        return;
      }

      if (confirm(`¿Deseas importar ${importedBookings.length} reservas y sincronizarlas? esto reemplazará tus reservas actuales.`)) {
        bookings = importedBookings;
        localStorage.setItem("local_bookings_backup", JSON.stringify(bookings));

        // Si hay Supabase configurado, subir en lote
        if (supabaseUrl && supabaseKey) {
          try {
            // 1. Borrar todas las reservas en Supabase
            console.log("Limpiando base de datos Supabase para importación...");
            const delRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=gt.0`, {
              method: "DELETE",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`
              }
            });
            
            if (delRes.ok) {
              // 2. Normalizar las reservas para asegurar que tengan exactamente las mismas propiedades (evita error PGRST102)
              const normalizedBookings = bookings.map(b => ({
                date: b.date || "",
                slot: b.slot || "",
                name: b.name || "",
                phone: b.phone || "",
                totalPrice: b.totalPrice !== undefined ? String(b.totalPrice) : "0",
                deposit: b.deposit !== undefined ? String(b.deposit) : "0",
                notes: b.notes || "",
                isEncrypted: b.isEncrypted !== undefined ? b.isEncrypted : false,
                isGCal: b.isGCal !== undefined ? b.isGCal : false
              }));

              console.log("Subiendo lote de reservas a Supabase...");
              const insertRes = await fetch(`${supabaseUrl}/rest/v1/bookings`, {
                method: "POST",
                headers: {
                  "apikey": supabaseKey,
                  "Authorization": `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json",
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify(normalizedBookings)
              });
              if (insertRes.ok) {
                alert("Importación y sincronización con la nube exitosa.");
              } else {
                const insertErr = await insertRes.text();
                alert("Reservas guardadas localmente, pero falló la subida a Supabase: " + insertErr);
              }
            } else {
              const delErr = await delRes.text();
              alert("Reservas guardadas localmente. No se pudo limpiar Supabase: " + delErr);
            }
          } catch (err) {
            console.error("Error al subir importación a Supabase:", err);
            alert("Reservas guardadas localmente. Error de conexión con Supabase.");
          }
        } else {
          alert("Importación local exitosa.");
        }

        // Refrescar UI
        renderCalendar();
        renderAdminCalendar();
        updateFinanceSummary();
        renderAdminBookings();
      }
    } catch (err) {
      alert("Error al leer el archivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

// --- EDICIÓN DE RESERVAS DESDE EL PANEL DE ADMINISTRACIÓN ---

// Activar modo edición cargando los datos de la reserva en el formulario
function editBookingAdmin(date, slot) {
  const booking = bookings.find(b => b.date === date && b.slot === slot);
  if (!booking) return;

  isEditMode = true;
  editOriginalDate = date;
  editOriginalSlot = slot;

  const key = SECRET_KEY; // Usar siempre SECRET_KEY constante para la desencriptación
  const decName = booking.isEncrypted ? decrypt(booking.name, key) : booking.name;
  const decPhone = booking.isEncrypted ? decrypt(booking.phone, key) : booking.phone;
  const decTotalPrice = booking.isEncrypted ? Number(decrypt(booking.totalPrice, key)) : Number(booking.totalPrice);
  const decDeposit = booking.isEncrypted ? Number(decrypt(booking.deposit, key)) : Number(booking.deposit);
  const decNotes = booking.isEncrypted ? decrypt(booking.notes, key) : booking.notes;

  // Prefilar formulario
  document.getElementById("admin-date").value = date;
  document.getElementById("admin-slot").value = slot;
  document.getElementById("admin-name").value = decName.replace('[GCal] ', '');
  document.getElementById("admin-phone").value = decPhone === 'GCal' ? '' : decPhone;
  document.getElementById("admin-total-price").value = decTotalPrice || 0;
  document.getElementById("admin-deposit").value = decDeposit || 0;
  document.getElementById("admin-notes").value = decNotes || "";

  // Configurar checkbox Pago Completo
  const isPaidFull = (decTotalPrice > 0 && decTotalPrice === decDeposit);
  const paidFullCheckbox = document.getElementById("admin-paid-full");
  if (paidFullCheckbox) {
    paidFullCheckbox.checked = isPaidFull;
  }
  document.getElementById("admin-deposit").disabled = isPaidFull;

  // Cambiar textos y botones del formulario
  const [year, month, day] = date.split("-");
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  document.getElementById("admin-booking-fields-title").innerText = `Modificar reserva del ${day} de ${months[parseInt(month) - 1]} de ${year}`;
  
  // Cambiar submit a Guardar y mostrar el botón Cancelar
  const submitBtn = document.getElementById("admin-submit-btn");
  if (submitBtn) submitBtn.innerText = "Guardar Cambios";
  
  const cancelBtn = document.getElementById("admin-cancel-edit-btn");
  if (cancelBtn) cancelBtn.classList.remove("hidden");

  // Mostrar el formulario desplegable
  const collapsible = document.getElementById("admin-booking-fields-collapsible");
  if (collapsible) {
    collapsible.classList.remove("hidden");
    // Desplazar la pantalla suavemente hacia el formulario
    collapsible.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Cancelar el modo edición y resetear los campos del formulario
function cancelAdminEdit() {
  isEditMode = false;
  editOriginalDate = null;
  editOriginalSlot = null;

  // Resetear textos y botones del formulario
  const submitBtn = document.getElementById("admin-submit-btn");
  if (submitBtn) submitBtn.innerText = "Confirmar Reserva";

  const cancelBtn = document.getElementById("admin-cancel-edit-btn");
  if (cancelBtn) cancelBtn.classList.add("hidden");

  // Limpiar campos
  document.getElementById("admin-name").value = "";
  document.getElementById("admin-phone").value = "";
  document.getElementById("admin-total-price").value = "";
  document.getElementById("admin-deposit").value = "0";
  document.getElementById("admin-deposit").disabled = false;
  document.getElementById("admin-notes").value = "";

  // Resetear checkbox Pago Completo
  const paidFullCheckbox = document.getElementById("admin-paid-full");
  if (paidFullCheckbox) {
    paidFullCheckbox.checked = false;
  }

  // Ocultar formulario colapsable
  const collapsible = document.getElementById("admin-booking-fields-collapsible");
  if (collapsible) {
    collapsible.classList.add("hidden");
  }

  // Quitar la selección del calendario
  document.querySelectorAll("#admin-calendar-days-grid .calendar-day").forEach(el => el.classList.remove("selected"));
  adminSelectedDateStr = null;
  renderAdminBookings();
}

