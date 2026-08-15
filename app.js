document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let currentStep = 1;
    let config = null;
    let uploadedFileBase64 = null;
    let uploadedFileName = null;
    let uploadedFileType = null;

    // IMPORTANT: Reemplazar esta URL con el Web App URL provisto por Google Apps Script al publicar el script.
    // Si la URL contiene 'TU_SCRIPT_URL_AQUI', el sistema funcionará en MODO DEMOSTRACIÓN (simulación).
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_ey1wwIBjzMzbOmqURIgFgkfVCtX3PvRgVpxZbPv7xtNlLlKF4OoCXKTU8hvkMsLX/exec';

    // HTML Elements
    const form = document.getElementById('registration-form');
    const bgOverlay = document.getElementById('bg-overlay');
    const raceTitle = document.getElementById('race-title');
    const footerRaceName = document.getElementById('footer-race-name');
    const tshirtImage = document.getElementById('tshirt-image');
    const altimetryImage = document.getElementById('altimetry-image');
    const paymentDetailsText = document.getElementById('payment-details-text');
    const deslindeDownload = document.getElementById('deslinde-download');
    const gpxBtn = document.getElementById('gpx-btn');
    const kmlBtn = document.getElementById('kml-btn');
    const startLocationBtn = document.getElementById('start-location-btn');
    const distancesContainer = document.getElementById('distances-container');

    // Leaflet.js variables for interactive GPX maps
    let trackMap = null;
    let trackPolyline = null;

    // Steps & Indicators
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const indicator1 = document.getElementById('indicator-1');
    const indicator2 = document.getElementById('indicator-2');

    // Navigation Buttons
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSubmit = document.getElementById('btn-submit');
    const errorBar = document.getElementById('error-bar');
    const errorText = document.getElementById('error-text');

    // Step 1 Inputs
    const inputNombre = document.getElementById('nombre');
    const inputApellido = document.getElementById('apellido');
    const inputCuil = document.getElementById('cuil');
    const inputFechaNacimiento = document.getElementById('fecha_nacimiento');
    const birthDayInput = document.getElementById('birth_day');
    const birthMonthInput = document.getElementById('birth_month');
    const birthYearInput = document.getElementById('birth_year');
    const inputGenero = document.getElementById('genero');
    const inputEdad = document.getElementById('edad');
    const inputCategoria = document.getElementById('categoria');
    const inputTelefono = document.getElementById('telefono');
    const inputTalleRemera = document.getElementById('talle_remera');

    // Step 3 Inputs / Info
    const fileDropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('comprobante');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const previewFilename = document.getElementById('preview-filename');
    const previewFilesize = document.getElementById('preview-filesize');
    const previewIcon = document.getElementById('preview-icon');
    const btnRemoveFile = document.getElementById('btn-remove-file');

    // Summary Elements
    const summaryCorredor = document.getElementById('summary-corredor');
    const summaryDistancia = document.getElementById('summary-distancia');
    const summaryCategoria = document.getElementById('summary-categoria');
    const summaryMonto = document.getElementById('summary-monto');

    // Screens
    const successScreen = document.getElementById('success-screen');
    const loadingScreen = document.getElementById('loading-screen');

    // Configuración de respaldo (Fallback) en caso de que el navegador bloquee la carga local (restricciones CORS al abrir con doble clic en archivo local)
    const FALLBACK_CONFIG = {
      "raceName": "CROSS TRAIL \"TERCER TIEMPO\"",
      "posterImage": "./IMAGENES/AFICHE TERCER.jpg",
      "tshirtImage": "./IMAGENES/REMERA TERCER.jpg",
      "altitudeMapImage": "./IMAGENES/MAPA ALTURA.jpg",
      "gpxLink": "#",
      "kmlLink": "#",
      "startLocationMapLink": "https://maps.google.com/?q=-34.603722,-58.381592",
      "deslindeLink": "./assets/deslinde.pdf",
      "paymentDetails": "Banco de la Nación Argentina\nCBU: 0110599520000001234567\nAlias: ALPACHIRI.TRAIL\nTitular: Trail Running S.A.",
      "distances": [
        {
          "id": "5 KMS",
          "name": "COMPETITIVA",
          "price": 35000,
          "detail": ""
        },
        {
          "id": "15 KMS",
          "name": "COMPETITIVA",
          "price": 50000,
          "detail": ""
        }
      ],
      "categories": [
        { "id": "infantiles_4_y_5_años", "name": "INFANTILES 4 Y 5 AÑOS 100 MTS", "minAge": 4, "maxAge": 5 },
        { "id": "infantiles_6_y_7_años", "name": "INFANTILES 6 Y 7 AÑOS 200 MTS", "minAge": 6, "maxAge": 7 },
        { "id": "infantiles_8_y_9_años", "name": "INFANTILES 8 Y 9 AÑOS 400 MTS", "minAge": 8, "maxAge": 9 },
        { "id": "infantiles_10_y_11_años", "name": "INFANTILES 10 Y 11 AÑOS 800 MTS", "minAge": 10, "maxAge": 11 },
        { "id": "infantiles_12_y_13_años", "name": "INFANTILES 12 Y 13 AÑOS 1200 MTS", "minAge": 12, "maxAge": 13 },
        { "id": "damas_5_kms", "name": "DAMAS 5 KMS LIBRE", "minAge": 13, "maxAge": 80 },
        { "id": "caballeros_5_kms_libre", "name": "CABALLEROS 5 KMS LIBRE", "minAge": 13, "maxAge": 80 },
        { "id": "damas_15_kms_16_a_19_años", "name": "DAMAS 15 KMS 16  A 19 AÑOS", "minAge": 16, "maxAge": 19 },
        { "id": "damas_15_kms_20_a_29_años", "name": "DAMAS 15 KMS 20 A 29 AÑOS", "minAge": 20, "maxAge": 29 },
        { "id": "damas_15_kms_30_a_39_años", "name": "DAMAS 15 KMS 30 A 39 AÑOS", "minAge": 30, "maxAge": 39 },
        { "id": "damas_15_kms_40_a_49_años", "name": "DAMAS 15 KMS 40 A 49 AÑOS", "minAge": 40, "maxAge": 49 },
        { "id": "damas_15_kms_50_a_59_años", "name": "DAMAS 15 KMS 50 A 59 AÑOS", "minAge": 50, "maxAge": 59 },
        { "id": "damas_15_kms_60_a_69_años", "name": "DAMAS 15 KMS 60 A 69 AÑOS", "minAge": 60, "maxAge": 69 },
        { "id": "15_kms_caballeros_16_a_19_años", "name": "15 KMS CABALLEROS 16 A 19 AÑOS", "minAge": 16, "maxAge": 19 },
        { "id": "15_kms_caballeros_20_a_29_años", "name": "15 KMS CABALLEROS 20 A 29 AÑOS", "minAge": 20, "maxAge": 29 },
        { "id": "15_kms_caballeros_30_a_39_años", "name": "15 KMS CABALLEROS 30 A 39 AÑOS", "minAge": 30, "maxAge": 39 },
        { "id": "15_kms_caballeros_40_a_49_años", "name": "15 KMS CABALLEROS 40 A 49 AÑOS", "minAge": 40, "maxAge": 49 },
        { "id": "15_kms_caballeros_50_a_59_años", "name": "15 KMS CABALLEROS 50 A 59 AÑOS", "minAge": 50, "maxAge": 59 },
        { "id": "15_kms_caballeros_60_a_69_años", "name": "15 KMS CABALLEROS 60 A 69 AÑOS", "minAge": 60, "maxAge": 69 }
      ]
    };

    // 1. CARGA DE CONFIGURACIÓN DINÁMICA
    async function loadConfig() {
        if (typeof window.RACE_CONFIG !== 'undefined' && window.RACE_CONFIG) {
            console.log('Cargada configuración dinámica local desde config.js');
            config = window.RACE_CONFIG;
            renderRaceDetails();
        } else {
            // Intentar fetch config.json por compatibilidad hacia atrás
            try {
                const response = await fetch('./config.json');
                config = await response.json();
                console.log('Cargada configuración dinámica desde config.json');
                renderRaceDetails();
            } catch (error) {
                console.warn('Advertencia: No se detectó config.js ni se pudo cargar config.json. Usando configuración de respaldo integrada.');
                config = FALLBACK_CONFIG;
                renderRaceDetails();
            }
        }
    }

    function renderRaceDetails() {
        if (!config) return;

        // Configuración de la interfaz
        raceTitle.textContent = config.raceName || 'CARRERA DE TRAIL';
        footerRaceName.textContent = config.raceName || 'Trail Running Portal';
        
        // Carga de descripción de la carrera
        const raceDescriptionText = document.getElementById('race-description-text');
        if (raceDescriptionText) {
            raceDescriptionText.textContent = config.raceDescription || '¡Prepárate para una gran carrera! Los detalles del desafío e inscripciones ya están abiertos.';
        }
        
        // Carga de fondo de la web (Background Overlay)
        const BACKGROUND_THEMES = {
            default: './assets/trail_background.jpg',
            snow: './assets/snow_mountain.jpg',
            sunset: './assets/sunset_ridge.jpg',
            rocky: './assets/rocky_valley.jpg',
            solid: 'none'
        };
        const bgPath = BACKGROUND_THEMES[config.themeBackground] || BACKGROUND_THEMES.default;
        if (bgPath === 'none') {
            bgOverlay.style.backgroundImage = 'none';
        } else {
            bgOverlay.style.backgroundImage = `url('${bgPath}')`;
        }
        
        // Cargar afiche principal visible (Flyer)
        const posterBanner = document.getElementById('poster-banner');
        const posterBannerContainer = document.getElementById('poster-banner-container');
        if (config.posterImage) {
            if (posterBanner && posterBannerContainer) {
                posterBanner.src = config.posterImage;
                posterBannerContainer.classList.remove('hidden');
            }
        } else {
            if (posterBannerContainer) {
                posterBannerContainer.classList.add('hidden');
            }
        }
        
        // Cargar logo oficial en el encabezado
        const logoImageElement = document.getElementById('logo-image');
        const logoHeaderContainer = document.getElementById('logo-header-container');
        if (config.logoImage) {
            if (logoImageElement && logoHeaderContainer) {
                logoImageElement.src = config.logoImage;
                logoHeaderContainer.classList.remove('hidden');
            }
        } else {
            if (logoHeaderContainer) {
                logoHeaderContainer.classList.add('hidden');
            }
        }
        
        // Configurar botón flotante de WhatsApp
        const whatsappBtn = document.getElementById('whatsapp-btn');
        if (whatsappBtn) {
            if (config.contactWhatsapp && config.contactWhatsapp.trim() !== '') {
                const cleanPhone = config.contactWhatsapp.replace(/\D/g, '');
                whatsappBtn.href = `https://wa.me/${cleanPhone}?text=Hola!%20Tengo%20una%20consulta%20sobre%20la%20carrera%20${encodeURIComponent(config.raceName || 'Trail')}`;
                whatsappBtn.classList.remove('hidden');
            } else {
                whatsappBtn.classList.add('hidden');
            }
        }
        
        if (config.tshirtImage) {
            tshirtImage.src = config.tshirtImage;
            document.getElementById('tshirt-preview-card').classList.remove('hidden');
        } else {
            document.getElementById('tshirt-preview-card').classList.add('hidden');
        }

        if (config.altitudeMapImage) {
            altimetryImage.src = config.altitudeMapImage;
            document.getElementById('altimetry-card').classList.remove('hidden');
        } else {
            document.getElementById('altimetry-card').classList.add('hidden');
        }

        // Datos de pago
        // Datos de pago con resaltado de Alias y CBU e interactividad para copiar
        let payText = config.paymentDetails || 'No se han configurado los detalles de pago.';
        payText = payText.replace(/Alias:\s*([^\n\r]+)/gi, '<strong>Alias:</strong> <span class="highlight-pay clickable-copy" data-copy="$1" title="Toca para copiar">$1 <i class="fa-solid fa-copy" style="font-size: 0.8rem; margin-left: 0.25rem; opacity: 0.7;"></i></span>');
        payText = payText.replace(/CBU:\s*([^\n\r]+)/gi, '<strong>CBU:</strong> <span class="highlight-pay clickable-copy" data-copy="$1" title="Toca para copiar">$1 <i class="fa-solid fa-copy" style="font-size: 0.8rem; margin-left: 0.25rem; opacity: 0.7;"></i></span>');
        paymentDetailsText.innerHTML = payText;

        // Escuchar clics para copiar al portapapeles con retroalimentación visual
        paymentDetailsText.addEventListener('click', (e) => {
            const clickable = e.target.closest('.clickable-copy');
            if (clickable) {
                const textToCopy = clickable.getAttribute('data-copy').trim();
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalHTML = clickable.innerHTML;
                    clickable.innerHTML = `¡Copiado! <i class="fa-solid fa-check" style="color: var(--success);"></i>`;
                    clickable.style.borderColor = '#00e676';
                    clickable.style.color = '#00e676';
                    
                    setTimeout(() => {
                        clickable.innerHTML = originalHTML;
                        clickable.style.borderColor = '';
                        clickable.style.color = '';
                    }, 1500);
                }).catch(err => {
                    console.error('Error al copiar al portapapeles:', err);
                });
            }
        });

        // Links de descargas y mapas
        deslindeDownload.href = config.deslindeLink || '#';
        
        if (config.gpxLink && config.gpxLink !== '#') {
            gpxBtn.href = config.gpxLink;
            gpxBtn.classList.remove('hidden');
        } else {
            gpxBtn.classList.add('hidden');
        }

        if (config.kmlLink && config.kmlLink !== '#') {
            kmlBtn.href = config.kmlLink;
            kmlBtn.classList.remove('hidden');
        } else {
            kmlBtn.classList.add('hidden');
        }

        if (config.startLocationMapLink && config.startLocationMapLink !== '#') {
            startLocationBtn.href = config.startLocationMapLink;
            startLocationBtn.classList.remove('hidden');
        } else {
            startLocationBtn.classList.add('hidden');
        }

        // Renderizado de tarjetas de distancia
        distancesContainer.innerHTML = '';
        if (config.distances && config.distances.length > 0) {
            config.distances.forEach(dist => {
                const card = document.createElement('div');
                card.className = 'selector-card';
                card.dataset.id = dist.id;
                card.dataset.price = dist.price;
                card.dataset.name = dist.name;

                card.innerHTML = `
                    <div class="card-title">${dist.id}</div>
                    <div class="card-subtitle">${dist.name}</div>
                    <div class="card-detail">${dist.detail || ''}</div>
                    <div class="card-price">$${dist.price.toLocaleString('es-AR')}</div>
                `;

                card.addEventListener('click', () => selectDistance(card));
                distancesContainer.appendChild(card);
            });

            // Seleccionar automáticamente la primera distancia para inicializar
            const firstCard = distancesContainer.querySelector('.selector-card');
            if (firstCard) {
                selectDistance(firstCard);
            }
        }

        // Cargar Auspiciantes (Sponsors)
        const sponsorsContainer = document.getElementById('sponsors-container');
        if (sponsorsContainer) {
            sponsorsContainer.innerHTML = '';
            const sponsorsList = (config.sponsors && config.sponsors.length > 0) 
                ? config.sponsors 
                : [
                    'Auspiciante 1',
                    'Auspiciante 2',
                    'Auspiciante 3',
                    'Auspiciante 4'
                ];

            // Detectar si hay un único sponsor y es una imagen
            const isSingleImage = sponsorsList.length === 1 && 
                (sponsorsList[0].startsWith('data:') || 
                 sponsorsList[0].startsWith('./') || 
                 sponsorsList[0].startsWith('http') || 
                 sponsorsList[0].startsWith('assets/') ||
                 sponsorsList[0].toLowerCase().endsWith('.png') ||
                 sponsorsList[0].toLowerCase().endsWith('.jpg') ||
                 sponsorsList[0].toLowerCase().endsWith('.jpeg'));

            if (isSingleImage) {
                // Formato de afiche único (A4 o vertical)
                sponsorsContainer.style.display = 'block';
                sponsorsContainer.style.textAlign = 'center';
                sponsorsContainer.innerHTML = `
                    <div style="margin: 0 auto; max-width: 480px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); box-shadow: 0 8px 24px rgba(0,0,0,0.35); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(255, 255, 255, 0.02);" class="single-sponsor-poster-container">
                        <img src="${sponsorsList[0]}" alt="Auspiciantes Oficiales" style="width: 100%; height: auto; max-height: 650px; object-fit: contain; display: block; filter: grayscale(12%); transition: all 0.3s ease;" class="single-sponsor-img">
                    </div>
                `;
                
                // Añadir interactividad de hover premium
                const singleCont = sponsorsContainer.querySelector('.single-sponsor-poster-container');
                const singleImg = sponsorsContainer.querySelector('.single-sponsor-img');
                if (singleCont && singleImg) {
                    singleCont.addEventListener('mouseenter', () => {
                        singleCont.style.transform = 'translateY(-4px) scale(1.015)';
                        singleCont.style.borderColor = 'var(--accent-cyan)';
                        singleCont.style.boxShadow = '0 12px 30px rgba(0, 242, 254, 0.25)';
                        singleImg.style.filter = 'grayscale(0%)';
                    });
                    singleCont.style.cursor = 'pointer';
                    singleCont.addEventListener('mouseleave', () => {
                        singleCont.style.transform = 'none';
                        singleCont.style.borderColor = '';
                        singleCont.style.boxShadow = '';
                        singleImg.style.filter = 'grayscale(12%)';
                    });
                }
            } else {
                // Formato de grilla normal (múltiples logos)
                sponsorsContainer.style.display = 'flex';
                sponsorsContainer.style.justifyContent = 'center';
                sponsorsContainer.style.alignItems = 'center';
                sponsorsContainer.style.gap = '1rem';
                sponsorsContainer.style.flexWrap = 'wrap';

                sponsorsList.forEach(sponsor => {
                    const card = document.createElement('div');
                    card.className = 'sponsor-logo-card';
                    
                    if (sponsor.startsWith('data:') || sponsor.startsWith('./') || sponsor.startsWith('http') || sponsor.startsWith('assets/')) {
                        card.innerHTML = `<img src="${sponsor}" alt="Sponsor" class="sponsor-img">`;
                    } else {
                        card.innerHTML = `<span class="sponsor-placeholder-text"><i class="fa-solid fa-medal" style="color: var(--accent-cyan); margin-right: 0.3rem;"></i> ${sponsor}</span>`;
                    }
                    
                    sponsorsContainer.appendChild(card);
                });
            }
        }

        // Cargar mapa interactivo GPX
        loadGpxMap();
    }

    // 2. SELECCIÓN DE DISTANCIA
    function selectDistance(cardElement) {
        document.querySelectorAll('.selector-card').forEach(card => {
            card.classList.remove('selected');
        });
        cardElement.classList.add('selected');

        const selectedId = cardElement.dataset.id;
        const selectedPrice = parseFloat(cardElement.dataset.price);
        const selectedName = cardElement.dataset.name;

        // 1. Guardar en los campos ocultos del formulario
        document.getElementById('selected-distance-id').value = selectedId;
        document.getElementById('selected-distance-price').value = selectedPrice;
        
        // 2. Actualizar el resumen del formulario
        document.getElementById('selected-distance-summary-title').textContent = `${selectedId} - ${selectedName}`;
        document.getElementById('selected-distance-summary-price').textContent = `$${selectedPrice.toLocaleString('es-AR')}`;

        // 3. Actualizar el panel de detalles del dashboard
        const currentDist = config.distances.find(d => d.id === selectedId);
        if (currentDist) {
            document.getElementById('dashboard-dist-title').textContent = `${currentDist.id} - ${currentDist.name}`;
            document.getElementById('dashboard-dist-price').textContent = `$${currentDist.price.toLocaleString('es-AR')}`;
            document.getElementById('dashboard-dist-detail').textContent = currentDist.detail || 'Circuito competitivo de trail running con senderos naturales y paisajes desafiantes.';

            // Descargas específicas de la distancia
            const gpxBtn = document.getElementById('gpx-btn');
            const kmlBtn = document.getElementById('kml-btn');
            const startLocationBtn = document.getElementById('start-location-btn');

            if (currentDist.gpxLink && currentDist.gpxLink !== '#') {
                gpxBtn.href = currentDist.gpxLink;
                gpxBtn.classList.remove('hidden');
            } else if (config.gpxLink && config.gpxLink !== '#') {
                gpxBtn.href = config.gpxLink;
                gpxBtn.classList.remove('hidden');
            } else {
                gpxBtn.classList.add('hidden');
            }

            // KML y Largada (usar específicos o globales como fallback)
            if (config.kmlLink && config.kmlLink !== '#') {
                kmlBtn.href = config.kmlLink;
                kmlBtn.classList.remove('hidden');
            } else {
                kmlBtn.classList.add('hidden');
            }

            if (config.startLocationMapLink && config.startLocationMapLink !== '#') {
                startLocationBtn.href = config.startLocationMapLink;
                startLocationBtn.classList.remove('hidden');
            } else {
                startLocationBtn.classList.add('hidden');
            }
        }
        
        // 4. Cargar altimetría dinámica específica para esta distancia
        const specAlti = currentDist ? currentDist.altitudeMapImage : null;
        if (specAlti) {
            altimetryImage.src = specAlti;
            document.getElementById('altimetry-card').classList.remove('hidden');
        } else if (config.altitudeMapImage) {
            altimetryImage.src = config.altitudeMapImage;
            document.getElementById('altimetry-card').classList.remove('hidden');
        } else {
            document.getElementById('altimetry-card').classList.add('hidden');
        }

        // Configurar obligatoriedad del CUIL si es la distancia INFANTILES
        const cuilInput = document.getElementById('cuil');
        const cuilReqIndicator = document.getElementById('cuil-req-indicator');
        if (selectedId === 'INFANTILES') {
            if (cuilInput) cuilInput.removeAttribute('required');
            if (cuilReqIndicator) cuilReqIndicator.innerHTML = '(Opcional - 11 dígitos)';
        } else {
            if (cuilInput) cuilInput.setAttribute('required', 'required');
            if (cuilReqIndicator) cuilReqIndicator.innerHTML = '* (11 dígitos exactos)';
        }

        // Recalcular categoría
        recalculateCategory();
        
        hideError();

        // Cargar mapa GPX
        loadGpxMap();
    }

    // 3. VALIDACIÓN DE CUIL (11 dígitos, solo números)
    inputCuil.addEventListener('input', (e) => {
        // Remover cualquier caracter no numérico
        let cleanValue = e.target.value.replace(/\D/g, '');
        e.target.value = cleanValue; // Limitar entrada a números únicamente
    });

    // 4. CÁLCULO DE EDAD Y CATEGORÍA
    function recalculateCategory() {
        const birthDateVal = inputFechaNacimiento.value.trim();
        const genderVal = inputGenero.value;
        const distanceVal = document.getElementById('selected-distance-id').value;

        if (!birthDateVal || birthDateVal.indexOf('/') === -1 || birthDateVal.split('/').length !== 3 || !genderVal || !distanceVal) {
            inputEdad.value = '';
            inputCategoria.value = '';
            return;
        }

        const age = calculateAge(birthDateVal);
        if (age <= 0 || isNaN(age)) {
            inputEdad.value = '';
            inputCategoria.value = '';
            return;
        }
        inputEdad.value = `${age} años`;

        const categoryName = determineCategory(age, genderVal, distanceVal);
        inputCategoria.value = categoryName;
    }

    // Sincronizar los 3 campos de fecha individuales con el campo oculto y manejar foco automático
    if (birthDayInput && birthMonthInput && birthYearInput && inputFechaNacimiento) {
        const updateHiddenDate = () => {
            const day = birthDayInput.value.trim();
            const month = birthMonthInput.value.trim();
            const year = birthYearInput.value.trim();

            if (day.length === 2 && month.length === 2 && year.length === 4) {
                inputFechaNacimiento.value = `${day}/${month}/${year}`;
            } else {
                inputFechaNacimiento.value = '';
            }

            // Disparar recálculo de edad y categoría
            recalculateCategory();
            updateFieldHighlight(inputFechaNacimiento);
        };

        // Escuchar cambios de forma unificada para evitar conflictos de modificación de .value en el hilo de ejecución
        birthDayInput.addEventListener('input', () => {
            const clean = birthDayInput.value.replace(/\D/g, '');
            if (birthDayInput.value !== clean) {
                birthDayInput.value = clean;
            }
            if (clean.length === 2) {
                birthMonthInput.focus();
            }
            updateHiddenDate();
        });

        birthMonthInput.addEventListener('input', () => {
            const clean = birthMonthInput.value.replace(/\D/g, '');
            if (birthMonthInput.value !== clean) {
                birthMonthInput.value = clean;
            }
            if (clean.length === 2) {
                birthYearInput.focus();
            }
            updateHiddenDate();
        });

        birthYearInput.addEventListener('input', () => {
            const clean = birthYearInput.value.replace(/\D/g, '');
            if (birthYearInput.value !== clean) {
                birthYearInput.value = clean;
            }
            updateHiddenDate();
        });

        // Salto hacia atrás (Backspace)
        birthMonthInput.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && birthMonthInput.value.length === 0) {
                birthDayInput.focus();
            }
        });

        birthYearInput.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && birthYearInput.value.length === 0) {
                birthMonthInput.focus();
            }
        });
    }

    inputGenero.addEventListener('change', recalculateCategory);

    function calculateAge(birthDateString) {
        if (!birthDateString) return 0;
        let formatted = birthDateString;
        
        // Convertir DD/MM/YYYY a YYYY-MM-DD para la API de Date
        if (formatted.indexOf('/') !== -1) {
            const parts = formatted.split('/');
            if (parts.length === 3) {
                formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        
        const today = new Date();
        const birthDate = new Date(formatted);
        if (isNaN(birthDate.getTime())) return 0;
        
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    function determineCategory(age, gender, distance) {
        if (!config || !config.categories || config.categories.length === 0) {
            return 'General';
        }
        
        // 1. Filtrar por rango de edad (filtro primario)
        let candidates = config.categories.filter(cat => age >= cat.minAge && age <= cat.maxAge);
        if (candidates.length === 0) {
            return 'Sin categoría asignada (Fuera de rango)';
        }
        
        const genderClean = (gender || '').toLowerCase();
        const distClean = (distance || '').toLowerCase().replace(/\s+/g, ''); // "5kms" o "15kms"
        
        // 2. Filtrar por género (si la categoría discrimina por género)
        if (genderClean.includes('fem') || genderClean.includes('dam')) {
            // Eliminar categorías masculinas
            candidates = candidates.filter(cat => {
                const name = cat.name.toLowerCase();
                const id = cat.id.toLowerCase();
                return !(name.includes('caballeros') || name.includes('masculino') || id.includes('caballeros') || id.includes('masculino') || id.startsWith('m_'));
            });
        } else if (genderClean.includes('masc') || genderClean.includes('cab')) {
            // Eliminar categorías femeninas
            candidates = candidates.filter(cat => {
                const name = cat.name.toLowerCase();
                const id = cat.id.toLowerCase();
                return !(name.includes('damas') || name.includes('femenino') || id.includes('damas') || id.includes('femenino') || id.startsWith('f_'));
            });
        }
        
        // Expresiones regulares con límites de palabras (\b) para evitar colisiones de subcadena (evita que "15 kms" contenga "5 km")
        const matches5k = /\b5\s*k/i;
        const matches15k = /\b15\s*k/i;

        // 3. Filtrar por distancia (si la distancia ya fue seleccionada)
        if (distClean) {
            if (distClean.includes('15')) {
                // Eliminar categorías de 5K e Infantiles si no aplica
                candidates = candidates.filter(cat => {
                    const name = cat.name.toLowerCase();
                    const id = cat.id.toLowerCase();
                    return !(matches5k.test(name) || matches5k.test(id) || id.includes('_5k') || id.includes('_5_km') || name.includes('infantil') || id.includes('infantil'));
                });
            } else if (distClean.includes('5') && !distClean.includes('15')) {
                // Para 5K, si existen categorías específicas que mencionan 5K, usar ÚNICAMENTE esas
                const hasSpecific5k = candidates.some(cat => {
                    const name = cat.name.toLowerCase();
                    const id = cat.id.toLowerCase();
                    return (matches5k.test(name) || matches5k.test(id) || id.includes('_5k') || id.includes('_5_km'));
                });
                
                if (hasSpecific5k) {
                    candidates = candidates.filter(cat => {
                        const name = cat.name.toLowerCase();
                        const id = cat.id.toLowerCase();
                        return (matches5k.test(name) || matches5k.test(id) || id.includes('_5k') || id.includes('_5_km'));
                    });
                }
            } else if (distClean.includes('infantil')) {
                // Para infantiles, usar ÚNICAMENTE las categorías que digan infantil
                candidates = candidates.filter(cat => {
                    const name = cat.name.toLowerCase();
                    const id = cat.id.toLowerCase();
                    return (name.includes('infantil') || id.includes('infantil'));
                });
            }
        } else {
            // Si no se seleccionó distancia aún, ver si quedan categorías de distintas distancias
            const has5k = candidates.some(cat => matches5k.test(cat.name.toLowerCase()) || matches5k.test(cat.id.toLowerCase()));
            const has15k = candidates.some(cat => matches15k.test(cat.name.toLowerCase()) || matches15k.test(cat.id.toLowerCase()));
            
            if (has5k && has15k) {
                return 'Se definirá al seleccionar la distancia';
            }
        }
        
        // Retornar el primer candidato que coincida
        if (candidates.length > 0) {
            return candidates[0].name;
        }
        
        return 'Sin categoría asignada';
    }

    // 5. NAVEGACIÓN Y WIZARD FORM
    btnNext.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            goToStep(currentStep + 1);
        }
    });

    btnPrev.addEventListener('click', () => {
        goToStep(currentStep - 1);
    });

    function goToStep(step) {
        hideError();

        // Guardar valores del paso actual y actualizar el resumen cuando se pasa al Paso 2
        if (step === 2) {
            updateSummary();
        }

        // Ocultar todos los pasos
        step1.classList.add('hidden');
        step2.classList.add('hidden');

        // Quitar estado activo de indicadores
        indicator1.classList.remove('active');
        indicator2.classList.remove('active');
        indicator1.classList.remove('completed');
        indicator2.classList.remove('completed');

        // Activar el paso correspondiente
        if (step === 1) {
            step1.classList.remove('hidden');
            indicator1.classList.add('active');
            btnPrev.disabled = true;
            btnNext.classList.remove('hidden');
            btnSubmit.classList.add('hidden');
        } else if (step === 2) {
            step1.classList.add('completed');
            step2.classList.remove('hidden');
            indicator2.classList.add('active');
            indicator1.classList.add('completed');
            btnPrev.disabled = false;
            btnNext.classList.add('hidden');
            btnSubmit.classList.remove('hidden');
        }

        currentStep = step;
        const wrapper = document.getElementById('registration-card-wrapper');
        if (wrapper) {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // 6. VALIDACIONES POR PASO
    function validateStep(step) {
        if (step === 1) {
            // Forzar recálculo por seguridad
            recalculateCategory();

            let firstInvalidEl = null;

            function checkField(element, condition, errorMsg) {
                if (element.id === 'fecha_nacimiento') {
                    const inputs = [birthDayInput, birthMonthInput, birthYearInput];
                    inputs.forEach(input => {
                        if (input) {
                            if (condition) {
                                input.classList.add('invalid-field');
                                input.classList.remove('completed-field');
                            } else {
                                input.classList.remove('invalid-field');
                                input.classList.add('completed-field');
                            }
                        }
                    });
                    if (condition && !firstInvalidEl) firstInvalidEl = birthDayInput;
                    return condition ? errorMsg : null;
                }

                if (condition) {
                    element.classList.add('invalid-field');
                    element.classList.remove('completed-field');
                    if (!firstInvalidEl) firstInvalidEl = element;
                    return errorMsg;
                } else {
                    element.classList.remove('invalid-field');
                    element.classList.add('completed-field');
                    return null;
                }
            }

            let error = null;
            
            error = error || checkField(inputNombre, !inputNombre.value.trim(), 'El nombre es obligatorio.');
            error = error || checkField(inputApellido, !inputApellido.value.trim(), 'El apellido es obligatorio.');
            
            const selectedDistId = document.getElementById('selected-distance-id').value;
            const cuilVal = inputCuil.value.trim();
            let isCuilInvalid = false;
            let cuilErrorMsg = '';

            if (selectedDistId === 'INFANTILES') {
                if (cuilVal.length > 0 && cuilVal.length !== 11) {
                    isCuilInvalid = true;
                    cuilErrorMsg = 'Si ingresas el CUIL, debe tener exactamente 11 números.';
                }
            } else {
                if (!cuilVal || cuilVal.length !== 11) {
                    isCuilInvalid = true;
                    cuilErrorMsg = 'El CUIL es obligatorio y debe tener exactamente 11 números.';
                }
            }
            error = error || checkField(inputCuil, isCuilInvalid, cuilErrorMsg);
            
            error = error || checkField(inputFechaNacimiento, !inputFechaNacimiento.value, 'La fecha de nacimiento es obligatoria.');
            error = error || checkField(inputGenero, !inputGenero.value, 'Debes seleccionar tu género.');
            
            const ageVal = parseInt(inputEdad.value);
            error = error || checkField(inputFechaNacimiento, isNaN(ageVal) || ageVal < 4, isNaN(ageVal) ? 'Fecha de nacimiento inválida.' : 'La edad mínima para participar es de 4 años.');

            error = error || checkField(inputTelefono, !inputTelefono.value.trim(), 'El teléfono es obligatorio.');
            error = error || checkField(inputTalleRemera, !inputTalleRemera.value, 'Debes seleccionar el talle de remera.');

            // Validar la distancia seleccionada
            const distance = document.getElementById('selected-distance-id').value;
            const distancesContainer = document.getElementById('distances-container');
            error = error || checkField(distancesContainer, !distance, 'Debes seleccionar una distancia para correr.');
            
            // Validar que la categoría asignada sea válida
            const catVal = inputCategoria.value;
            error = error || checkField(inputCategoria, !catVal || catVal === 'Sin categoría asignada' || catVal === 'Se definirá al seleccionar la distancia' || catVal.includes('Fuera de rango'), 'No se encontró una categoría válida para tu edad, género y distancia seleccionada.');

            if (error) {
                if (firstInvalidEl) {
                    firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstInvalidEl.focus();
                }
                return showError(error);
            }
            
            return true;
        }

        return true;
    }

    function updateSummary() {
        const cost = parseFloat(document.getElementById('selected-distance-price').value) || 0;
        summaryCorredor.textContent = `${inputNombre.value} ${inputApellido.value}`;
        summaryDistancia.textContent = document.getElementById('selected-distance-id').value;
        summaryCategoria.textContent = inputCategoria.value || 'General';
        summaryMonto.textContent = `$${cost.toLocaleString('es-AR')}`;
    }

    // 7. CARGA DE ARCHIVO Y PREVIEW
    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        fileDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            fileDropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            fileDropzone.classList.remove('dragover');
        }, false);
    });

    fileDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Triggers input click on box click
    fileDropzone.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    async function handleFile(file) {
        hideError();
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

        if (!allowedTypes.includes(file.type)) {
            showError('Formato no permitido. Solo se aceptan imágenes (JPG, PNG) o PDF.');
            resetFileInput();
            return;
        }

        if (file.size > maxSize) {
            showError('El archivo es demasiado grande. El límite es 5MB.');
            resetFileInput();
            return;
        }

        uploadedFileName = file.name;
        uploadedFileType = file.type;

        // Visual change
        previewFilename.textContent = file.name;
        previewFilesize.textContent = formatBytes(file.size);
        
        // Icon type
        if (file.type === 'application/pdf') {
            previewIcon.className = 'fa-solid fa-file-pdf file-preview-icon';
            previewIcon.style.color = '#ff5252';
        } else {
            previewIcon.className = 'fa-solid fa-file-image file-preview-icon';
            previewIcon.style.color = '#00f2fe';
        }

        // Base64 conversion
        try {
            uploadedFileBase64 = await toBase64(file);
            fileDropzone.classList.add('hidden');
            filePreviewContainer.classList.remove('hidden');
            validateSubmitButton();
        } catch (err) {
            console.error('Error convirtiendo archivo:', err);
            showError('Ocurrió un error al procesar el archivo. Reinténtalo.');
            resetFileInput();
        }
    }

    btnRemoveFile.addEventListener('click', (e) => {
        e.stopPropagation();
        resetFileInput();
        hideError();
    });

    function resetFileInput() {
        fileInput.value = '';
        uploadedFileBase64 = null;
        uploadedFileName = null;
        uploadedFileType = null;
        fileDropzone.classList.remove('hidden');
        filePreviewContainer.classList.add('hidden');
        validateSubmitButton();
    }

    // Helper functions
    function toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Return only base64 data string without schema prefix
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
        });
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function validateSubmitButton() {
        if (uploadedFileBase64) {
            btnSubmit.disabled = false;
        } else {
            btnSubmit.disabled = true;
        }
    }

    // 8. ENVÍO DE DATOS
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        if (!uploadedFileBase64) {
            return showError('El comprobante de pago es un archivo obligatorio.');
        }

        // Show loading screen
        document.querySelector('.card-wrapper').style.minHeight = '300px';
        form.classList.add('hidden');
        loadingScreen.classList.remove('hidden');

        // Formatear fecha de nacimiento a DD/MM/YYYY
        let formattedBirthdate = inputFechaNacimiento.value;
        if (formattedBirthdate === '__/__/____') {
            formattedBirthdate = '';
        } else if (formattedBirthdate) {
            const dateParts = formattedBirthdate.split('-');
            if (dateParts.length === 3) {
                formattedBirthdate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            }
        }

        // Formatear género a Damas/Caballeros
        const formattedGender = inputGenero.value === 'Femenino' ? 'Damas' : (inputGenero.value === 'Masculino' ? 'Caballeros' : inputGenero.value);

        // Compile payload
        const formData = {
            nombre: inputNombre.value.trim(),
            apellido: inputApellido.value.trim(),
            cuil: inputCuil.value.trim(),
            fecha_nacimiento: formattedBirthdate,
            edad: inputEdad.value.replace(' años', ''),
            categoria: inputCategoria.value,
            telefono: inputTelefono.value.trim(),
            genero: formattedGender,
            talle_remera: inputTalleRemera.value,
            team_origen: document.getElementById('team_origen').value.trim(),
            distancia: document.getElementById('selected-distance-id').value,
            costo: document.getElementById('selected-distance-price').value,
            comprobante_base64: uploadedFileBase64,
            comprobante_nombre: uploadedFileName,
            comprobante_tipo: uploadedFileType,
            timestamp: new Date().toISOString()
        };

        // Guardar datos en localStorage para recordar en este dispositivo
        try {
            localStorage.setItem('runner_pref_nombre', inputNombre.value.trim());
            localStorage.setItem('runner_pref_apellido', inputApellido.value.trim());
            localStorage.setItem('runner_pref_cuil', inputCuil.value.trim());
            localStorage.setItem('runner_pref_fecha_nacimiento', inputFechaNacimiento.value);
            localStorage.setItem('runner_pref_genero', inputGenero.value);
            localStorage.setItem('runner_pref_telefono', inputTelefono.value.trim());
            localStorage.setItem('runner_pref_talle_remera', inputTalleRemera.value);
            const teamInput = document.getElementById('team_origen');
            if (teamInput) {
                localStorage.setItem('runner_pref_team_origen', teamInput.value.trim());
            }
        } catch (storageErr) {
            console.warn('No se pudo guardar en localStorage:', storageErr);
        }

        // CHECK IF IN MOCK/DEMO MODE
        if (GOOGLE_SCRIPT_URL === 'TU_SCRIPT_URL_AQUI' || GOOGLE_SCRIPT_URL.trim() === '') {
            // Simulamos retraso de envío de red de 2 segundos en modo Demo
            console.log('--- MODO DEMOSTRACIÓN ---');
            console.log('Datos enviados:', formData);
            
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                successScreen.classList.remove('hidden');
            }, 2500);
            return;
        }

        // REAL HTTP POST SEND
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Evita bloqueos de CORS debido a redirecciones de Google
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(formData)
            });

            // En modo 'no-cors' la respuesta es opaca, por lo que asumimos éxito al no lanzar error de red
            loadingScreen.classList.add('hidden');
            successScreen.classList.remove('hidden');

        } catch (error) {
            console.error('Error al enviar registro:', error);
            // Revert screen state
            loadingScreen.classList.add('hidden');
            form.classList.remove('hidden');
            showError(`Error al procesar el envío: ${error.message || 'Problema de conexión'}. Revisa tu conexión o vuelve a intentarlo.`);
        }
    });

    // 9. ERROR HANDLING
    function showError(message) {
        errorText.textContent = message;
        errorBar.classList.remove('hidden');
        
        // Scroll to error
        errorBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    function hideError() {
        errorBar.classList.add('hidden');
    }

    // 10. RESALTADO DINÁMICO DE CAMPOS COMPLETADOS
    const fieldsToTrack = [
        inputNombre,
        inputApellido,
        inputCuil,
        inputFechaNacimiento,
        inputGenero,
        inputTelefono,
        inputTalleRemera
    ];

    function updateFieldHighlight(element) {
        if (!element) return;
        
        let isCompleted = false;
        
        if (element.id === 'fecha_nacimiento') {
            isCompleted = element.value.trim() !== '';
            const inputs = [birthDayInput, birthMonthInput, birthYearInput];
            inputs.forEach(input => {
                if (input) {
                    if (isCompleted) {
                        input.classList.add('completed-field');
                        input.classList.remove('invalid-field');
                    } else {
                        input.classList.remove('completed-field');
                    }
                }
            });
            return;
        }
        
        if (element.tagName === 'SELECT') {
            isCompleted = element.value !== '';
        } else if (element.id === 'cuil') {
            isCompleted = element.value.trim().length === 11;
        } else if (element.type === 'date') {
            isCompleted = element.value !== '';
        } else {
            isCompleted = element.value.trim() !== '';
        }

        if (isCompleted) {
            element.classList.add('completed-field');
            element.classList.remove('invalid-field');
        } else {
            element.classList.remove('completed-field');
        }
    }

    fieldsToTrack.forEach(field => {
        if (!field) return;
        
        field.addEventListener('input', () => {
            updateFieldHighlight(field);
            hideError();
        });
        field.addEventListener('change', () => {
            updateFieldHighlight(field);
            hideError();
        });
        field.addEventListener('blur', () => {
            updateFieldHighlight(field);
        });
        
        // Ejecutar inicialmente por si hay autocompletado
        updateFieldHighlight(field);
    });

    // Autodetectar género a partir del primer nombre en español/argentino
    if (inputNombre && inputGenero) {
        inputNombre.addEventListener('input', () => {
            const val = inputNombre.value.trim();
            if (val.length >= 3) {
                const guessed = guessGender(val);
                if (guessed) {
                    inputGenero.value = guessed;
                    updateFieldHighlight(inputGenero);
                }
            }
        });
    }

    function guessGender(fullName) {
        if (!fullName) return null;
        
        let firstName = fullName.trim().split(/\s+/)[0];
        if (!firstName) return null;
        
        firstName = firstName.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""); // Quitar acentos
            
        const femaleNames = new Set([
            "maria", "ana", "belen", "lujan", "carmen", "pilar", "sol", "luz", "flor", 
            "ruth", "ester", "abril", "ines", "lucia", "sofia", "rocio", "dolores", 
            "mercedes", "soledad", "beatriz", "raquel", "isabel", "noemi", "miriam", 
            "abigail", "elizabeth", "yamila", "camila", "valeria", "micaela", "romina",
            "florencia", "carolina", "antonela", "antonella", "giuliana", "daiana", 
            "milagros", "lourdes", "estela", "cecilia", "silvia", "monica", "patricia",
            "sandra", "marta", "martha", "claudia", "gabriela", "daniela", "andrea",
            "susana", "liliana", "graciela", "teresa", "alicia"
        ]);
        
        const maleNames = new Set([
            "luca", "lucas", "bautista", "sasha", "gianluca", "tomas", "matias", 
            "nicolas", "josue", "rene", "jose", "angel", "ariel"
        ]);

        if (maleNames.has(firstName)) {
            return 'Masculino';
        }
        
        if (femaleNames.has(firstName)) {
            return 'Femenino';
        }
        
        if (firstName.endsWith('a')) {
            return 'Femenino';
        }
        
        if (firstName.endsWith('o') || firstName.endsWith('os')) {
            return 'Masculino';
        }
        
        if (
            firstName.endsWith('el') || 
            firstName.endsWith('or') || 
            firstName.endsWith('an') || 
            firstName.endsWith('on') || 
            firstName.endsWith('en') || 
            firstName.endsWith('as') || 
            firstName.endsWith('is') || 
            firstName.endsWith('us') || 
            firstName.endsWith('ur') || 
            firstName.endsWith('id') || 
            (firstName.endsWith('es') && !['mercedes', 'dolores', 'ines'].includes(firstName))
        ) {
            return 'Masculino';
        }
        
        return null;
    }

    // Escuchar selección de distancia
    document.addEventListener('click', (e) => {
        if (e.target.closest('.selector-card')) {
            const distancesContainer = document.getElementById('distances-container');
            distancesContainer.classList.remove('invalid-field');
            distancesContainer.classList.add('completed-field');
        }
    });

    async function loadGpxMap() {
        const mapContainer = document.getElementById('map-track');
        if (!mapContainer) return;

        // 1. Obtener la distancia seleccionada
        const selectedDistanceId = document.getElementById('selected-distance-id').value;
        let gpxLink = config.gpxLink; // Usar el global por defecto

        // 2. Si hay distancia seleccionada, buscar si tiene un GPX específico
        if (selectedDistanceId && config.distances) {
            const matchedDist = config.distances.find(d => d.id === selectedDistanceId);
            if (matchedDist && matchedDist.gpxLink && matchedDist.gpxLink.trim() !== '' && matchedDist.gpxLink !== '#') {
                gpxLink = matchedDist.gpxLink;
            }
        }

        // 3. Si no hay GPX (ni global ni por distancia), ocultamos el mapa
        if (!gpxLink || gpxLink === '#' || gpxLink.trim() === '') {
            document.getElementById('interactive-map-card').classList.add('hidden');
            return;
        }

        document.getElementById('interactive-map-card').classList.remove('hidden');

        try {
            // Cargar el archivo GPX
            const response = await fetch(gpxLink);
            if (!response.ok) throw new Error('No se pudo cargar el archivo GPX.');
            const gpxText = await response.text();

            // Parsear XML de GPX
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(gpxText, 'text/xml');
            const points = [];
            const trackPoints = xmlDoc.getElementsByTagName('trkpt');

            for (let i = 0; i < trackPoints.length; i++) {
                const lat = parseFloat(trackPoints[i].getAttribute('lat'));
                const lon = parseFloat(trackPoints[i].getAttribute('lon'));
                if (!isNaN(lat) && !isNaN(lon)) {
                    points.push([lat, lon]);
                }
            }

            if (points.length === 0) {
                console.warn('El archivo GPX no contiene puntos de track válidos.');
                document.getElementById('interactive-map-card').classList.add('hidden');
                return;
            }

            // Inicializar el mapa si no existe
            if (!trackMap) {
                const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© Colaboradores de OpenStreetMap'
                });

                const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                });

                trackMap = L.map('map-track', {
                    scrollWheelZoom: false,
                    layers: [streetMap]
                });

                const baseMaps = {
                    "Mapa de Calles": streetMap,
                    "Vista Satélite": satelliteMap
                };

                L.control.layers(baseMaps).addTo(trackMap);

                // Alternar zoom con la rueda al hacer clic en el mapa
                trackMap.on('click', () => {
                    if (trackMap.scrollWheelZoom.enabled()) {
                        trackMap.scrollWheelZoom.disable();
                    } else {
                        trackMap.scrollWheelZoom.enable();
                    }
                });
            }

            // Remover dibujo previo si hay
            if (trackPolyline) {
                trackMap.removeLayer(trackPolyline);
            }

            // Dibujar la línea del track
            trackPolyline = L.polyline(points, {
                color: '#ff6b35', // Naranja
                weight: 5,
                opacity: 0.9
            }).addTo(trackMap);

            // Ajustar la vista de cámara al circuito completo
            trackMap.fitBounds(trackPolyline.getBounds());

            // Colocar marcador en la salida
            L.marker(points[0]).addTo(trackMap)
                .bindPopup(`<b>Largada / Llegada - ${selectedDistanceId || ''}</b>`)
                .openPopup();

        } catch (error) {
            console.error('Error al inicializar el mapa GPX:', error);
            mapContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center; color: var(--text-secondary);">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: var(--accent-orange); margin-bottom: 1rem;"></i>
                    <p style="font-weight: 600;">No se pudo cargar el mapa interactivo directamente.</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
                        Esto ocurre por seguridad del navegador al abrir archivos locales directamente. Para verlo interactivo, ingresa desde: <a href="http://localhost:3000/index.html" style="color: var(--accent-cyan); text-decoration: underline;">http://localhost:3000</a> o descarga la ruta usando el botón de arriba.
                    </p>
                </div>
            `;
        }
    }

    // Evento para mostrar e iniciar la inscripción con scroll suave
    const btnGoToRegistration = document.getElementById('btn-go-to-registration');
    const registrationCardWrapper = document.getElementById('registration-card-wrapper');
    if (btnGoToRegistration && registrationCardWrapper) {
        btnGoToRegistration.addEventListener('click', () => {
            registrationCardWrapper.classList.remove('hidden');
            registrationCardWrapper.scrollIntoView({ behavior: 'smooth' });
            
            // Enfocar el primer campo del formulario (Nombre)
            setTimeout(() => {
                const nombreInput = document.getElementById('nombre');
                if (nombreInput) nombreInput.focus();
            }, 550);
        });
    }

    // Eventos de barra de navegación superior (Inscripciones y Clasificaciones)
    const navBtnInscripciones = document.getElementById('nav-btn-inscripciones');
    const navBtnClasificaciones = document.getElementById('nav-btn-clasificaciones');

    if (navBtnInscripciones) {
        navBtnInscripciones.addEventListener('click', () => {
            console.log('Botón Inscripciones clickeado. Desplazando a #dashboard-card...');
            const targetElement = document.getElementById('dashboard-card');
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            
            // Activar botón visualmente
            navBtnInscripciones.classList.add('active');
            if (navBtnClasificaciones) navBtnClasificaciones.classList.remove('active');
        });
    }

    if (navBtnClasificaciones) {
        navBtnClasificaciones.addEventListener('click', () => {
            if (config && config.clasificacionesLink && config.clasificacionesLink.trim() !== '') {
                window.open(config.clasificacionesLink, '_blank');
            } else {
                alert('Las clasificaciones oficiales de la carrera estarán disponibles aquí una vez finalizado el evento. ¡Éxitos a todos los competidores!');
            }
        });
    }

    // Cargar datos guardados previamente del usuario en este dispositivo (localStorage)
    try {
        if (localStorage.getItem('runner_pref_nombre')) {
            inputNombre.value = localStorage.getItem('runner_pref_nombre') || '';
            inputApellido.value = localStorage.getItem('runner_pref_apellido') || '';
            inputCuil.value = localStorage.getItem('runner_pref_cuil') || '';
            let savedDate = localStorage.getItem('runner_pref_fecha_nacimiento') || '';
            if (savedDate && savedDate.indexOf('-') !== -1) {
                const parts = savedDate.split('-');
                if (parts.length === 3) {
                    savedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            }
            
            // Rellenar campos de fecha individuales y sincronizar
            if (savedDate && savedDate.indexOf('/') !== -1) {
                const dateParts = savedDate.split('/');
                if (dateParts.length === 3) {
                    if (birthDayInput) birthDayInput.value = dateParts[0];
                    if (birthMonthInput) birthMonthInput.value = dateParts[1];
                    if (birthYearInput) birthYearInput.value = dateParts[2];
                    inputFechaNacimiento.value = savedDate;
                }
            } else {
                inputFechaNacimiento.value = '';
                if (birthDayInput) birthDayInput.value = '';
                if (birthMonthInput) birthMonthInput.value = '';
                if (birthYearInput) birthYearInput.value = '';
            }
            
            inputGenero.value = localStorage.getItem('runner_pref_genero') || '';
            inputTelefono.value = localStorage.getItem('runner_pref_telefono') || '';
            inputTalleRemera.value = localStorage.getItem('runner_pref_talle_remera') || '';
            const teamInput = document.getElementById('team_origen');
            if (teamInput) {
                teamInput.value = localStorage.getItem('runner_pref_team_origen') || '';
            }
            
            // Si cargamos fecha de nacimiento, forzar el cálculo de la edad y la categoría
            if (inputFechaNacimiento.value) {
                recalculateCategory();
            }

            // Actualizar el resaltado visual de los campos precargados
            fieldsToTrack.forEach(field => {
                if (field) updateFieldHighlight(field);
            });
            const teamInputAfter = document.getElementById('team_origen');
            if (teamInputAfter) updateFieldHighlight(teamInputAfter);
        }
    } catch (e) {
        console.warn('No se pudo precargar la información de localStorage:', e);
    }

    // INIT
    loadConfig();
});
