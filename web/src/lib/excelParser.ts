import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Definicines de Entidades según TdR_Sistema_KPIs_Yauricocha.md (Sección 5)
export interface InsumoConsumo {
  name: string;
  sku: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  costo_total: number;
  esLineaSeparada: boolean;
}

export interface UbicacionParsed {
  nivel: string;
  piso: string;
  zona: string;
  nombre_normalizado: string;
  texto_original: string;
}

export interface TicketParsed {
  ticket_id: string;
  codigo_registro: string; // RESGISTROS
  fecha: string; // YYYY-MM-DD
  tipo_registro: 'Incidente' | 'Requerimiento';
  tipo_trabajo: 'IM' | 'SUP';
  cantidad_personal: number;
  duracion_horas: number;
  horas_hombre: number; // cant_personal * duracion_horas (KPI-07)
  descripcion_corta: string | null;
  trabajo_realizado: string | null;
  estado: 'Abierto' | 'Cerrado';
  unidad_minera: string; // UM Corona
  mina: string; // Yauricocha
  area: string; // Infraestructura
  ubicacion: UbicacionParsed;
  causa_raiz: string;
  sistema: 'DAT' | 'CCTV' | 'RAD' | 'TEL' | 'GEO' | 'FO' | 'WIFI';
  insumos: InsumoConsumo[];
}

// Compatibilidad con TareaParsed para evitar roturas
export type TareaParsed = TicketParsed;

// Precios de referencia y SKUs para cat_insumo (TdR 5.4 / KPI-10)
const INSUMO_SKU_PRICE_MAP: { [key: string]: { sku: string; price: number; category: string } } = {
  'Cable UTP': { sku: 'CAB-UTP-CAT6', price: 2.28, category: 'Cableado' },
  'Cintillos': { sku: 'ACC-CIN-100', price: 0.15, category: 'Accesorios' },
  'Cable Leaky Feeder': { sku: 'CAB-LEAKY-01', price: 8.50, category: 'Cableado' },
  'Cable Acometida': { sku: 'CAB-ACO-01', price: 3.20, category: 'Cableado' },
  'Conector RJ45': { sku: 'CON-RJ45-CAT6', price: 0.50, category: 'Conectores' },
  'Conector RJ11': { sku: 'CON-RJ11-01', price: 0.40, category: 'Conectores' },
  'Access Point': { sku: 'EQU-WIFI-AP', price: 250.00, category: 'Equipos' },
  'Conversor de Teléfono': { sku: 'EQU-TEL-CONV', price: 65.00, category: 'Equipos' },
  'Cámara Dahua': { sku: 'EQU-CCTV-CAM', price: 120.00, category: 'CCTV' },
  'Cámara Analógica': { sku: 'EQU-CCTV-ANA', price: 85.00, category: 'CCTV' },
  'Grabador DVR': { sku: 'EQU-CCTV-DVR', price: 320.00, category: 'CCTV' },
  'Grabador DVR 16 Ptos': { sku: 'EQU-CCTV-DVR16', price: 480.00, category: 'CCTV' },
  'Grabador DVR 8 Ptos': { sku: 'EQU-CCTV-DVR8', price: 350.00, category: 'CCTV' },
  'Disco Duro': { sku: 'EQU-CCTV-HDD', price: 110.00, category: 'Almacenamiento' },
  'Disco Duro 10TB': { sku: 'EQU-CCTV-HDD10', price: 290.00, category: 'Almacenamiento' },
  'Jack RJ45': { sku: 'CON-JACK-RJ45', price: 1.80, category: 'Conectores' },
  'Teléfono Analógico': { sku: 'EQU-TEL-ANA', price: 45.00, category: 'Equipos' },
  'Tubo Corrugado': { SKU: 'TUB-COR-01', price: 1.80, category: 'Canalización' } as any,
  'Cinta Aislante': { sku: 'ACC-CIN-AIS', price: 3.00, category: 'Accesorios' },
  'Trapo Industrial': { sku: 'ACC-TRAPO', price: 1.20, category: 'Limpieza' },
  'Pantalla TV': { sku: 'EQU-DISP-TV', price: 350.00, category: 'Equipos' }
};

const INSUMO_CLEAN_MAP: { [key: string]: string } = {
  'cintillos': 'Cintillos',
  'cintillo': 'Cintillos',
  'cinta aislante': 'Cinta Aislante',
  'Cinta aislante': 'Cinta Aislante',
  'Cable Leaky Feeder': 'Cable Leaky Feeder',
  'Cable Leaky feeder': 'Cable Leaky Feeder',
  'Cable leaky feeder': 'Cable Leaky Feeder',
  'Cable leaky feeder ': 'Cable Leaky Feeder',
  'Cable Acometida': 'Cable Acometida',
  'Cable acometida': 'Cable Acometida',
  'RJ 45': 'Conector RJ45',
  'RJ45': 'Conector RJ45',
  'Rj 45': 'Conector RJ45',
  'Rj45': 'Conector RJ45',
  'RJ11': 'Conector RJ11',
  'Rj11': 'Conector RJ11',
  'Access Point': 'Access Point',
  'AP': 'Access Point',
  'Conversor de teléfono': 'Conversor de Teléfono',
  'Convertidor de telefono': 'Conversor de Teléfono',
  'Cámara ': 'Cámara Dahua',
  'Cámara Dahua': 'Cámara Dahua',
  'Cámara IP': 'Cámara Dahua',
  'Cámara analogica': 'Cámara Analógica',
  'DVR': 'Grabador DVR',
  'DVR de 16 puertos.': 'Grabador DVR 16 Ptos',
  'DVR de 8 puertos.': 'Grabador DVR 8 Ptos',
  'Disco duro': 'Disco Duro',
  'Disco duro ': 'Disco Duro',
  'Disco duro de 10TB': 'Disco Duro 10TB',
  'Jack': 'Jack RJ45',
  'JACK': 'Jack RJ45',
  'Teléfono Analógico': 'Teléfono Analógico',
  'Teléfono analógico': 'Teléfono Analógico',
  'Tubo corrugado': 'Tubo Corrugado',
  'Tuberia corrugada ': 'Tubo Corrugado',
  'cable UTP': 'Cable UTP',
  'Cable UTP': 'Cable UTP',
  'Trapo industrial': 'Trapo Industrial',
  'Pantalla TV': 'Pantalla TV',
  'Pantalla TV ': 'Pantalla TV'
};

const CAUSE_TO_SUBSYSTEM: { [key: string]: 'DAT' | 'CCTV' | 'RAD' | 'TEL' | 'GEO' | 'FO' | 'WIFI' } = {
  'Balun Averiado': 'CCTV',
  'Cámara Averiado': 'CCTV',
  'Teléfono Averiado': 'TEL',
  'Teléfono averiado': 'TEL',
  'Mantenimiento  Correctivo Switch.': 'DAT',
  'Switch apagado por mónoxido': 'DAT',
  'Equipo Averiado': 'DAT',
  'Fuente averiada': 'DAT',
  'Fuente de radio': 'RAD',
  'Fuente de radio de 12V': 'RAD',
  'Fuente de radio de 24V DC': 'RAD',
  'Poste roto por colición de volquete': 'RAD',
  'Termino de explotación': 'DAT',
  'REQUERIMIENTO': 'DAT',
  'Mantenimiento Programado': 'DAT',
  'AP inoperativo': 'WIFI',
  'Acumulación Monóxido': 'DAT',
  'Falla General del Sistemas Eléctrico': 'DAT',
};

function cleanTextEncoding(text: string | null | undefined): string {
  if (!text) return '';
  const replacements: { [key: string]: string } = {
    'Ubicacin': 'Ubicación',
    'Telfono': 'Teléfono',
    'analgico': 'analógico',
    'Analgico': 'Analógico',
    'Cmara': 'Cámara',
    'cmara': 'cámara',
    'unin': 'unión',
    'Unin': 'Unión',
    'derivacin': 'derivación',
    'Derivacin': 'Derivación',
    'elctrico': 'eléctrico',
    'Elctrico': 'Eléctrico',
    'mnoxido': 'monóxido',
    'Mnoxido': 'monóxido',
    'instalacin': 'instalación',
    'Instalacin': 'Instalación',
    'tubera': 'tubería',
    'Tubera': 'Tubería',
    'polucin': 'polución',
    'colicin': 'colisión',
    'explotacin': 'explotación',
    'gabinete pequeo': 'gabinete pequeño',
    'pequeo': 'pequeño',
    'fibra ptica': 'fibra óptica',
    'ptica': 'óptica'
  };
  let cleaned = text;
  for (const [bad, good] of Object.entries(replacements)) {
    cleaned = cleaned.replaceAll(bad, good);
  }
  return cleaned;
}

export function parseUbicacion(text: string | null | undefined): UbicacionParsed {
  if (!text) return { nivel: 'NV 1170', piso: 'P-1', zona: 'General', nombre_normalizado: 'NV 1170 P-1 General', texto_original: '' };
  
  const textClean = cleanTextEncoding(text).trim().replace(/\.+$/, '');
  const isSuperficie = textClean.toLowerCase().includes('superficie');
  
  let nivel = 'NV 1170';
  let piso = 'P-1';
  let zona = 'General';
  
  const levelMatch = textClean.match(/NV\.\s*\d+|NV\s*\d+/i);
  if (levelMatch) {
    nivel = levelMatch[0].replace(/\./g, '').replace(/\s+/g, ' ').toUpperCase();
  } else if (isSuperficie) {
    nivel = 'Superficie';
  }
  
  const pisoMatch = textClean.match(/P-\d+|PISO\s*\d+/i);
  if (pisoMatch) {
    piso = pisoMatch[0].replace(/\s+/g, '').toUpperCase();
  }

  let partsText = textClean;
  if (levelMatch) partsText = partsText.replace(levelMatch[0], '');
  if (pisoMatch) partsText = partsText.replace(pisoMatch[0], '');
  if (isSuperficie) partsText = partsText.replace(/,?\s*superficie/i, '').replace(/superficie,?\s*/i, '');
  partsText = partsText.trim().replace(/^,|,$/g, '').trim();
  
  if (partsText) {
    zona = partsText.replace(/\s+/g, ' ');
  }
  
  const nombre_normalizado = `${nivel} ${piso} ${zona}`.trim();
  
  return {
    nivel,
    piso,
    zona,
    nombre_normalizado,
    texto_original: text
  };
}

export function inferSubsystem(cause: string | null | undefined): 'DAT' | 'CCTV' | 'RAD' | 'TEL' | 'GEO' | 'FO' | 'WIFI' {
  if (!cause) return 'DAT';
  const causeClean = cleanTextEncoding(cause).trim();
  const parentMatch = causeClean.match(/\(([A-Za-z\-]+)\)/);
  if (parentMatch) {
    const code = parentMatch[1].toUpperCase();
    if (code === 'WI-FI' || code === 'WIFI') return 'WIFI';
    if (['DAT', 'CCTV', 'RAD', 'TEL', 'GEO', 'FO', 'WIFI'].includes(code)) {
      return code as 'DAT' | 'CCTV' | 'RAD' | 'TEL' | 'GEO' | 'FO' | 'WIFI';
    }
  }
  if (causeClean in CAUSE_TO_SUBSYSTEM) {
    return CAUSE_TO_SUBSYSTEM[causeClean];
  }
  return 'DAT';
}

let cachedTickets: { tickets: TicketParsed[], lastUpdated: number } | null = null;

export function getExcelData(): TicketParsed[] {
  if (cachedTickets && (Date.now() - cachedTickets.lastUpdated) < 60000) {
    return cachedTickets.tickets;
  }

  const possiblePaths = [
    path.join(process.cwd(), '..', 'Yauricocha - CORONA.xlsx'),
    path.join(process.cwd(), 'Yauricocha - CORONA.xlsx'),
    path.join(process.cwd(), 'public', 'Yauricocha - CORONA.xlsx')
  ];

  let excelPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      excelPath = p;
      break;
    }
  }

  if (!excelPath) {
    const jsonPath = path.join(process.cwd(), 'src', 'lib', 'seed_tasks.json');
    const jsonAltPath = path.join(process.cwd(), '..', 'web', 'src', 'lib', 'seed_tasks.json');
    const targetJson = fs.existsSync(jsonPath) ? jsonPath : (fs.existsSync(jsonAltPath) ? jsonAltPath : '');
    if (targetJson) {
      try {
        const rawJson = fs.readFileSync(targetJson, 'utf-8');
        const tickets = JSON.parse(rawJson) as TicketParsed[];
        cachedTickets = { tickets, lastUpdated: Date.now() };
        return tickets;
      } catch (e) {
        console.error("Error al leer JSON de respaldo:", e);
      }
    }
    console.error("No se encontró Yauricocha - CORONA.xlsx ni seed_tasks.json en las rutas buscadas");
    return [];
  }

  try {
    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as any[];
    const tickets: TicketParsed[] = [];
    let currentTicket: TicketParsed | null = null;
    
    for (let idx = 0; idx < rawData.length; idx++) {
      const row = rawData[idx];
      const ubicKey = Object.keys(row).find(k => k.includes('Ubic')) || 'Ubicacion';
      
      const isParent = row['Cant. Person'] !== null ||
                       row['Tiempo'] !== null ||
                       row[ubicKey] !== null ||
                       row['Causa Raiz'] !== null ||
                       row['Tipo'] !== null ||
                       row['Detalle'] !== null;
                        
      if (row['INSUMO'] === null && row['CANTIDAD'] === null && !isParent) {
        continue;
      }
      
      if (isParent) {
        const u = parseUbicacion(row[ubicKey]);
        const causa = cleanTextEncoding(row['Causa Raiz'] || 'Mantenimiento Programado').trim();
        const sistemaCode = inferSubsystem(causa);
        
        let fechaStr = '2025-06-26';
        if (row['Fecha inic.'] instanceof Date) {
          fechaStr = row['Fecha inic.'].toISOString().substring(0, 10);
        } else if (row['Fecha inic.']) {
          fechaStr = String(row['Fecha inic.']).substring(0, 10);
        }
        
        const taskType: 'Incidente' | 'Requerimiento' = 
          row['Tipo'] && String(row['Tipo']).toLowerCase().trim() === 'incidente' ? 'Incidente' : 'Requerimiento';
          
        const cantPersonas = row['Cant. Person'] !== null ? Number(row['Cant. Person']) : 1;
        const duracionHoras = row['Tiempo'] !== null ? Number(row['Tiempo']) : 1.0;
        
        currentTicket = {
          ticket_id: `ticket-${idx + 1}`,
          codigo_registro: row['RESGISTROS'] ? String(row['RESGISTROS']) : (row['Ticket'] ? String(row['Ticket']) : `Registro ${idx + 1}`),
          fecha: fechaStr,
          tipo_registro: taskType,
          tipo_trabajo: row['IM/SUP'] && String(row['IM/SUP']).toUpperCase().trim() === 'SUP' ? 'SUP' : 'IM',
          cantidad_personal: cantPersonas,
          duracion_horas: duracionHoras,
          horas_hombre: cantPersonas * duracionHoras,
          descripcion_corta: cleanTextEncoding(row['Detalle']),
          trabajo_realizado: cleanTextEncoding(row['Trabajo Realizado']),
          estado: 'Cerrado',
          unidad_minera: row['U.M.'] ? String(row['U.M.']) : 'UM Corona',
          mina: row['Mina'] ? String(row['Mina']) : 'Yauricocha',
          area: row['Area'] ? cleanTextEncoding(String(row['Area'])).trim() : 'Infraestructura',
          ubicacion: u,
          causa_raiz: causa,
          sistema: sistemaCode,
          insumos: []
        };
        
        tickets.push(currentTicket);
      }
      
      if (row['INSUMO'] !== null && String(row['INSUMO']).trim() !== '') {
        const insName = cleanTextEncoding(String(row['INSUMO'])).trim();
        const insNorm = INSUMO_CLEAN_MAP[insName] || insName;
        
        let qty = 1.0;
        if (row['CANTIDAD'] !== null) {
          const qtyStr = String(row['CANTIDAD']).replace(/\s+/g, '').replace(/O/i, '0');
          const parsedQty = parseFloat(qtyStr);
          if (!isNaN(parsedQty) && parsedQty > 0) {
            qty = parsedQty;
          }
        }
        
        const unitRaw = String(row['Unidad'] || 'UN').trim().toUpperCase();
        let unit = 'UN';
        if (['M', 'METROS', 'METRO', 'METRO LINEAL'].includes(unitRaw)) {
          unit = 'M';
        } else if (['LT', 'LITROS', 'LITRO'].includes(unitRaw)) {
          unit = 'LT';
        }
        
        const insMeta = INSUMO_SKU_PRICE_MAP[insNorm] || { sku: 'GEN-SKU-001', price: 5.00, category: 'General' };
        
        if (currentTicket) {
          currentTicket.insumos.push({
            name: insNorm,
            sku: insMeta.sku,
            cantidad: qty,
            unidad: unit,
            precio_unitario: insMeta.price,
            costo_total: Math.round(qty * insMeta.price * 100) / 100,
            esLineaSeparada: !isParent
          });
        }
      }
    }
    
    cachedTickets = {
      tickets,
      lastUpdated: Date.now()
    };
    
    return tickets;
  } catch (error) {
    console.error("Error al procesar el archivo Excel en Next.js:", error);
    return [];
  }
}
