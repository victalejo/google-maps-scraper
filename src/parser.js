/**
 * Parser para respuestas de Google Maps
 * Maneja múltiples formatos: JSON, Protocol Buffer, formato propietario de Google
 */

class GoogleMapsParser {
  constructor() {
    this.parsedReviews = [];
    this.errors = [];
  }

  /**
   * Parsear todas las respuestas capturadas
   */
  parseResponses(capturedResponses) {
    console.log(`\n🔍 Parseando ${capturedResponses.length} respuestas...`);

    for (let i = 0; i < capturedResponses.length; i++) {
      const response = capturedResponses[i];

      try {
        console.log(`\nProcesando respuesta ${i + 1}/${capturedResponses.length}`);
        console.log(`  URL: ${response.url.substring(0, 80)}...`);
        console.log(`  Tamaño: ${response.body.length} bytes`);

        const reviews = this.parseResponse(response);

        if (reviews && reviews.length > 0) {
          this.parsedReviews.push(...reviews);
          console.log(`  ✅ ${reviews.length} reseñas extraídas`);
        } else {
          console.log(`  ⚠️  No se encontraron reseñas en esta respuesta`);
        }

      } catch (error) {
        console.log(`  ❌ Error parseando respuesta: ${error.message}`);
        this.errors.push({
          responseIndex: i,
          url: response.url,
          error: error.message
        });
      }
    }

    console.log(`\n📊 Total de reseñas parseadas: ${this.parsedReviews.length}`);
    console.log(`⚠️  Errores: ${this.errors.length}`);

    return this.parsedReviews;
  }

  /**
   * Parsear una respuesta individual
   */
  parseResponse(response) {
    const body = response.body;
    const url = response.url || '';

    // ESTRATEGIA PRIORITARIA: Detectar endpoint listugcposts
    if (url.includes('/maps/rpc/listugcposts')) {
      console.log('  🎯 Detectado endpoint listugcposts - usando parser especializado');
      return this.parseListUgcPosts(body, url);
    }

    // Estrategia 1: Intentar parsear como JSON
    try {
      const jsonData = JSON.parse(body);
      return this.extractReviewsFromJSON(jsonData);
    } catch (e) {
      // No es JSON puro, continuar con otras estrategias
    }

    // Estrategia 2: Limpiar prefijos de seguridad de Google y reintentar JSON
    try {
      // Google a veces prefija respuestas con ")]}'", ")]}'" o similares
      const cleanedBody = body.replace(/^\)\]\}'\n?/, '').replace(/^\)\]\}\'\n?/, '');
      const jsonData = JSON.parse(cleanedBody);
      return this.extractReviewsFromJSON(jsonData);
    } catch (e) {
      // Tampoco funciona
    }

    // Estrategia 3: Buscar arrays JSON embebidos en la respuesta
    try {
      const reviews = this.extractReviewsFromRawText(body);
      if (reviews.length > 0) {
        return reviews;
      }
    } catch (e) {
      console.log(`    Error en estrategia 3: ${e.message}`);
    }

    // Estrategia 4: Analizar formato Protocol Buffer (más complejo)
    try {
      const reviews = this.extractReviewsFromProtobuf(body);
      if (reviews.length > 0) {
        return reviews;
      }
    } catch (e) {
      console.log(`    Error en estrategia 4: ${e.message}`);
    }

    return [];
  }

  /**
   * Parser especializado para el endpoint /maps/rpc/listugcposts
   * Formato: )]}'[null, "token", [[["review_data", ...], ...], ...]]
   */
  parseListUgcPosts(body, url) {
    const reviews = [];

    try {
      // Remover prefijo de seguridad )]}'
      let cleanBody = body.trim();
      if (cleanBody.startsWith(')]}\'')) {
        cleanBody = cleanBody.substring(4);
      }

      const data = JSON.parse(cleanBody);

      if (!Array.isArray(data)) {
        console.log('  ⚠️  listugcposts: formato inesperado (no es array)');
        return [];
      }

      // Estructura típica: [null, "pagination_token", [[["review_id", [...review_data...]], ...], ...]]
      // Las reseñas están en el tercer elemento (index 2)
      const reviewsContainer = data[2];

      if (!Array.isArray(reviewsContainer)) {
        console.log('  ⚠️  listugcposts: no se encontró contenedor de reseñas en data[2]');
        return [];
      }

      // Iterar sobre el contenedor de reseñas
      for (const reviewGroup of reviewsContainer) {
        if (!Array.isArray(reviewGroup)) continue;

        // Cada reviewGroup es un array de reseñas
        for (const reviewItem of reviewGroup) {
          if (!Array.isArray(reviewItem) || reviewItem.length < 2) continue;

          try {
            const review = this.parseListUgcPostReview(reviewItem);
            if (review) {
              reviews.push(review);
            }
          } catch (err) {
            console.log(`  ⚠️  Error parseando reseña individual: ${err.message}`);
          }
        }
      }

      console.log(`  ✅ listugcposts: ${reviews.length} reseñas extraídas`);

    } catch (error) {
      console.log(`  ❌ Error parseando listugcposts: ${error.message}`);
      this.errors.push({
        url: url,
        message: `listugcposts parser: ${error.message}`,
        body: body.substring(0, 500)
      });
    }

    return reviews;
  }

  /**
   * Parsear una reseña individual del formato listugcposts
   * Estructura observada:
   * [
   *   "review_id",
   *   ["place_id", null, timestamp, ...],
   *   ["Author Name", "photo_url"],
   *   ...,
   *   [[rating], null, null, ...],
   *   [[["Review text", null, [0, length]], ...], ...],
   *   "Relative date",
   *   ...
   * ]
   */
  parseListUgcPostReview(reviewArray) {
    const review = {
      autor: null,
      autor_foto: null,
      autor_url_perfil: null,
      autor_user_id: null,
      autor_total_opiniones: null,
      autor_total_fotos: null,
      autor_local_guide: null,
      calificacion: null,
      texto: null,
      fecha_relativa: null,
      fecha_iso: null,
      timestamp_segundos: null,
      editado: false,
      fecha_edicion_iso: null,
      fecha_edicion_relativa: null,
      fecha_original_iso: null,
      likes: null,
      respuesta_propietario: null,
      respuesta_propietario_fecha: null,
      fotos: [],
      aspectos: {
        precio_por_persona: null,
        comida: null,
        servicio: null,
        ambiente: null,
        platos_recomendados: [],
        tiempo_espera: null,
        nivel_ruido: null,
        tamano_grupo: null,
        reserva: null,
        disponibilidad_estacionamiento: null,
        opciones_estacionamiento: []
      }
    };

    try {
      // Estructura observada:
      // [0]: Review ID (string)
      // [1]: Array[16] - Contiene place_id, timestamps, autor
      //   [1][2]: timestamp en MICROSEGUNDOS
      //   [1][4][5]: Array con datos del autor
      //     [0]: Nombre
      //     [1]: Foto URL
      //     [2]: Array con URL del perfil
      //     [3]: User ID
      //     [5]: Total opiniones
      //     [6]: Total fotos
      //     [10]: Array con texto "Local Guide · X opiniones"
      // [2]: Array[16] - Contiene rating, fotos, aspectos guiados, texto
      //   [2][0]: [rating]
      //   [2][2]: Array con datos de fotos
      //   [2][6]: Array con aspectos guiados
      //   [2][-2]: Idioma ["es"]
      //   [2][-1]: Texto de la reseña [[["texto", null, [0, length]]]]
      // [3]: Array[15] - Contiene fechas, respuesta del propietario
      //   [3][3]: fecha relativa (string "Hace X meses")
      //   [3][-2]: Idioma ["es"]
      //   [3][-1]: Texto de respuesta del propietario [[["texto", null, [0, length]]]]
      // [4]: Array[7] - URLs
      // [5]: Token (string)

      // ========== EXTRAER DATOS DEL AUTOR ==========
      if (Array.isArray(reviewArray[1]) && Array.isArray(reviewArray[1][4]) &&
          Array.isArray(reviewArray[1][4][5]) && reviewArray[1][4][5].length >= 2) {
        const autorData = reviewArray[1][4][5];

        // Nombre y foto
        if (typeof autorData[0] === 'string') review.autor = autorData[0];
        if (typeof autorData[1] === 'string') review.autor_foto = autorData[1];

        // URL del perfil
        if (Array.isArray(autorData[2]) && autorData[2].length > 0) {
          review.autor_url_perfil = autorData[2][0];
        }

        // User ID
        if (typeof autorData[3] === 'string') review.autor_user_id = autorData[3];

        // Total de opiniones y fotos
        if (typeof autorData[5] === 'number') review.autor_total_opiniones = autorData[5];
        if (typeof autorData[6] === 'number') review.autor_total_fotos = autorData[6];

        // Local Guide status
        if (Array.isArray(autorData[10]) && typeof autorData[10][0] === 'string') {
          review.autor_local_guide = autorData[10][0];
        }
      }

      // ========== EXTRAER CALIFICACIÓN ==========
      if (Array.isArray(reviewArray[2]) && Array.isArray(reviewArray[2][0]) && typeof reviewArray[2][0][0] === 'number') {
        const rating = reviewArray[2][0][0];
        if (rating >= 1 && rating <= 5) {
          review.calificacion = rating;
        }
      }

      // ========== EXTRAER TEXTO DE LA RESEÑA ==========
      // El texto está en reviewArray[2][15][0][0]
      if (Array.isArray(reviewArray[2]) &&
          Array.isArray(reviewArray[2][15]) &&
          Array.isArray(reviewArray[2][15][0]) &&
          typeof reviewArray[2][15][0][0] === 'string') {
        review.texto = reviewArray[2][15][0][0];
      }

      // ========== EXTRAER ASPECTOS GUIADOS ==========
      // Los aspectos están en reviewArray[2][6] como array de arrays con IDs tipo "GUIDED_DINING_..."
      if (Array.isArray(reviewArray[2]) && Array.isArray(reviewArray[2][6])) {
        for (const aspecto of reviewArray[2][6]) {
          if (!Array.isArray(aspecto) || aspecto.length < 2) continue;

          const aspectoId = Array.isArray(aspecto[0]) ? aspecto[0][0] : null;

          if (aspectoId === 'GUIDED_DINING_PRICE_RANGE' && Array.isArray(aspecto[2]) && Array.isArray(aspecto[2][0])) {
            review.aspectos.precio_por_persona = aspecto[2][0][0] && aspecto[2][0][0][1];
          } else if (aspectoId === 'GUIDED_DINING_FOOD_ASPECT' && Array.isArray(aspecto[11]) && aspecto[11].length > 0) {
            review.aspectos.comida = aspecto[11][0];
          } else if (aspectoId === 'GUIDED_DINING_SERVICE_ASPECT' && Array.isArray(aspecto[11]) && aspecto[11].length > 0) {
            review.aspectos.servicio = aspecto[11][0];
          } else if (aspectoId === 'GUIDED_DINING_ATMOSPHERE_ASPECT' && Array.isArray(aspecto[11]) && aspecto[11].length > 0) {
            review.aspectos.ambiente = aspecto[11][0];
          } else if (aspectoId === 'GUIDED_DINING_DISH_RECOMMENDATION' && Array.isArray(aspecto[3]) && Array.isArray(aspecto[3][0])) {
            // Platos recomendados
            for (const plato of aspecto[3][0]) {
              if (Array.isArray(plato) && plato.length > 1 && typeof plato[1] === 'string') {
                review.aspectos.platos_recomendados.push(plato[1]);
              }
            }
          } else if (aspectoId === 'GUIDED_DINING_WAIT_TIME' && Array.isArray(aspecto[2]) && Array.isArray(aspecto[2][0])) {
            review.aspectos.tiempo_espera = aspecto[2][0][0] && aspecto[2][0][0][1];
          } else if (aspectoId === 'GUIDED_DINING_NOISE_LEVEL' && Array.isArray(aspecto[2]) && Array.isArray(aspecto[2][0])) {
            review.aspectos.nivel_ruido = aspecto[2][0][0] && aspecto[2][0][0][1];
          } else if (aspectoId === 'GUIDED_DINING_GROUP_SIZE' && Array.isArray(aspecto[3]) && Array.isArray(aspecto[3][0])) {
            review.aspectos.tamano_grupo = aspecto[3][0][0] && aspecto[3][0][0][1];
          } else if (aspectoId === 'GUIDED_DINING_RESERVATION' && Array.isArray(aspecto[2]) && Array.isArray(aspecto[2][0])) {
            review.aspectos.reserva = aspecto[2][0][0] && aspecto[2][0][0][1];
          } else if (aspectoId === 'GUIDED_DINING_PARKING_SPACE_AVAILABILITY' && Array.isArray(aspecto[2]) && Array.isArray(aspecto[2][0])) {
            // Disponibilidad de estacionamiento
            review.aspectos.disponibilidad_estacionamiento = aspecto[2][0][0] && aspecto[2][0][0][1];
          } else if (aspectoId === 'GUIDED_DINING_PARKING_OPTIONS' && Array.isArray(aspecto[3]) && Array.isArray(aspecto[3][0])) {
            // Opciones de estacionamiento (array)
            for (const opcion of aspecto[3][0]) {
              if (Array.isArray(opcion) && opcion.length > 1 && typeof opcion[1] === 'string') {
                review.aspectos.opciones_estacionamiento.push(opcion[1]);
              }
            }
          }
        }
      }

      // ========== EXTRAER FOTOS ==========
      if (Array.isArray(reviewArray[2]) && Array.isArray(reviewArray[2][2])) {
        for (const fotoItem of reviewArray[2][2]) {
          if (Array.isArray(fotoItem) && Array.isArray(fotoItem[1]) && Array.isArray(fotoItem[1][6])) {
            const fotoUrl = fotoItem[1][6][0];
            if (typeof fotoUrl === 'string' && fotoUrl.includes('http')) {
              review.fotos.push(fotoUrl);
            }
          }
        }
      }

      // ========== EXTRAER FECHA RELATIVA Y DETECTAR EDICIÓN ==========
      // La fecha relativa está en reviewArray[3][3]
      if (Array.isArray(reviewArray[3]) && typeof reviewArray[3][3] === 'string') {
        review.fecha_relativa = reviewArray[3][3];
      }

      // IMPORTANTE: Detectar si la reseña fue editada
      // El texto "Editado" está en reviewArray[1][6], NO en reviewArray[3][3]
      if (Array.isArray(reviewArray[1]) && typeof reviewArray[1][6] === 'string') {
        if (reviewArray[1][6].includes('Editado') || reviewArray[1][6].includes('Edited')) {
          review.editado = true;
          review.fecha_edicion_relativa = reviewArray[1][6];
        }
      }

      // ========== EXTRAER TIMESTAMPS (ORIGINAL Y EDICIÓN) ==========
      if (Array.isArray(reviewArray[1])) {
        // Timestamp original (reviewArray[1][2])
        if (typeof reviewArray[1][2] === 'number') {
          const timestampMicroseconds = reviewArray[1][2];
          const timestampMilliseconds = Math.floor(timestampMicroseconds / 1000);
          if (timestampMilliseconds > 946684800000) {
            const timestampSegundos = Math.floor(timestampMilliseconds / 1000);
            const fechaISO = new Date(timestampMilliseconds).toISOString();

            if (review.editado) {
              // Si está editada, este es el timestamp original
              review.fecha_original_iso = fechaISO;
            } else {
              // Si no está editada, este es el timestamp único
              review.timestamp_segundos = timestampSegundos;
              review.fecha_iso = fechaISO;
            }
          }
        }

        // Timestamp de edición (reviewArray[1][3]) - solo si existe y es diferente
        if (review.editado && typeof reviewArray[1][3] === 'number') {
          const timestampEdicionMicroseconds = reviewArray[1][3];
          const timestampEdicionMilliseconds = Math.floor(timestampEdicionMicroseconds / 1000);

          // Verificar que sea diferente del timestamp original
          if (timestampEdicionMilliseconds > 946684800000) {
            review.timestamp_segundos = Math.floor(timestampEdicionMilliseconds / 1000);
            review.fecha_iso = new Date(timestampEdicionMilliseconds).toISOString();
            review.fecha_edicion_iso = new Date(timestampEdicionMilliseconds).toISOString();
          }
        }
      }

      // ========== EXTRAER RESPUESTA DEL PROPIETARIO ==========
      // La respuesta está en reviewArray[3][14][0][0]
      if (Array.isArray(reviewArray[3])) {
        // Texto de respuesta
        if (Array.isArray(reviewArray[3][14]) &&
            Array.isArray(reviewArray[3][14][0]) &&
            typeof reviewArray[3][14][0][0] === 'string') {
          review.respuesta_propietario = reviewArray[3][14][0][0];
        }

        // Fecha de la respuesta del propietario (reviewArray[3][1] en microsegundos)
        if (typeof reviewArray[3][1] === 'number') {
          const timestampMicroseconds = reviewArray[3][1];
          const timestampMilliseconds = Math.floor(timestampMicroseconds / 1000);
          if (timestampMilliseconds > 946684800000) {
            review.respuesta_propietario_fecha = new Date(timestampMilliseconds).toISOString();
          }
        }
      }

      // Solo retornar si tenemos al menos autor o calificación
      if (review.autor || review.calificacion) {
        return review;
      }

      return null;

    } catch (error) {
      console.log(`  ⚠️  Error parseando reseña: ${error.message}`);
      return null;
    }
  }

  /**
   * Extraer reseñas de un objeto JSON ya parseado
   */
  extractReviewsFromJSON(data) {
    const reviews = [];

    // Buscar arrays que parezcan contener reseñas
    const findReviews = (obj, depth = 0) => {
      if (depth > 10) return; // Limitar profundidad

      if (Array.isArray(obj)) {
        // Si es un array, revisar cada elemento
        for (const item of obj) {
          if (this.looksLikeReview(item)) {
            const review = this.normalizeReview(item);
            if (review) {
              reviews.push(review);
            }
          } else if (typeof item === 'object' && item !== null) {
            findReviews(item, depth + 1);
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        // Si es un objeto, revisar sus propiedades
        for (const key in obj) {
          // Claves comunes para reviews
          if (['reviews', 'review', 'items', 'data', 'results'].includes(key.toLowerCase())) {
            findReviews(obj[key], depth + 1);
          } else if (typeof obj[key] === 'object') {
            findReviews(obj[key], depth + 1);
          }
        }
      }
    };

    findReviews(data);
    return reviews;
  }

  /**
   * Determinar si un objeto parece una reseña
   */
  looksLikeReview(obj) {
    if (typeof obj !== 'object' || obj === null) return false;

    // Buscar campos comunes en reseñas
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    const hasRating = keys.some(k => k.includes('rating') || k.includes('stars') || k.includes('score'));
    const hasText = keys.some(k => k.includes('text') || k.includes('comment') || k.includes('review') || k.includes('content'));
    const hasAuthor = keys.some(k => k.includes('author') || k.includes('user') || k.includes('name') || k.includes('reviewer'));
    const hasDate = keys.some(k => k.includes('date') || k.includes('time') || k.includes('publish'));

    // Si tiene al menos 2 de estos campos, probablemente es una reseña
    const score = [hasRating, hasText, hasAuthor, hasDate].filter(Boolean).length;
    return score >= 2;
  }

  /**
   * Normalizar una reseña a formato estándar
   */
  normalizeReview(rawReview) {
    try {
      const review = {
        autor: this.extractField(rawReview, ['author', 'reviewer', 'user', 'name', 'userName', 'displayName']),
        autor_id: this.extractField(rawReview, ['authorId', 'userId', 'reviewerId', 'id']),
        calificacion: this.extractRating(rawReview),
        texto: this.extractField(rawReview, ['text', 'comment', 'review', 'content', 'reviewText', 'snippet']),
        fecha_relativa: this.extractField(rawReview, ['relativePublishTimeDescription', 'relativeTime', 'timeAgo']),
        fecha_iso: null,
        timestamp_microsegundos: null,
        timestamp_segundos: null,
        respuesta_propietario: this.extractOwnerResponse(rawReview),
        fotos: this.extractPhotos(rawReview),
        likes: this.extractField(rawReview, ['likes', 'thumbsUpCount', 'helpful']),
        autor_total_reseñas: this.extractField(rawReview, ['reviewsCount', 'totalReviews'])
      };

      // Extraer y convertir timestamp
      const timestamp = this.extractTimestamp(rawReview);
      if (timestamp) {
        review.timestamp_microsegundos = timestamp.microseconds;
        review.timestamp_segundos = timestamp.seconds;
        review.fecha_iso = timestamp.iso;
        review.fecha_exacta = timestamp.iso;
      }

      // Verificar que la reseña tenga al menos un campo útil
      if (!review.autor && !review.texto && !review.calificacion) {
        return null;
      }

      return review;

    } catch (error) {
      console.log(`    Error normalizando reseña: ${error.message}`);
      return null;
    }
  }

  /**
   * Extraer campo de un objeto, buscando en múltiples posibles keys
   */
  extractField(obj, possibleKeys) {
    for (const key of possibleKeys) {
      // Búsqueda exacta
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return obj[key];
      }

      // Búsqueda case-insensitive
      const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null && obj[foundKey] !== '') {
        return obj[foundKey];
      }
    }

    // Búsqueda profunda (un nivel)
    for (const objKey in obj) {
      if (typeof obj[objKey] === 'object' && obj[objKey] !== null && !Array.isArray(obj[objKey])) {
        const result = this.extractField(obj[objKey], possibleKeys);
        if (result !== undefined && result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Extraer calificación (normalizar a número 1-5)
   */
  extractRating(obj) {
    const rating = this.extractField(obj, ['rating', 'stars', 'score', 'starRating']);

    if (rating === null || rating === undefined) return null;

    const numRating = typeof rating === 'number' ? rating : parseFloat(rating);

    if (isNaN(numRating)) return null;

    // Asegurar que esté en rango 1-5
    if (numRating >= 1 && numRating <= 5) {
      return numRating;
    }

    return null;
  }

  /**
   * Extraer timestamp y convertir a diferentes formatos
   */
  extractTimestamp(obj) {
    const timestampFields = [
      'publishTime', 'publishedTime', 'createTime', 'timestamp', 'date',
      'time', 'publishedAt', 'createdAt', 'datetime', 'reviewTime'
    ];

    for (const field of timestampFields) {
      const value = this.extractField(obj, [field]);

      if (value) {
        // Si es string ISO
        if (typeof value === 'string' && value.includes('T')) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return {
              iso: date.toISOString(),
              seconds: Math.floor(date.getTime() / 1000),
              microseconds: date.getTime() * 1000
            };
          }
        }

        // Si es número (timestamp)
        if (typeof value === 'number') {
          // Detectar si es segundos, milisegundos o microsegundos
          let date;

          if (value > 1e15) {
            // Microsegundos (16+ dígitos)
            date = new Date(value / 1000);
          } else if (value > 1e12) {
            // Milisegundos (13-15 dígitos)
            date = new Date(value);
          } else {
            // Segundos (10-12 dígitos)
            date = new Date(value * 1000);
          }

          if (!isNaN(date.getTime())) {
            return {
              iso: date.toISOString(),
              seconds: Math.floor(date.getTime() / 1000),
              microseconds: date.getTime() * 1000
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Extraer respuesta del propietario
   */
  extractOwnerResponse(obj) {
    const ownerFields = ['ownerResponse', 'reply', 'response', 'businessResponse'];

    for (const field of ownerFields) {
      const response = this.extractField(obj, [field]);
      if (response) {
        if (typeof response === 'string') {
          return response;
        } else if (typeof response === 'object' && response.text) {
          return response.text;
        }
      }
    }

    return null;
  }

  /**
   * Extraer URLs de fotos
   */
  extractPhotos(obj) {
    const photoFields = ['photos', 'images', 'photoUrls', 'imageUrls'];

    for (const field of photoFields) {
      const photos = this.extractField(obj, [field]);
      if (photos) {
        if (Array.isArray(photos)) {
          return photos.map(p => {
            if (typeof p === 'string') return p;
            if (p.url) return p.url;
            if (p.thumbnail) return p.thumbnail;
            return null;
          }).filter(Boolean);
        }
      }
    }

    return [];
  }

  /**
   * Extraer reseñas de texto crudo buscando patrones JSON
   */
  extractReviewsFromRawText(text) {
    const reviews = [];

    // Buscar arrays JSON embebidos
    const arrayMatches = text.matchAll(/\[[\s\S]*?\]/g);

    for (const match of arrayMatches) {
      try {
        const data = JSON.parse(match[0]);
        const extracted = this.extractReviewsFromJSON(data);
        reviews.push(...extracted);
      } catch (e) {
        // No es JSON válido, continuar
      }
    }

    return reviews;
  }

  /**
   * Intentar extraer reseñas de formato Protocol Buffer
   * NOTA: Esto es muy complejo sin el schema. Esta es una aproximación básica.
   */
  extractReviewsFromProtobuf(text) {
    const reviews = [];

    // Buscar patrones comunes en respuestas de Google Maps
    // Ejemplo: buscar strings que parezcan nombres, seguidos de números (ratings)

    // Esta es una implementación muy básica y probablemente necesite ajustes
    // basándose en las respuestas reales capturadas

    // Por ahora, buscar strings que parezcan reviews usando regex
    const textPatterns = text.match(/"([^"]{20,500})"/g);

    if (textPatterns && textPatterns.length > 5) {
      console.log(`    Encontrados ${textPatterns.length} posibles textos en protobuf`);
      // Aquí necesitaríamos más lógica para reconstruir objetos de review
      // desde el formato protobuf sin schema
    }

    return reviews;
  }

  /**
   * Obtener reseñas parseadas
   */
  getParsedReviews() {
    return this.parsedReviews;
  }

  /**
   * Obtener errores
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Eliminar duplicados basándose en texto y autor
   */
  removeDuplicates() {
    const unique = [];
    const seen = new Set();

    for (const review of this.parsedReviews) {
      // Crear un ID único basado en autor + texto + calificación
      const key = `${review.autor || ''}_${review.texto || ''}_${review.calificacion || ''}`.substring(0, 100);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(review);
      }
    }

    const removedCount = this.parsedReviews.length - unique.length;
    if (removedCount > 0) {
      console.log(`🗑️  Eliminados ${removedCount} duplicados`);
    }

    this.parsedReviews = unique;
    return unique;
  }

  /**
   * Ordenar reseñas por fecha (más recientes primero)
   */
  sortByDate() {
    this.parsedReviews.sort((a, b) => {
      const timeA = a.timestamp_segundos || 0;
      const timeB = b.timestamp_segundos || 0;
      return timeB - timeA; // Descendente (más recientes primero)
    });

    console.log('🔄 Reseñas ordenadas por fecha (más recientes primero)');
    return this.parsedReviews;
  }
}

module.exports = GoogleMapsParser;
