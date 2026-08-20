/* ============================================================
   R3ADS · Sesión Cero — guion de los 8 módulos
   Transcrito de metodologia/sesion-cero.html (Documento 00, v1.0).
   Las secciones 01–07 del instrumento son FIJAS para todo cliente:
   si cambia el guion, se cambia acá y en el documento de metodología.
   ============================================================ */
window.R3Guion = {

  insumosPrevios: 'Lista de servicios con precios · últimos 3 meses de métricas de cada ' +
    'plataforma · el chat de WhatsApp sin editar de los últimos 10 clientes · cualquier hoja ' +
    'de cálculo que exista, aunque esté incompleta · fotos del lugar de trabajo. Lo que llega ' +
    'antes no se pregunta en sesión: la sesión se gasta en lo que no está escrito.',

  clases: {
    dato:     { texto: 'Dato',        ayuda: 'Verificable, con fuente y fecha.' },
    creencia: { texto: 'Creencia',    ayuda: 'Se afirma, se opera, nunca se midió. La clase más valiosa.' },
    ciego:    { texto: 'Punto ciego', ayuda: 'Nadie lo ha preguntado. Se detecta por ausencia.' }
  },

  modulos: [
    {
      id: 'M1', titulo: 'Línea de tiempo y decisiones fundacionales', duracion: '30 min',
      preguntas: [
        { q: 'Contame el negocio desde el primer trabajo que cobraste. ¿Qué fue, cuánto y a quién?' },
        { q: '¿Qué decisión tomaste que hoy no volverías a tomar igual?' },
        { q: '¿Cuál fue el mejor mes que has tenido y qué pasó ese mes?',
          why: 'Busca la causa real del pico, casi nunca es la que el dueño nombra primero.' },
        { q: '¿Qué hacías al principio que dejaste de hacer? ¿Por qué lo dejaste?' },
        { q: '¿Qué servicio ofreciste que no funcionó y tuviste que quitar?' }
      ],
      salida: 'El mapa de qué se probó y qué se descartó. Evita que el estudio recomiende algo que el cliente ya intentó.'
    },
    {
      id: 'M2', titulo: 'Catálogo y economía unitaria', duracion: '40 min',
      preguntas: [
        { q: 'Recorramos el catálogo ítem por ítem: ¿cuánto cobrás y cuánto te cuesta el repuesto o el insumo?' },
        { q: '¿Cuál de todos vendés más veces al mes? ¿Y cuál te deja más lempiras limpios?',
          why: 'Si no es el mismo ítem, ahí está el hallazgo del módulo.' },
        { q: '¿Hay algún precio que no hayas subido desde que abriste?' },
        { q: '¿Cuándo fue la última vez que alguien te dijo que estabas caro? ¿Y barato?' },
        { q: '¿Qué le vendés a un cliente que ya está adentro, además de lo que vino a buscar?' },
        { q: '¿Hay precios que dependen de algo? Mostrame la regla.',
          why: 'Los rangos tipo "500 / 1000" siempre esconden una regla no escrita.' }
      ],
      salida: 'Ticket promedio real, mix de ingreso, y la lista de ítems sin costo conocido. Es el módulo que más hallazgos produce.'
    },
    {
      id: 'M3', titulo: 'Capacidad y cuello de botella', duracion: '25 min',
      preguntas: [
        { q: 'Si mañana entran diez trabajos, ¿cuántos podés entregar esta semana sin cambiar nada?' },
        { q: '¿Qué parte del proceso solo la podés hacer vos?' },
        { q: 'La última vez que te enfermaste o viajaste, ¿qué pasó con el negocio?' },
        { q: '¿Cuánto tiempo al día se te va respondiendo mensajes en vez de trabajando?' },
        { q: '¿Cuál es el paso del proceso que más veces se atrasa? ¿Por qué?' }
      ],
      salida: 'El techo real de demanda. Define hasta dónde se puede acelerar la captación sin romper la promesa de servicio.'
    },
    {
      id: 'M4', titulo: 'Los últimos veinte clientes', duracion: '30 min',
      nota: 'Se llena el instrumento I-1 en vivo, con el historial de WhatsApp abierto. No se pregunta "¿de dónde te llegan los clientes?": se cuenta.',
      preguntas: [
        { q: 'Abrí WhatsApp y vamos hacia atrás: para cada uno, qué servicio, cuánto pagó y cómo te encontró.' },
        { q: '¿Este había venido antes? ¿Hace cuánto?' },
        { q: '¿Cuánto tardaste realmente en entregarle?' }
      ],
      salida: 'Ticket promedio, mix real de servicios, canal de origen medido y tasa de recompra.'
    },
    {
      id: 'M5', titulo: 'El recorrido real de una venta', duracion: '25 min',
      preguntas: [
        { q: 'Tomemos el último cliente que cerró. Leeme la conversación desde el primer mensaje.' },
        { q: '¿En qué mensaje decidió? ¿Qué le dijiste justo antes?' },
        { q: '¿Cuánto tiempo pasó entre el primer mensaje y el sí?' },
        { q: '¿Qué preguntó que no está respondido en ningún lado de tus redes?',
          why: 'Cada una de esas preguntas es una pieza de contenido con demanda comprobada.' },
        { q: '¿Cuántas veces al día escribís lo mismo?' }
      ],
      salida: 'El guion de venta que ya funciona, en las palabras del dueño. Materia prima del copy y de las respuestas rápidas.'
    },
    {
      id: 'M6', titulo: 'Las pérdidas', duracion: '25 min',
      preguntas: [
        { q: 'Mostrame tres conversaciones que no cerraron. ¿Dónde se cayeron?' },
        { q: '¿Cuál es la objeción que más escuchás? ¿Qué contestás?' },
        { q: '¿Qué te piden que no ofrecés?' },
        { q: '¿Alguna vez perdiste un cliente después de haberlo atendido? ¿Qué pasó?' },
        { q: '¿A quién le dirías que no?',
          why: 'Define el cliente que no se quiere, que es tan operativo como el que sí.' }
      ],
      salida: 'Las objeciones reales, textuales. Sostienen el pilar de contenido de confianza y las piezas de conversión.'
    },
    {
      id: 'M7', titulo: 'Activos y dependencias', duracion: '20 min',
      preguntas: [
        { q: 'Si mañana perdés la cuenta de Facebook o Instagram, ¿cómo contactás a tus clientes?' },
        { q: '¿Qué tenés guardado que nunca has publicado?',
          why: 'Casi siempre hay un banco de material terminado sin usar.' },
        { q: '¿Quién más tiene acceso a las cuentas? ¿A nombre de quién están?' },
        { q: '¿De qué proveedor dependés y qué pasa si desaparece?' },
        { q: '¿Existe algún registro escrito de tus clientes fuera del celular?' }
      ],
      salida: 'Inventario de activos propios vs. alquilados, y el mapa de riesgo de continuidad.'
    },
    {
      id: 'M8', titulo: 'Ambición y límites del dueño', duracion: '20 min',
      preguntas: [
        { q: '¿Cuánto querés facturar al mes dentro de un año? ¿Y por qué ese número?' },
        { q: '¿Cuántas horas estás dispuesto a trabajar para llegar ahí?' },
        { q: '¿Querés emplear gente o preferís seguir solo?' },
        { q: '¿Qué parte del trabajo te gusta tanto que no la delegarías aunque pudieras?' },
        { q: 'Si el negocio crece el triple, ¿qué es lo primero que se rompe?',
          why: 'El dueño casi siempre lo sabe y nunca lo ha dicho en voz alta.' }
      ],
      salida: 'El techo que el estudio no debe cruzar. Una estrategia que exige más capacidad de la que el dueño quiere dar es una estrategia fallida por diseño.'
    }
  ],

  foda: [
    { id: 'F', nombre: 'Fortalezas',    regla: 'Dato · interno · favorable' },
    { id: 'D', nombre: 'Debilidades',   regla: 'Dato · interno · desfavorable' },
    { id: 'O', nombre: 'Oportunidades', regla: 'Dato · externo · favorable' },
    { id: 'A', nombre: 'Amenazas',      regla: 'Dato · externo · desfavorable' }
  ],

  /* Controles de calidad (sección 06). Los cuatro primeros son
     verificables por la máquina; G5 y G6 los confirma la persona. */
  gates: [
    { id: 'G1', texto: 'Mínimo tres hallazgos que el dueño no pudiera haber escrito solo.', auto: true },
    { id: 'G2', texto: 'Ningún hallazgo sin campo de Tensión.', auto: true },
    { id: 'G3', texto: 'Al menos un hallazgo por módulo.', auto: true },
    { id: 'G4', texto: 'Toda creencia y todo punto ciego tienen método de verificación.', auto: true },
    { id: 'G5', texto: 'Los números tienen fecha.', auto: false },
    { id: 'G6', texto: 'Se revisó lo que el cliente ya tiene guardado antes de proponer producir algo nuevo.', auto: false }
  ]
};
