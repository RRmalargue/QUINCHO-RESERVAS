const https = require('https');
const fs = require('fs');
const path = require('path');

const calendarId = process.argv[2] || 'rrojasroco@gmail.com';
const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;

console.log(`Descargando eventos desde: ${url}`);

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`ERROR: Respuesta HTTP fallida con código ${res.statusCode}`);
    console.error("Asegúrate de que el calendario sea público en Google Calendar.");
    process.exit(1);
  }

  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    parseAndSaveICS(data);
  });
}).on('error', (err) => {
  console.error("ERROR en la conexión:", err.message);
  process.exit(1);
});

function parseAndSaveICS(icsContent) {
  const events = [];
  let currentEvent = null;
  let inEvent = false;

  // Unir líneas divididas
  const lines = icsContent.split(/\r?\n/);
  const unfoldedLines = [];
  for (let line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfoldedLines.length > 0) {
        unfoldedLines[unfoldedLines.length - 1] += line.slice(1);
      }
    } else {
      unfoldedLines.push(line);
    }
  }

  for (let line of unfoldedLines) {
    line = line.trim();
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
      inEvent = true;
    } else if (line === 'END:VEVENT') {
      if (inEvent && currentEvent.date) {
        events.push(currentEvent);
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        // Formatos posibles: 
        // DTSTART:20260815T100000Z
        // DTSTART;VALUE=DATE:20260815
        const parts = line.split(':');
        if (parts.length >= 2) {
          const val = parts[1];
          const dateVal = val.substring(0, 8); // YYYYMMDD
          const timeVal = val.includes('T') ? val.split('T')[1].substring(0, 6) : null;

          const year = dateVal.substring(0, 4);
          const month = dateVal.substring(4, 6);
          const day = dateVal.substring(6, 8);

          currentEvent.date = `${year}-${month}-${day}`;
          if (timeVal) {
            const hour = parseInt(timeVal.substring(0, 2), 10);
            if (hour >= 8 && hour < 19) {
              currentEvent.slots = ['day'];
            } else {
              currentEvent.slots = ['night'];
            }
          } else {
            currentEvent.slots = ['day', 'night']; // Todo el día
          }
        }
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8).replace(/\\,/g, ',').replace(/\\;/g, ';');
      }
    }
  }

  console.log(`Se encontraron ${events.length} eventos en Google Calendar.`);

  // Cargar bookings locales
  const bookingsFile = path.join(__dirname, 'bookings.json');
  let bookings = [];

  if (fs.existsSync(bookingsFile)) {
    try {
      bookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf8'));
    } catch (e) {
      bookings = [];
    }
  }

  // Filtrar reservas previas de Google para no duplicar (usando flag isGCal)
  const originalLen = bookings.length;
  bookings = bookings.filter(b => !b.isGCal);
  console.log(`Reservas locales previas: ${originalLen}. Limpiando importaciones previas de Google.`);

  // Mezclar eventos nuevos
  let addedCount = 0;
  for (let event of events) {
    const date = event.date;
    const summary = event.summary || 'Reserva (GCal)';
    const slots = event.slots || ['day', 'night'];

    for (let slot of slots) {
      if (!date.startsWith('2026')) continue; // Traer únicamente reservas del año 2026
      const exists = bookings.some(b => b.date === date && b.slot === slot);
      if (!exists) {
        // Extraer detalles inteligentes del resumen del evento de Google
        const details = extractBookingDetails(summary);
        
        bookings.push({
          date: date,
          slot: slot,
          name: encrypt(details.name),
          phone: encrypt(details.phone),
          totalPrice: encrypt(details.totalPrice),
          deposit: encrypt(details.deposit),
          notes: encrypt(""),
          isEncrypted: true,
          isGCal: true
        });
        addedCount++;
      }
    }
  }

  fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2), 'utf8');
  console.log(`Sincronización exitosa: Se agregaron ${addedCount} turnos con datos extraídos a bookings.json.`);
  console.log("¡Todo listo! Por favor, sube bookings.json actualizado a tu GitHub para que tus clientes lo vean en la web.");
}

// Función inteligente para extraer nombre del cliente, teléfono, monto total y seña del texto del evento
function extractBookingDetails(summary) {
  let name = summary;
  let phone = 'GCal';
  let totalPrice = 0;
  let deposit = 0;

  // 1. Extraer Teléfono
  // Busca patrones como +54 9 260 456-5379 o similares
  const phoneRegex = /(\+?54[\s-]?9?[\s-]?\d{2,4}[\s-]?\d{3}[\s-]?\d{4})|(\b\d{10,13}\b)/g;
  const phoneMatch = summary.match(phoneRegex);
  if (phoneMatch) {
    phone = phoneMatch[0].replace(/\D/g, '');
    if (phone.length === 10 && !phone.startsWith('54')) {
      phone = '54' + phone;
    }
  }

  // Quitar el teléfono del texto para no interferir con otros números
  let cleanSummary = summary;
  if (phoneMatch) {
    cleanSummary = cleanSummary.replace(phoneMatch[0], '');
  }

  // 2. Extraer Nombre (lo que está antes de la primera coma)
  const parts = cleanSummary.split(',');
  if (parts.length > 0) {
    let potentialName = parts[0].trim();
    // Si el nombre es muy largo o tiene palabras clave financieras, lo recortamos
    if (potentialName.length < 50 && !/\b(pago|entreg|seña|\d{3})/i.test(potentialName)) {
      name = potentialName;
    } else {
      const words = potentialName.split(/\s+/);
      name = words.slice(0, 3).join(' ');
    }
  }

  // 3. Extraer Precios y Señas
  // Heurística de números de Argentina
  const isPaidAll = /\b(pago todo|pagó todo|todo pagado|cancelado)\b/i.test(cleanSummary);

  // Buscar expresiones de seña/entrega
  const señaExprRegex = /(?:entrega|entregó|entregado|seña|seño|seńo|seña de|entrega de)\s*(\d{1,3}(?:\.\d{3})*)\b/i;
  const señaMatch = cleanSummary.match(señaExprRegex);
  
  // Buscar todos los números
  const allNumbers = [];
  const rawNumRegex = /\b\d{1,3}(?:\.\d{3})*\b/g;
  let m;
  while ((m = rawNumRegex.exec(cleanSummary)) !== null) {
    let numStr = m[0].replace(/\./g, '');
    let val = parseInt(numStr, 10);
    if (val > 0) {
      // Heurística de miles para la escala de precios actual en Argentina
      if (val >= 20 && val < 1000) {
        val = val * 1000;
      }
      allNumbers.push(val);
    }
  }

  if (allNumbers.length > 0) {
    if (señaMatch) {
      let señaVal = parseInt(señaMatch[1].replace(/\./g, ''), 10);
      if (señaVal >= 10 && señaVal < 1000) señaVal *= 1000;
      deposit = señaVal;
      
      const nonSeñaNums = allNumbers.filter(n => n !== deposit);
      if (nonSeñaNums.length > 0) {
        totalPrice = Math.max(...nonSeñaNums);
      } else {
        totalPrice = deposit;
      }
    } else {
      if (allNumbers.length === 1) {
        totalPrice = allNumbers[0];
        if (isPaidAll) {
          deposit = totalPrice;
        }
      } else if (allNumbers.length >= 2) {
        totalPrice = Math.max(...allNumbers);
        deposit = Math.min(...allNumbers);
        if (isPaidAll) {
          deposit = totalPrice;
        }
      }
    }
  }

  if (isPaidAll && totalPrice > 0) {
    deposit = totalPrice;
  }

  // Quitar prefijo de GCal del nombre si la extracción fue exitosa
  if (name.startsWith('[GCal]')) {
    name = name.replace('[GCal]', '').trim();
  }

  return { name, phone, totalPrice, deposit };
}

// Cifrado simple XOR + Hexadecimal para proteger datos
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
    return "";
  }
}
