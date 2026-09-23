/* ================================================================
   catalogo-servicios.js — Catálogo base de servicios/precios del Portal
   Clínico (R3ads, multi-tenant).

   Origen: extraído programáticamente de Cotizador.html (ya removido junto
   con el resto de las páginas de autoservicio del paciente — Cotizador,
   Cotizacion-Sistema, Mis-Cotizaciones, Mi-Historial — porque el producto
   todavía no tiene clínicas reales de pago y el alcance del SaaS quedó
   definido como el portal de STAFF: Caja/Pacientes/Buscar/Pendientes
   dentro de Expediente-Doctor.html, no autoservicio de paciente).

   Sigue siendo la fuente de verdad que Admin-Precios.html y
   Expediente-Doctor.html usan para calcular `servicioKey`
   (`{cat}__{slug(nameEs)}`, con sufijo `--N` si el nombre se repite dentro
   de la misma categoría) — el mismo id que Admin-Precios.html escribe en
   Firestore (`clinics/{clinicId}/catalogoConfig/{servicioKey}`) y que
   `esServicioEnfermeria()` en firestore.rules lee para decidir si
   enfermería puede completar un servicio sin médico.

   `price` es el precio de catálogo (default) — cada clínica puede
   sobreescribirlo por ítem desde Admin-Precios.html; ese override vive en
   Firestore, nunca aquí. Este archivo es estático y se sube al repo junto
   con el resto del código, no por clínica.

   Cargar con <script src="catalogo-servicios.js"> ANTES del script inline
   que lo consume (define el global `window.R3ADS_CATALOGO`, sin fetch ni
   parseo de HTML).
   ================================================================ */
window.R3ADS_CATALOGO = [
  {
    "cat": "general",
    "catTitle": "Servicios generales",
    "items": [
      {
        "nameEs": "Consulta médica general",
        "nameEn": "General medical consult",
        "price": 0.0
      },
      {
        "nameEs": "Evaluación de salud (certificado laboral)",
        "nameEn": "Health certificate (employment)",
        "price": 0.0
      },
      {
        "nameEs": "Toma de presión",
        "nameEn": "Blood pressure",
        "price": 0.0
      },
      {
        "nameEs": "Glucometría",
        "nameEn": "Glucose test",
        "price": 0.0
      },
      {
        "nameEs": "Control de peso",
        "nameEn": "Weight check",
        "price": 0.0
      },
      {
        "nameEs": "Electrocardiograma",
        "nameEn": "Electrocardiogram",
        "price": 0.0
      },
      {
        "nameEs": "Nebulización (ciclo)",
        "nameEn": "Nebulization (cycle)",
        "price": 0.0
      },
      {
        "nameEs": "Inyección intramuscular (IM)",
        "nameEn": "Intramuscular injection (IM)",
        "price": 0.0
      },
      {
        "nameEs": "Inyección intravenosa (IV)",
        "nameEn": "Intravenous injection (IV)",
        "price": 0.0
      }
    ]
  },
  {
    "cat": "suero",
    "catTitle": "Sueroterapia IV",
    "items": [
      {
        "nameEs": "Sueroterapia Complejo B",
        "nameEn": "Complex B IV therapy",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Oxigenador Cerebral",
        "nameEn": "Brain Oxygenator IV therapy",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Vitamina C",
        "nameEn": "Vitamin C IV therapy",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Vitamina D",
        "nameEn": "Vitamin D IV therapy",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Hígado Detox",
        "nameEn": "Liver Detox IV therapy",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Boost (Complejo B + Oxigenador)",
        "nameEn": "Suero Boost (Complex B + Brain Oxygenator)",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Colágeno",
        "nameEn": "Collagen IV therapy",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Glutatión",
        "nameEn": "Glutathione IV therapy",
        "price": 0.0
      },
      {
        "nameEs": "Sueroterapia Ácido Ascórbico (Vit C)",
        "nameEn": "Ascorbic Acid (Vit C) IV therapy",
        "price": 0.0
      }
    ]
  },
  {
    "cat": "lab",
    "catTitle": "Laboratorio",
    "items": [
      {
        "nameEs": "Prueba de embarazo (rápida)",
        "nameEn": "Pregnancy test (rapid)",
        "price": 0.0
      },
      {
        "nameEs": "Prueba de dengue (rápida)",
        "nameEn": "Dengue test (rapid)",
        "price": 0.0
      },
      {
        "nameEs": "Prueba DUO (VIH 4ª gen.)",
        "nameEn": "DUO test (HIV 4th gen)",
        "price": 0.0
      },
      {
        "nameEs": "Prueba de sensibilidad",
        "nameEn": "Sensitivity test",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos VIH 1/2",
        "nameEn": "Anticuerpos VIH 1/2",
        "price": 0.0
      },
      {
        "nameEs": "Colesterol Total",
        "nameEn": "Colesterol Total",
        "price": 0.0
      },
      {
        "nameEs": "Examen De Orina",
        "nameEn": "Examen De Orina",
        "price": 0.0
      },
      {
        "nameEs": "General De Heces",
        "nameEn": "General De Heces",
        "price": 0.0
      },
      {
        "nameEs": "Glucosa Ayuno en sangre",
        "nameEn": "Glucosa Ayuno en sangre",
        "price": 0.0
      },
      {
        "nameEs": "Grupo Sanguineo",
        "nameEn": "Grupo Sanguineo",
        "price": 0.0
      },
      {
        "nameEs": "Hemoglobina Glicosilada",
        "nameEn": "Hemoglobina Glicosilada",
        "price": 0.0
      },
      {
        "nameEs": "Hemograma Completo",
        "nameEn": "Hemograma Completo",
        "price": 0.0
      },
      {
        "nameEs": "Proteina C Reactiva",
        "nameEn": "Proteina C Reactiva",
        "price": 0.0
      },
      {
        "nameEs": "Prueba Coombs Directo",
        "nameEn": "Prueba Coombs Directo",
        "price": 0.0
      },
      {
        "nameEs": "Prueba Indirecta De Coombs",
        "nameEn": "Prueba Indirecta De Coombs",
        "price": 0.0
      },
      {
        "nameEs": "RPR / VDRL",
        "nameEn": "RPR / VDRL",
        "price": 0.0
      },
      {
        "nameEs": "Sangre oculta en heces",
        "nameEn": "Sangre oculta en heces",
        "price": 0.0
      },
      {
        "nameEs": "Tiempo De Protrombina (TP)",
        "nameEn": "Tiempo De Protrombina (TP)",
        "price": 0.0
      },
      {
        "nameEs": "TSH (Hormona Estimulante de Tiroides)",
        "nameEn": "TSH (Hormona Estimulante de Tiroides)",
        "price": 0.0
      },
      {
        "nameEs": "Dimero D",
        "nameEn": "Dimero D",
        "price": 0.0
      },
      {
        "nameEs": "Eritrosedimentacion (VES)",
        "nameEn": "Eritrosedimentacion (VES)",
        "price": 0.0
      },
      {
        "nameEs": "Fibrinógeno",
        "nameEn": "Fibrinógeno",
        "price": 0.0
      },
      {
        "nameEs": "Frotis de Sangre Periferica (FSP)",
        "nameEn": "Frotis de Sangre Periferica (FSP)",
        "price": 0.0
      },
      {
        "nameEs": "Hematozoario",
        "nameEn": "Hematozoario",
        "price": 0.0
      },
      {
        "nameEs": "Tiempo De Trombina (TT)",
        "nameEn": "Tiempo De Trombina (TT)",
        "price": 0.0
      },
      {
        "nameEs": "Tiempo de Tromboplastina Parcial (TPT)",
        "nameEn": "Tiempo de Tromboplastina Parcial (TPT)",
        "price": 0.0
      },
      {
        "nameEs": "Ácido Fólico",
        "nameEn": "Ácido Fólico",
        "price": 0.0
      },
      {
        "nameEs": "Ácido Úrico serico",
        "nameEn": "Ácido Úrico serico",
        "price": 0.0
      },
      {
        "nameEs": "Albúmina",
        "nameEn": "Albúmina",
        "price": 0.0
      },
      {
        "nameEs": "Amilasa en suero",
        "nameEn": "Amilasa en suero",
        "price": 0.0
      },
      {
        "nameEs": "Amonio en sangre",
        "nameEn": "Amonio en sangre",
        "price": 0.0
      },
      {
        "nameEs": "Bilirrubinas",
        "nameEn": "Bilirrubinas",
        "price": 0.0
      },
      {
        "nameEs": "Calcio en sangre",
        "nameEn": "Calcio en sangre",
        "price": 0.0
      },
      {
        "nameEs": "Cloruro (Cl-) en sangre",
        "nameEn": "Cloruro (Cl-) en sangre",
        "price": 0.0
      },
      {
        "nameEs": "Colesterol Hdl",
        "nameEn": "Colesterol Hdl",
        "price": 0.0
      },
      {
        "nameEs": "Colesterol Ldl",
        "nameEn": "Colesterol Ldl",
        "price": 0.0
      },
      {
        "nameEs": "Colesterol VLDL",
        "nameEn": "Colesterol VLDL",
        "price": 0.0
      },
      {
        "nameEs": "Colinesterasa",
        "nameEn": "Colinesterasa",
        "price": 0.0
      },
      {
        "nameEs": "Creatina Quinasa Mb (Mb-Cpk)",
        "nameEn": "Creatina Quinasa Mb (Mb-Cpk)",
        "price": 0.0
      },
      {
        "nameEs": "Creatina Quinasa Total (CPK)",
        "nameEn": "Creatina Quinasa Total (CPK)",
        "price": 0.0
      },
      {
        "nameEs": "Creatinina en sangre",
        "nameEn": "Creatinina en sangre",
        "price": 0.0
      },
      {
        "nameEs": "Deshidrogenasa Acido Lactica (Ldh)",
        "nameEn": "Deshidrogenasa Acido Lactica (Ldh)",
        "price": 0.0
      },
      {
        "nameEs": "Fosfatasa Acida Total",
        "nameEn": "Fosfatasa Acida Total",
        "price": 0.0
      },
      {
        "nameEs": "Fosfatasa Alcalina",
        "nameEn": "Fosfatasa Alcalina",
        "price": 0.0
      },
      {
        "nameEs": "Fosforo (P+) en suero",
        "nameEn": "Fosforo (P+) en suero",
        "price": 0.0
      },
      {
        "nameEs": "Gamma Glutamil Traspeptidasa",
        "nameEn": "Gamma Glutamil Traspeptidasa",
        "price": 0.0
      },
      {
        "nameEs": "Glucosa 2HPP - 2 horas postprandial",
        "nameEn": "Glucosa 2HPP - 2 horas postprandial",
        "price": 0.0
      },
      {
        "nameEs": "Glucosa Tolerancia Oral (2h)",
        "nameEn": "Glucosa Tolerancia Oral (2h)",
        "price": 0.0
      },
      {
        "nameEs": "Glucosa Tolerancia Oral (3h)",
        "nameEn": "Glucosa Tolerancia Oral (3h)",
        "price": 0.0
      },
      {
        "nameEs": "Hierro",
        "nameEn": "Hierro",
        "price": 0.0
      },
      {
        "nameEs": "Lipasa",
        "nameEn": "Lipasa",
        "price": 0.0
      },
      {
        "nameEs": "Lipidos Totales",
        "nameEn": "Lipidos Totales",
        "price": 0.0
      },
      {
        "nameEs": "Magnesio en sangre",
        "nameEn": "Magnesio en sangre",
        "price": 0.0
      },
      {
        "nameEs": "Nitrógeno Ureico en la sangre (Bun)",
        "nameEn": "Nitrógeno Ureico en la sangre (Bun)",
        "price": 0.0
      },
      {
        "nameEs": "Potasio en sangre",
        "nameEn": "Potasio en sangre",
        "price": 0.0
      },
      {
        "nameEs": "Pro BNP",
        "nameEn": "Pro BNP",
        "price": 0.0
      },
      {
        "nameEs": "Procalcitonina",
        "nameEn": "Procalcitonina",
        "price": 0.0
      },
      {
        "nameEs": "Proteínas Totales & Relación A/G",
        "nameEn": "Proteínas Totales & Relación A/G",
        "price": 0.0
      },
      {
        "nameEs": "Sodio (NA+) en Suero",
        "nameEn": "Sodio (NA+) en Suero",
        "price": 0.0
      },
      {
        "nameEs": "Transaminasa Oxalacetica (TsGO)",
        "nameEn": "Transaminasa Oxalacetica (TsGO)",
        "price": 0.0
      },
      {
        "nameEs": "Transaminasa Piruvica (TsGP)",
        "nameEn": "Transaminasa Piruvica (TsGP)",
        "price": 0.0
      },
      {
        "nameEs": "Transferrina",
        "nameEn": "Transferrina",
        "price": 0.0
      },
      {
        "nameEs": "Trigliceridos",
        "nameEn": "Trigliceridos",
        "price": 0.0
      },
      {
        "nameEs": "Troponina I",
        "nameEn": "Troponina I",
        "price": 0.0
      },
      {
        "nameEs": "ACTH",
        "nameEn": "ACTH",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpo Chikungunya IgM",
        "nameEn": "Anticuerpo Chikungunya IgM",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Anti Cardiolipina(Igg)",
        "nameEn": "Anticuerpos Anti Cardiolipina(Igg)",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Anticardiolipinas IgM",
        "nameEn": "Anticuerpos Anticardiolipinas IgM",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Antiglobulina: Ig (Ra Test) - Factor Reumatoideo",
        "nameEn": "Anticuerpos Antiglobulina: Ig (Ra Test) - Factor Reumatoideo",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Antinucleares (ANA)",
        "nameEn": "Anticuerpos Antinucleares (ANA)",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Citomegalovirus IgG",
        "nameEn": "Anticuerpos Citomegalovirus IgG",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Citomegalovirus IgM",
        "nameEn": "Anticuerpos Citomegalovirus IgM",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Estreptolisina O (ASO)",
        "nameEn": "Anticuerpos Estreptolisina O (ASO)",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos H-Pylori (sangre)",
        "nameEn": "Anticuerpos H-Pylori (sangre)",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Hepatitis A",
        "nameEn": "Anticuerpos Hepatitis A",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Hepatitis B (Anti-Hbc)",
        "nameEn": "Anticuerpos Hepatitis B (Anti-Hbc)",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Hepatitis B (Anti-HBs)",
        "nameEn": "Anticuerpos Hepatitis B (Anti-HBs)",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Hepatitis C",
        "nameEn": "Anticuerpos Hepatitis C",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Herpes simple Tipo 1 IgG",
        "nameEn": "Anticuerpos Herpes simple Tipo 1 IgG",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Herpes simple Tipo 1 IgM",
        "nameEn": "Anticuerpos Herpes simple Tipo 1 IgM",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Herpes simple Tipo 2 IgG",
        "nameEn": "Anticuerpos Herpes simple Tipo 2 IgG",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Herpes simple Tipo 2 IgM",
        "nameEn": "Anticuerpos Herpes simple Tipo 2 IgM",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Mononucleosis (Monotest)",
        "nameEn": "Anticuerpos Mononucleosis (Monotest)",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Rubeola IgG",
        "nameEn": "Anticuerpos Rubeola IgG",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Rubeola IgM",
        "nameEn": "Anticuerpos Rubeola IgM",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Toxoplasma IgG",
        "nameEn": "Anticuerpos Toxoplasma IgG",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Toxoplasma IgM",
        "nameEn": "Anticuerpos Toxoplasma IgM",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Trypanosoma cruzi (Chagas)",
        "nameEn": "Anticuerpos Trypanosoma cruzi (Chagas)",
        "price": 0.0
      },
      {
        "nameEs": "Antigeno H. Pylori-Heces",
        "nameEn": "Antigeno H. Pylori-Heces",
        "price": 0.0
      },
      {
        "nameEs": "Antigeno Hepatitis B (Hbsag)",
        "nameEn": "Antigeno Hepatitis B (Hbsag)",
        "price": 0.0
      },
      {
        "nameEs": "Antigenos Febriles (Anticuerpos Salmonella)",
        "nameEn": "Antigenos Febriles (Anticuerpos Salmonella)",
        "price": 0.0
      },
      {
        "nameEs": "Complemento Sérico C3",
        "nameEn": "Complemento Sérico C3",
        "price": 0.0
      },
      {
        "nameEs": "Complemento Sérico C4",
        "nameEn": "Complemento Sérico C4",
        "price": 0.0
      },
      {
        "nameEs": "Inmunoglobulina A",
        "nameEn": "Inmunoglobulina A",
        "price": 0.0
      },
      {
        "nameEs": "Inmunoglobulina E (IgE)",
        "nameEn": "Inmunoglobulina E (IgE)",
        "price": 0.0
      },
      {
        "nameEs": "Inmunoglobulina G",
        "nameEn": "Inmunoglobulina G",
        "price": 0.0
      },
      {
        "nameEs": "Inmunoglobulina M",
        "nameEn": "Inmunoglobulina M",
        "price": 0.0
      },
      {
        "nameEs": "Panel Alimentos",
        "nameEn": "Panel Alimentos",
        "price": 0.0
      },
      {
        "nameEs": "Panel Inhalantes",
        "nameEn": "Panel Inhalantes",
        "price": 0.0
      },
      {
        "nameEs": "Anticuerpos Anti-peroxidasa (TPO)",
        "nameEn": "Anticuerpos Anti-peroxidasa (TPO)",
        "price": 0.0
      },
      {
        "nameEs": "Cortisol A.M.",
        "nameEn": "Cortisol A.M.",
        "price": 0.0
      },
      {
        "nameEs": "Cortisol P.M.",
        "nameEn": "Cortisol P.M.",
        "price": 0.0
      },
      {
        "nameEs": "Curva Tolerancia a la Insulina",
        "nameEn": "Curva Tolerancia a la Insulina",
        "price": 0.0
      },
      {
        "nameEs": "Estradiol",
        "nameEn": "Estradiol",
        "price": 0.0
      },
      {
        "nameEs": "Ferritina",
        "nameEn": "Ferritina",
        "price": 0.0
      },
      {
        "nameEs": "Fsh (Hormona Foliculo Estimulante)",
        "nameEn": "Fsh (Hormona Foliculo Estimulante)",
        "price": 0.0
      },
      {
        "nameEs": "Gonadotropina Coriónica Humana",
        "nameEn": "Gonadotropina Coriónica Humana",
        "price": 0.0
      },
      {
        "nameEs": "Hormona Gonadotropina Coriónica (Beta-HCG)",
        "nameEn": "Hormona Gonadotropina Coriónica (Beta-HCG)",
        "price": 0.0
      },
      {
        "nameEs": "Insulina",
        "nameEn": "Insulina",
        "price": 0.0
      },
      {
        "nameEs": "Insulina Post",
        "nameEn": "Insulina Post",
        "price": 0.0
      },
      {
        "nameEs": "Lh",
        "nameEn": "Lh",
        "price": 0.0
      },
      {
        "nameEs": "Paratohormona (Pth)",
        "nameEn": "Paratohormona (Pth)",
        "price": 0.0
      },
      {
        "nameEs": "Progesterona",
        "nameEn": "Progesterona",
        "price": 0.0
      },
      {
        "nameEs": "Prolactina",
        "nameEn": "Prolactina",
        "price": 0.0
      },
      {
        "nameEs": "T3 (Triyodotironina)",
        "nameEn": "T3 (Triyodotironina)",
        "price": 0.0
      },
      {
        "nameEs": "T3 Libre",
        "nameEn": "T3 Libre",
        "price": 0.0
      },
      {
        "nameEs": "T4 (Tiroxina)",
        "nameEn": "T4 (Tiroxina)",
        "price": 0.0
      },
      {
        "nameEs": "T4 Libre",
        "nameEn": "T4 Libre",
        "price": 0.0
      },
      {
        "nameEs": "Testosterona Libre",
        "nameEn": "Testosterona Libre",
        "price": 0.0
      },
      {
        "nameEs": "Testosterona Total",
        "nameEn": "Testosterona Total",
        "price": 0.0
      },
      {
        "nameEs": "Tiroglobulina",
        "nameEn": "Tiroglobulina",
        "price": 0.0
      },
      {
        "nameEs": "Vitamina B-12",
        "nameEn": "Vitamina B-12",
        "price": 0.0
      },
      {
        "nameEs": "Vitamina D",
        "nameEn": "Vitamina D",
        "price": 0.0
      },
      {
        "nameEs": "Alfa Fetoproteína (AFP)",
        "nameEn": "Alfa Fetoproteína (AFP)",
        "price": 0.0
      },
      {
        "nameEs": "Antígeno Prostático Especifico Total (PSA Total)",
        "nameEn": "Antígeno Prostático Especifico Total (PSA Total)",
        "price": 0.0
      },
      {
        "nameEs": "Antígeno Prostático Libre (PSA Libre)",
        "nameEn": "Antígeno Prostático Libre (PSA Libre)",
        "price": 0.0
      },
      {
        "nameEs": "Marcador Tumoral Ca 19-9",
        "nameEn": "Marcador Tumoral Ca 19-9",
        "price": 0.0
      },
      {
        "nameEs": "Marcador Tumoral Ca-125",
        "nameEn": "Marcador Tumoral Ca-125",
        "price": 0.0
      },
      {
        "nameEs": "Marcador Tumoral Ca-15-3",
        "nameEn": "Marcador Tumoral Ca-15-3",
        "price": 0.0
      },
      {
        "nameEs": "Marcador Tumoral Carcinoembrionario (Cea)",
        "nameEn": "Marcador Tumoral Carcinoembrionario (Cea)",
        "price": 0.0
      },
      {
        "nameEs": "Cocaina en orina COC",
        "nameEn": "Cocaina en orina COC",
        "price": 0.0
      },
      {
        "nameEs": "Coloración De Ziehl-Neelsen",
        "nameEn": "Coloración De Ziehl-Neelsen",
        "price": 0.0
      },
      {
        "nameEs": "Coloración Wright",
        "nameEn": "Coloración Wright",
        "price": 0.0
      },
      {
        "nameEs": "Coprocultivo",
        "nameEn": "Coprocultivo",
        "price": 0.0
      },
      {
        "nameEs": "Cultivo Por Bacterias",
        "nameEn": "Cultivo Por Bacterias",
        "price": 0.0
      },
      {
        "nameEs": "Hemocultivo",
        "nameEn": "Hemocultivo",
        "price": 0.0
      },
      {
        "nameEs": "Marihuana: tetrahidrocannabinol (THC)",
        "nameEn": "Marihuana: tetrahidrocannabinol (THC)",
        "price": 0.0
      },
      {
        "nameEs": "Microalbumina",
        "nameEn": "Microalbumina",
        "price": 0.0
      },
      {
        "nameEs": "Perfil Fehling & Ph En Heces",
        "nameEn": "Perfil Fehling & Ph En Heces",
        "price": 0.0
      },
      {
        "nameEs": "Proteínas Totales en Orina 24 horas",
        "nameEn": "Proteínas Totales en Orina 24 horas",
        "price": 0.0
      },
      {
        "nameEs": "Cociente/Relación Albúmina-Creatinina en Orina",
        "nameEn": "Cociente/Relación Albúmina-Creatinina en Orina",
        "price": 0.0
      },
      {
        "nameEs": "Urocultivo",
        "nameEn": "Urocultivo",
        "price": 0.0
      },
      {
        "nameEs": "Biopsia",
        "nameEn": "Biopsy",
        "price": 0.0
      }
    ]
  },
  {
    "cat": "oido",
    "catTitle": "Oído y ocular",
    "items": [
      {
        "nameEs": "Lavado de oído",
        "nameEn": "Ear cleaning",
        "price": 0.0
      },
      {
        "nameEs": "Lavado ocular",
        "nameEn": "Eye wash",
        "price": 0.0
      }
    ]
  },
  {
    "cat": "derma",
    "catTitle": "Cuidado de la piel",
    "items": [
      {
        "nameEs": "Cauterización lunar/verruga",
        "nameEn": "Mole/wart cauterization",
        "price": 0.0
      },
      {
        "nameEs": "Cauterización de lesión grande",
        "nameEn": "Large lesion cauterization",
        "price": 0.0
      },
      {
        "nameEs": "Cauterización en párpado",
        "nameEn": "Eyelid cauterization",
        "price": 0.0
      }
    ]
  },
  {
    "cat": "cirugia",
    "catTitle": "Cirugía menor y curaciones",
    "items": [
      {
        "nameEs": "Cirugía menor · pequeña",
        "nameEn": "Minor surgery · small",
        "price": 0.0
      },
      {
        "nameEs": "Cirugía menor · media",
        "nameEn": "Minor surgery · medium",
        "price": 0.0
      },
      {
        "nameEs": "Cirugía menor · grande",
        "nameEn": "Minor surgery · large",
        "price": 0.0
      },
      {
        "nameEs": "Curación pequeña",
        "nameEn": "Wound care · small",
        "price": 0.0
      },
      {
        "nameEs": "Curación mediana",
        "nameEn": "Wound care · medium",
        "price": 0.0
      },
      {
        "nameEs": "Curación grande",
        "nameEn": "Wound care · large",
        "price": 0.0
      },
      {
        "nameEs": "Retiro de puntos (cada uno)",
        "nameEn": "Stitches removal (each)",
        "price": 0.0
      },
      {
        "nameEs": "Extracción de uña",
        "nameEn": "Nail extraction",
        "price": 0.0
      }
    ]
  },
  {
    "cat": "gineco",
    "catTitle": "Cuidado de la mujer",
    "items": [
      {
        "nameEs": "Colocación de DIU",
        "nameEn": "IUD insertion",
        "price": 0.0
      },
      {
        "nameEs": "Retiro de DIU",
        "nameEn": "IUD removal",
        "price": 0.0
      },
      {
        "nameEs": "Colocación de implanon",
        "nameEn": "Implanon insertion",
        "price": 0.0
      },
      {
        "nameEs": "Extracción de implanon",
        "nameEn": "Implanon removal",
        "price": 0.0
      },
      {
        "nameEs": "Citología Convencional",
        "nameEn": "Conventional Cytology",
        "price": 0.0
      },
      {
        "nameEs": "Citología Base Líquida",
        "nameEn": "Liquid-Based Cytology",
        "price": 0.0
      }
    ]
  },
  {
    "cat": "sonda",
    "catTitle": "Cuidado de las vías urinarias",
    "items": [
      {
        "nameEs": "Colocación de sonda vesical",
        "nameEn": "Catheter insertion",
        "price": 0.0
      },
      {
        "nameEs": "Colocación de sonda + insumos",
        "nameEn": "Catheter + supplies",
        "price": 0.0
      },
      {
        "nameEs": "Retiro de sonda vesical",
        "nameEn": "Catheter removal",
        "price": 0.0
      }
    ]
  }
];
