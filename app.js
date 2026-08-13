/* ==========================================
   LÓGICA PRINCIPAL - EL QUINCHO RESERVAS
   ========================================== */

// Número de WhatsApp del dueño (Configurable en producción)
const OWNER_PHONE = "5492612345678"; // Reemplaza con tu número completo (código país + área + celular)

// Estado Global de la Aplicación
let bookings = [];
let currentDate = new Date();
let selectedDateStr = null;
let currentCarouselIndex = 0;

// Configuración de Supabase (se carga de localStorage si existe)
let supabaseUrl = localStorage.getItem("sb_url") || "";
let supabaseKey = localStorage.getItem("sb_key") || "";

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

  // Controladores del Calendario
  document.getElementById("prev-month-btn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("next-month-btn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

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
  await loadBookings();
  renderCalendar();
  
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
  bookings.push(booking);
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
        body: JSON.stringify(booking)
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
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Nombre del mes y año en el encabezado
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  document.getElementById("calendar-month-year").innerText = `${monthNames[month]} ${year}`;

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
    dayEl.innerHTML = `<span class="day-number">${day}</span>`;
    
    // Buscar reservas para este día
    const dayBookings = bookings.filter(b => b.date === dateStr);
    const dayReserved = dayBookings.some(b => b.slot === "day");
    const nightReserved = dayBookings.some(b => b.slot === "night");

    // Clases del contenedor según reservas (gradiente dividido)
    if (dayReserved && nightReserved) {
      dayEl.classList.add("day-booked-night-booked");
    } else if (dayReserved) {
      dayEl.classList.add("day-booked-night-free");
    } else if (nightReserved) {
      dayEl.classList.add("day-free-night-booked");
    } else {
      dayEl.classList.add("day-free-night-free");
    }

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
  const text = `¡Hola! Vengo de la aplicación móvil de reservas de El Quincho 🏡\n\n` + 
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

  if (password === "admin123") {
    localStorage.setItem("admin_logged", "true");
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
}

// Logout
function handleAdminLogout() {
  localStorage.setItem("admin_logged", "false");
  document.getElementById("admin-panel").classList.add("hidden");
  document.getElementById("admin-login-box").classList.remove("hidden");
}

// Listado de reservas en el panel admin
function renderAdminBookings() {
  const tbody = document.getElementById("admin-bookings-list");
  tbody.innerHTML = "";

  // Ordenar reservas por fecha y luego por turno (mañana antes de noche)
  const sortedBookings = [...bookings].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.slot.localeCompare(b.slot);
  });

  if (sortedBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary">No hay reservas registradas.</td></tr>`;
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

    // Crear link de WhatsApp
    const waLink = b.phone ? `<a href="https://wa.me/${b.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color: #25d366; margin-left: 8px; font-size: 14px;" title="Chatear por WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>` : "";
    const clientName = `${b.name}${waLink}`;

    tr.innerHTML = `
      <td><strong>${formattedDate}</strong></td>
      <td>${slotLabel}</td>
      <td>${clientName}</td>
      <td>${totalPrice}</td>
      <td>${deposit}</td>
      <td><span style="font-weight: 600; color: ${b.totalPrice - b.deposit > 0 ? 'var(--warning)' : 'var(--success)'}">${balance}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteBookingAdmin('${b.date}', '${b.slot}')">
          <i class="fa-regular fa-trash-can"></i>
        </button>
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
    renderCalendar();
    
    // Ocultar o refrescar el panel de detalles si estaba mostrando ese día
    if (selectedDateStr === date) {
      showDayDetails(date);
    }
  }
}

// Agregar reserva manual (Bloqueo de fechas)
async function handleAdminManualBooking(event) {
  event.preventDefault();
  const date = document.getElementById("admin-date").value;
  const slot = document.getElementById("admin-slot").value;
  const name = document.getElementById("admin-name").value;
  const phone = document.getElementById("admin-phone").value.trim();
  const totalPriceVal = parseInt(document.getElementById("admin-total-price").value) || 0;
  const depositVal = parseInt(document.getElementById("admin-deposit").value) || 0;

  // Validar si ya está ocupado
  const exists = bookings.some(b => b.date === date && b.slot === slot);
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
    deposit: depositVal 
  };
  await saveBooking(newBooking);

  // Limpiar campos y refrescar
  document.getElementById("admin-date").value = "";
  document.getElementById("admin-name").value = "";
  document.getElementById("admin-phone").value = "";
  document.getElementById("admin-total-price").value = "";
  document.getElementById("admin-deposit").value = "0";
  
  renderAdminBookings();
  renderCalendar();
  alert("Reserva manual agregada correctamente.");
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
  const url = document.getElementById("sb-url").value.trim();
  const key = document.getElementById("sb-key").value.trim();

  localStorage.setItem("sb_url", url);
  localStorage.setItem("sb_key", key);
  
  supabaseUrl = url;
  supabaseKey = key;

  alert("Configuración de base de datos en la nube guardada. Intentando recargar...");
  initApp();
}
