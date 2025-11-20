const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Configurar plugin stealth para evasión de detección
puppeteer.use(StealthPlugin());

class GoogleMapsScraper {
  constructor(options = {}) {
    this.headless = options.headless !== undefined ? options.headless : false;
    this.timeout = options.timeout || 60000;
    this.scrollDelay = options.scrollDelay || 2000;
    this.maxScrolls = options.maxScrolls || 500;
    this.reviewsLimit = options.reviewsLimit || null;
    this.waitAfterSort = options.waitAfterSort || 3000;
    this.onProgress = options.onProgress || null; // Callback de progreso
    this.capturedResponses = [];
    this.browser = null;
    this.page = null;
    this.client = null;
  }

  /**
   * Inicializar el navegador y configurar CDP
   */
  async initialize() {
    console.log('🚀 Inicializando navegador con stealth mode...');

    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      }
    });

    this.page = await this.browser.newPage();

    // Configurar User-Agent realista
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Crear sesión CDP
    this.client = await this.page.target().createCDPSession();

    // CRÍTICO: Habilitar Network ANTES de navegar
    await this.client.send('Network.enable');
    await this.client.send('Page.enable');

    console.log('✅ CDP Session configurada correctamente');
  }

  /**
   * Configurar interceptación de peticiones de red
   */
  setupNetworkInterception() {
    console.log('🔧 Configurando interceptación de red...');

    // Método 1: Usando CDP directamente (más confiable para obtener bodies)
    this.client.on('Network.responseReceived', async (event) => {
      const url = event.response.url;
      const requestId = event.requestId;

      // Detectar endpoints relevantes de Google Maps
      if (this.isRelevantEndpoint(url)) {
        // DESTACAR SI ES EL ENDPOINT CRÍTICO listugcposts
        const isListUgcPosts = url.includes('/maps/rpc/listugcposts');
        const emoji = isListUgcPosts ? '🎯🎯🎯' : '📡';
        const urlPreview = url.substring(0, isListUgcPosts ? 150 : 100);

        console.log(`${emoji} Endpoint detectado: ${urlPreview}...`);

        try {
          // Obtener el body de la respuesta
          const { body, base64Encoded } = await this.client.send('Network.getResponseBody', {
            requestId: requestId
          });

          const responseBody = base64Encoded
            ? Buffer.from(body, 'base64').toString('utf8')
            : body;

          // Guardar respuesta capturada
          this.capturedResponses.push({
            url: url,
            timestamp: Date.now(),
            body: responseBody,
            headers: event.response.headers,
            status: event.response.status,
            mimeType: event.response.mimeType,
            isListUgcPosts: isListUgcPosts
          });

          if (isListUgcPosts) {
            console.log(`✅✅✅ LISTUGCPOSTS CAPTURADO (${responseBody.length} bytes)`);
          } else {
            console.log(`✅ Respuesta capturada (${responseBody.length} bytes)`);
          }

        } catch (error) {
          // Algunos recursos no permiten acceder al body
          if (!error.message.includes('No resource with given identifier')) {
            console.log(`⚠️  Error capturando body: ${error.message}`);
          }
        }
      }
    });

    // Método 2: Usando page.on('response') como fallback
    this.page.on('response', async (response) => {
      const url = response.url();
      const resourceType = response.request().resourceType();

      // LOGGING: Mostrar TODAS las solicitudes XHR/Fetch para debugging
      if (['xhr', 'fetch'].includes(resourceType)) {
        const urlShort = url.length > 150 ? url.substring(0, 150) + '...' : url;
        console.log(`🌐 [${resourceType.toUpperCase()}] ${urlShort}`);
      }

      if (['xhr', 'fetch'].includes(resourceType) && this.isRelevantEndpoint(url)) {
        try {
          const contentType = response.headers()['content-type'] || '';

          // Intentar obtener como texto
          const text = await response.text();

          // Solo guardar si no lo tenemos ya (evitar duplicados)
          const alreadyCaptured = this.capturedResponses.some(r => r.url === url && r.body === text);

          if (!alreadyCaptured && text && text.length > 0) {
            this.capturedResponses.push({
              url: url,
              timestamp: Date.now(),
              body: text,
              headers: response.headers(),
              status: response.status(),
              mimeType: contentType,
              method: 'page.on'
            });

            console.log(`✅ [Fallback] Respuesta capturada (${text.length} bytes)`);
          }

        } catch (error) {
          // Silenciar errores de respuestas que no se pueden leer
        }
      }
    });

    console.log('✅ Interceptación de red configurada');
  }

  /**
   * Determinar si una URL es un endpoint relevante
   */
  isRelevantEndpoint(url) {
    const relevantPatterns = [
      '/maps/rpc/listugcposts',
      'listugcposts',
      'reviewSort',
      'preview/review/listentitiesreviews',
      'preview/review',
      '/maps/preview/place',        // IMPORTANTE: Endpoint principal con datos del lugar y reseñas
      '/maps/preview/passiveassist',
      '/maps/preview/lp',
      'rpc'
    ];

    return relevantPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Navegar a la página de Google Maps
   */
  async navigateToPlace(url) {
    console.log(`🌐 Navegando a: ${url}`);

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      console.log('✅ Página cargada');

      // Esperar un momento para que se carguen elementos dinámicos
      await this.randomDelay(2000, 3000);

    } catch (error) {
      console.error('❌ Error navegando a la página:', error.message);
      throw error;
    }
  }

  /**
   * Hacer click en la pestaña de Opiniones
   */
  async clickReviewsTab() {
    console.log('🔍 Buscando pestaña de Opiniones...');

    try {
      // Esperar a que la página esté completamente cargada
      await this.randomDelay(3000, 4000);

      // Estrategia 1: Buscar tabs y botones con Reseñas/Opiniones/Reviews
      const foundElements = await this.page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        const buttons = Array.from(document.querySelectorAll('button'));

        const matchingTabs = tabs
          .filter(el => {
            const text = el.textContent || '';
            return text.toLowerCase().includes('reseña') ||
                   text.toLowerCase().includes('opini') ||
                   text.toLowerCase().includes('review');
          })
          .map((el, index) => ({
            type: 'tab',
            index,
            text: el.textContent?.trim().substring(0, 50)
          }));

        const matchingButtons = buttons
          .filter(btn => {
            const label = btn.getAttribute('aria-label') || '';
            return label.toLowerCase().includes('reseña') ||
                   label.toLowerCase().includes('opini') ||
                   label.toLowerCase().includes('review');
          })
          .map((btn, index) => ({
            type: 'button',
            index,
            label: btn.getAttribute('aria-label'),
            text: btn.textContent?.trim().substring(0, 30)
          }));

        return { tabs: matchingTabs, buttons: matchingButtons };
      });

      console.log('📋 Tabs encontrados:', foundElements.tabs);
      console.log('📋 Botones encontrados:', foundElements.buttons);

      // Estrategia 2: Click usando XPath para texto visible
      let clicked = false;

      const xpathSelectors = [
        '//*[@role="tab" and contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "reseña")]',
        '//*[@role="tab" and contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "opini")]',
        '//*[@role="tab" and contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "review")]',
        '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "reseña")]',
        '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "opini")]',
        '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "review")]'
      ];

      for (const xpath of xpathSelectors) {
        try {
          const elements = await this.page.$x(xpath);
          if (elements.length > 0) {
            await elements[0].click();
            console.log(`✅ Click exitoso en pestaña de Opiniones usando XPath`);
            clicked = true;
            break;
          }
        } catch (e) {
          // Continuar
        }
      }

      if (!clicked) {
        console.log('⚠️  No se pudo hacer click automático en Opiniones');
        console.log('⚠️  Puede que ya esté en la pestaña de Opiniones o que el selector haya cambiado');
      }

      // Esperar a que se cargue el contenido de la pestaña
      await this.randomDelay(3000, 4000);

    } catch (error) {
      console.log('⚠️  Error haciendo click en Opiniones:', error.message);
    }
  }

  /**
   * Ordenar por más recientes
   */
  async sortByNewest() {
    console.log('🔄 Intentando ordenar por más recientes...');

    try {
      // Esperar a que la interfaz esté lista
      await this.randomDelay(2000, 3000);

      // ============================================================
      // PASO 1: ENCONTRAR Y HACER CLICK EN EL BOTÓN "ORDENAR"
      // ============================================================
      console.log('📍 Paso 1: Buscando botón de ordenar...');

      let sortClicked = false;

      // Buscar botón de ordenar y hacer scroll hasta él (CRÍTICO PARA HEADLESS)
      try {
        const sortButtonFound = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
          const sortBtn = buttons.find(btn => {
            const label = btn.getAttribute('aria-label').toLowerCase();
            return label.includes('ordenar') || label.includes('sort');
          });

          if (sortBtn) {
            // Hacer scroll hasta el elemento (crítico en headless)
            sortBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
            return {
              found: true,
              label: sortBtn.getAttribute('aria-label'),
              text: sortBtn.textContent.trim()
            };
          }

          return { found: false };
        });

        if (sortButtonFound.found) {
          console.log(`📌 Botón encontrado: "${sortButtonFound.label}"`);

          // Esperar un momento después del scroll
          await this.randomDelay(500, 1000);

          // Hacer click usando JavaScript (más confiable en headless)
          await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
            const sortBtn = buttons.find(btn => {
              const label = btn.getAttribute('aria-label').toLowerCase();
              return label.includes('ordenar') || label.includes('sort');
            });

            if (sortBtn) {
              sortBtn.click();
              return true;
            }
            return false;
          });

          console.log('✅ Click ejecutado en botón Ordenar (JavaScript)');
          sortClicked = true;

          // Espera más larga para que el menú se abra
          await this.randomDelay(3000, 4000);
        }
      } catch (e) {
        console.log('⚠️  Error en estrategia principal:', e.message);
      }

      // Fallback: intentar con XPath si la estrategia principal falla
      if (!sortClicked) {
        console.log('⚠️  Intentando estrategia XPath...');

        const sortXpaths = [
          '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "ordenar")]',
          '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "sort")]',
        ];

        for (const xpath of sortXpaths) {
          try {
            const elements = await this.page.$x(xpath);
            if (elements.length > 0) {
              // Hacer scroll al elemento
              await this.page.evaluate(el => {
                el.scrollIntoView({ behavior: 'instant', block: 'center' });
              }, elements[0]);

              await this.randomDelay(500, 1000);

              // Click usando evaluate (más confiable)
              await this.page.evaluate(el => el.click(), elements[0]);

              console.log('✅ Click en botón Ordenar (XPath con JS)');
              sortClicked = true;
              await this.randomDelay(3000, 4000);
              break;
            }
          } catch (e) {
            // Continuar con el siguiente XPath
          }
        }
      }

      if (!sortClicked) {
        console.log('❌ No se encontró botón de ordenar');
        return;
      }

      // ============================================================
      // PASO 2: VERIFICAR QUE EL MENÚ SE ABRIÓ
      // ============================================================
      console.log('📍 Paso 2: Verificando que el menú se abrió...');

      // Esperar a que el menú sea visible
      let menuOpened = false;
      const maxAttempts = 10;

      for (let i = 0; i < maxAttempts; i++) {
        const menuCheck = await this.page.evaluate(() => {
          const menu = document.querySelector('[role="menu"]');
          if (!menu) return { visible: false };

          const menuItems = menu.querySelectorAll('[role="menuitemradio"]');
          const items = Array.from(menuItems).map(item => item.textContent.trim());

          return {
            visible: menuItems.length > 0,
            itemCount: menuItems.length,
            items: items
          };
        });

        if (menuCheck.visible) {
          console.log(`✅ Menú abierto con ${menuCheck.itemCount} opciones:`, menuCheck.items);
          menuOpened = true;
          break;
        }

        // Esperar un poco antes de reintentar
        await this.randomDelay(300, 500);
      }

      if (!menuOpened) {
        console.log('❌ El menú no se abrió correctamente después de múltiples intentos');
        return;
      }

      // ============================================================
      // PASO 3: BUSCAR Y HACER CLICK EN "MÁS RECIENTES"
      // ============================================================
      console.log('📍 Paso 3: Buscando y haciendo click en "Más recientes"...');

      let newestClicked = false;

      try {
        // Primero hacer scroll a la opción y luego hacer click
        const clickResult = await this.page.evaluate(() => {
          const menu = document.querySelector('[role="menu"]');
          if (!menu) return { success: false, error: 'Menú no encontrado' };

          const menuItems = Array.from(menu.querySelectorAll('[role="menuitemradio"]'));

          // Buscar la opción que contenga "reciente" o "newest"
          const newestOption = menuItems.find(item => {
            const text = item.textContent.toLowerCase().trim();
            return text.includes('reciente') || text.includes('newest');
          });

          if (newestOption) {
            // Hacer scroll hasta la opción (crítico en headless)
            newestOption.scrollIntoView({ behavior: 'instant', block: 'nearest' });

            // Click directo sin requestAnimationFrame (más confiable en headless)
            newestOption.click();
            return { success: true, text: newestOption.textContent.trim() };
          }

          return { success: false, error: 'Opción "Más recientes" no encontrada' };
        });

        if (clickResult.success) {
          console.log(`✅ Seleccionado: "${clickResult.text}" (JavaScript con scroll)`);
          newestClicked = true;
        } else {
          console.log(`⚠️  ${clickResult.error}`);
        }
      } catch (e) {
        console.log('⚠️  Error haciendo click en "Más recientes":', e.message);
      }

      // Fallback con XPath si falla
      if (!newestClicked) {
        console.log('⚠️  Intentando estrategia XPath para "Más recientes"...');

        const newestXpaths = [
          '//*[@role="menuitemradio" and contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "reciente")]',
          '//*[@role="menuitemradio" and contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "newest")]',
          '//*[@role="menuitem" and contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "reciente")]',
        ];

        for (const xpath of newestXpaths) {
          try {
            const elements = await this.page.$x(xpath);
            if (elements.length > 0) {
              const text = await this.page.evaluate(el => el.textContent.trim(), elements[0]);

              // Scroll y click con JavaScript
              await this.page.evaluate(el => {
                el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
                el.click();
              }, elements[0]);

              console.log(`✅ Seleccionado: "${text}" (XPath con JS)`);
              newestClicked = true;
              break;
            }
          } catch (e) {
            // Continuar con el siguiente XPath
          }
        }
      }

      if (!newestClicked) {
        console.log('❌ No se pudo seleccionar "Más recientes"');
        return;
      }

      // ============================================================
      // PASO 4: ESPERAR A QUE SE RECARGUEN LAS RESEÑAS
      // ============================================================
      console.log('📍 Paso 4: Esperando recarga de reseñas ordenadas...');

      // CRÍTICO: Esperar a que se carguen las reseñas ordenadas
      // Esto debería generar nuevas solicitudes a /maps/rpc/listugcposts
      // Aumentado a 8-10 segundos para mayor confiabilidad
      await this.randomDelay(8000, 10000);

      console.log('✅ Ordenamiento completado - las reseñas deberían estar ordenadas por más recientes');

    } catch (error) {
      console.log('❌ Error ordenando:', error.message);
      console.log('Stack:', error.stack);
    }
  }

  /**
   * Hacer scroll en el panel de reseñas para cargar más
   */
  async scrollReviews() {
    console.log('📜 Iniciando scroll para cargar más reseñas...');

    try {
      // Buscar el contenedor de reseñas
      const scrollableSelectors = [
        'div[role="feed"]',
        'div[aria-label*="Reviews"]',
        'div[aria-label*="Opiniones"]',
        '.m6QErb.DxyBCb.kA9KIf.dS8AEf' // Selector específico de Google Maps
      ];

      let scrollableDiv = null;

      for (const selector of scrollableSelectors) {
        scrollableDiv = await this.page.$(selector);
        if (scrollableDiv) {
          console.log(`✅ Contenedor de scroll encontrado: ${selector}`);
          break;
        }
      }

      if (!scrollableDiv) {
        console.log('⚠️  No se encontró contenedor scrollable, usando scroll de página');

        // Fallback: scroll en la página completa
        for (let i = 0; i < this.maxScrolls; i++) {
          await this.page.evaluate(() => {
            window.scrollBy(0, 500);
          });

          await this.randomDelay(this.scrollDelay, this.scrollDelay + 1000);
          console.log(`  Scroll ${i + 1}/${this.maxScrolls}`);

          // Callback de progreso
          if (this.onProgress) {
            this.onProgress(i + 1, this.maxScrolls, `Scrolling... ${i + 1}/${this.maxScrolls}`);
          }
        }

        return;
      }

      // Scroll en el contenedor específico
      let previousHeight = 0;
      let unchangedCount = 0;
      const maxUnchanged = 20;

      for (let i = 0; i < this.maxScrolls; i++) {
        // Obtener altura actual
        const currentHeight = await this.page.evaluate((element) => {
          return element.scrollHeight;
        }, scrollableDiv);

        // Hacer scroll
        await this.page.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        }, scrollableDiv);

        console.log(`  Scroll ${i + 1}/${this.maxScrolls} (altura: ${currentHeight}px)`);

        // Callback de progreso
        if (this.onProgress) {
          this.onProgress(i + 1, this.maxScrolls, `Scrolling... ${i + 1}/${this.maxScrolls}`);
        }

        // Verificar si cambió la altura
        if (currentHeight === previousHeight) {
          unchangedCount++;
          console.log(`  ⚠️  Altura sin cambios (${unchangedCount}/${maxUnchanged})`);

          if (unchangedCount >= maxUnchanged) {
            console.log('✅ No hay más contenido para cargar');
            break;
          }
        } else {
          unchangedCount = 0;
        }

        previousHeight = currentHeight;

        // Delay aleatorio entre scrolls
        await this.randomDelay(this.scrollDelay, this.scrollDelay + 1000);

        // Verificar si alcanzamos el límite de reseñas (estimado)
        if (this.reviewsLimit && this.capturedResponses.length > this.reviewsLimit / 10) {
          console.log(`✅ Límite de reseñas alcanzado (estimado)`);
          break;
        }
      }

      console.log('✅ Scroll completado');

    } catch (error) {
      console.error('❌ Error durante el scroll:', error.message);
    }
  }

  /**
   * Delay aleatorio para simular comportamiento humano
   */
  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Obtener todas las respuestas capturadas
   */
  getCapturedResponses() {
    return this.capturedResponses;
  }

  /**
   * Ejecutar el scraping completo
   */
  async scrape(url) {
    try {
      await this.initialize();
      this.setupNetworkInterception();
      await this.navigateToPlace(url);
      await this.clickReviewsTab();
      await this.sortByNewest();
      await this.scrollReviews();

      // Esperar un momento final para capturar últimas respuestas
      await this.randomDelay(3000, 5000);

      console.log(`\n📊 Total de respuestas capturadas: ${this.capturedResponses.length}`);

      return this.capturedResponses;

    } catch (error) {
      console.error('❌ Error durante el scraping:', error);
      throw error;
    }
  }

  /**
   * Cerrar navegador y limpiar recursos
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ Navegador cerrado');
    }
  }
}

module.exports = GoogleMapsScraper;
