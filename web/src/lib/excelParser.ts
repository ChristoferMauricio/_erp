import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Definición de Interfaces
export interface InsumoConsumo {
  name: string;
  cantidad: number;
  unidad: string;
}

export interface UbicacionParsed {
  nivel: string;
  zona: string;
  punto: string | null;
  texto_original: string;
}

export interface TareaParsed {
  id: string;
  ticket: string | null;
  tipo: 'Incidente' | 'Requerimiento';
  area: string;
  origen: 'IM' | 'SUP';
  ubicacion: UbicacionParsed;
  causa_raiz: string;
  cant_personas: number;
  tiempo_horas: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  periodo: string | null;
  detalle: string | null;
  trabajo_realizado: string | null;
  insumos: InsumoConsumo[];
}

// Normalizadores e inferencias de codificación (mismo comportamiento que ingest.py)
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

const CAUSE_TO_SUBSYSTEM: { [key: string]: string } = {
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
  if (!text) return { nivel: 'Interior Mina', zona: 'General', punto: null, texto_original: '' };
  
  const textClean = cleanTextEncoding(text).trim().replace(/\.+$/, '');
  const isSuperficie = textClean.toLowerCase().includes('superficie');
  
  let nivel = 'Interior Mina';
  let zona = 'General';
  let punto: string | null = null;
  
  // Buscar nivel NV.XXXX
  const levelMatch = textClean.match(/NV\.\s*\d+/i);
  if (levelMatch) {
    nivel = levelMatch[0].replace(/\s+/g, '').toUpperCase();
  } else if (isSuperficie) {
    nivel = 'Superficie';
  }
  
  // Remover nivel del texto
  let partsText = textClean;
  if (levelMatch) {
    partsText = partsText.replace(levelMatch[0], '');
  }
  if (isSuperficie) {
    partsText = partsText.replace(/,?\s*superficie/i, '').replace(/superficie,?\s*/i, '');
  }
  partsText = partsText.trim().replace(/^,|,$/g, '').trim();
  
  // Separar partes
  let parts: string[] = [];
  if (partsText.includes(',')) {
    parts = partsText.split(',').map(p => p.trim()).filter(Boolean);
  } else {
    parts = partsText.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
  }
  
  if (parts.length === 0) {
    zona = partsText || 'General';
  } else if (parts.length === 1) {
    zona = parts[0];
  } else {
    let pointCandidate: string | null = null;
    const zoneParts: string[] = [];
    
    for (const p of parts) {
      const isPoint = /^[P|V|T]-\d+$/i.test(p) || 
                      ['camara', 'refugio', 'anexo', 'tolva', 'gabinete'].some(k => p.toLowerCase().includes(k));
      if (isPoint) {
        pointCandidate = p;
      } else {
        zoneParts.push(p);
      }
    }
    
    if (zoneParts.length > 0) {
      zona = zoneParts.join(' - ');
    } else {
      zona = 'General';
    }
    
    if (pointCandidate) {
      punto = pointCandidate;
    } else {
      punto = parts[parts.length - 1];
      zona = parts.slice(0, parts.length - 1).join(' - ');
    }
  }
  
  return {
    nivel: nivel.replace(/\s+/g, ' ').trim(),
    zona: zona.replace(/\s+/g, ' ').trim(),
    punto: punto ? punto.replace(/\s+/g, ' ').trim() : null,
    texto_original: text
  };
}

export function inferSubsystem(cause: string | null | undefined): string {
  if (!cause) return 'DAT';
  const causeClean = cleanTextEncoding(cause).trim();
  const parentMatch = causeClean.match(/\(([A-Za-z\-]+)\)/);
  if (parentMatch) {
    const code = parentMatch[1].toUpperCase();
    if (code === 'WI-FI') return 'WIFI';
    return code;
  }
  if (causeClean in CAUSE_TO_SUBSYSTEM) {
    return CAUSE_TO_SUBSYSTEM[causeClean];
  }
  return 'DAT';
}

// Cargar y Parsear Excel local
let cachedData: { tareas: TareaParsed[], lastUpdated: number } | null = null;

export function getExcelData(): TareaParsed[] {
  // Caché para evitar re-parsear en cada request
  if (cachedData && (Date.now() - cachedData.lastUpdated) < 60000) {
    return cachedData.tareas;
  }

  // Buscar el archivo Excel en la raíz del proyecto
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
    console.error("No se encontró Yauricocha - CORONA.xlsx en las rutas buscadas:", possiblePaths);
    return [];
  }

  try {
    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON crudo (array de arrays o filas)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as any[];
    
    const tareas: TareaParsed[] = [];
    let currentTask: TareaParsed | null = null;
    
    for (let idx = 0; idx < rawData.length; idx++) {
      const row = rawData[idx];
      
      // Encontrar columna Ubicación dinámicamente
      const ubicKey = Object.keys(row).find(k => k.includes('Ubic')) || 'Ubicacion';
      
      const isParent = row['Cant. Person'] !== null || 
                       row['Tiempo'] !== null || 
                       row[ubicKey] !== null || 
                       row['Detalle'] !== null;
                       
      // Saltar vacíos
      if (row['INSUMO'] === null && row['CANTIDAD'] === null && !isParent) {
        continue;
      }
      
      if (isParent) {
        const u = parseUbicacion(row[ubicKey]);
        const causa = cleanTextEncoding(row['Causa Raiz'] || 'Mantenimiento Programado').trim();
        
        // Conversión de fechas
        let fechaInicioStr = '';
        if (row['Fecha inic.'] instanceof Date) {
          fechaInicioStr = row['Fecha inic.'].toISOString();
        } else if (row['Fecha inic.']) {
          fechaInicioStr = String(row['Fecha inic.']);
        }
        
        let fechaFinStr: string | null = null;
        if (row['Fecha Fin'] instanceof Date) {
          fechaFinStr = row['Fecha Fin'].toISOString();
        } else if (row['Fecha Fin']) {
          fechaFinStr = String(row['Fecha Fin']);
        }
        
        let periodoStr: string | null = null;
        if (row['Periodo'] instanceof Date) {
          periodoStr = row['Periodo'].toISOString().substring(0, 10);
        } else if (row['Periodo']) {
          periodoStr = String(row['Periodo']).substring(0, 10);
        }

        const taskType: 'Incidente' | 'Requerimiento' = 
          row['Tipo'] && String(row['Tipo']).toLowerCase().trim() === 'incidente' ? 'Incidente' : 'Requerimiento';
          
        currentTask = {
          id: `tarea-${idx}`,
          ticket: row['Ticket'] ? String(row['Ticket']) : null,
          tipo: taskType,
          area: row['Area'] ? cleanTextEncoding(String(row['Area'])).trim() : 'Infraestructura',
          origen: row['IM/SUP'] && String(row['IM/SUP']).toUpperCase().trim() === 'SUP' ? 'SUP' : 'IM',
          ubicacion: u,
          causa_raiz: causa,
          cant_personas: row['Cant. Person'] !== null ? Number(row['Cant. Person']) : 0,
          tiempo_horas: row['Tiempo'] !== null ? Number(row['Tiempo']) : 0,
          fecha_inicio: fechaInicioStr,
          fecha_fin: fechaFinStr,
          periodo: periodoStr,
          detalle: cleanTextEncoding(row['Detalle']),
          trabajo_realizado: cleanTextEncoding(row['Trabajo Realizado']),
          insumos: []
        };
        
        tareas.push(currentTask);
      }
      
      // Agregar insumo si existe
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
        
        if (currentTask) {
          currentTask.insumos.push({
            name: insNorm,
            cantidad: qty,
            unidad: unit
          });
        }
      }
    }
    
    cachedData = {
      tareas,
      lastUpdated: Date.now()
    };
    
    return tareas;
  } catch (error) {
    console.error("Error al procesar el archivo Excel en Next.js:", error);
    return [];
  }
}
