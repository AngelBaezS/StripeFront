export type InvoiceStatus = 'PENDING_PAYMENT' | 'STAMPED' | 'FAILED';

export interface InvoiceRequestPayload {
  rfc: string;
  legalName: string;
  zipCode: string;
  taxRegime: string;
  cfdiUse: string;
  email: string;
}

export interface InvoiceSummary {
  id: string;
  orderId: string;
  status: InvoiceStatus;
  cfdiExpressId?: string | null;
  uuid?: string | null;
  rfc: string;
  legalName: string;
  zipCode: string;
  taxRegime: string;
  cfdiUse: string;
  email: string;
  formaPago?: string | null;
  hasPdf: boolean;
  hasXml: boolean;
  errorMessage?: string | null;
  issuedAt?: string | null;
  createdAt?: string | null;
  emailSent?: boolean | null;
}

export interface SatCatalogOption {
  code: string;
  label: string;
}

export const RFC_PATTERN = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
export const ZIP_CODE_PATTERN = /^[0-9]{5}$/;

export const REGIMEN_FISCAL_OPTIONS: SatCatalogOption[] = [
  { code: '601', label: '601 - General de Ley Personas Morales' },
  { code: '612', label: '612 - Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '626', label: '626 - Régimen Simplificado de Confianza (RESICO)' },
  { code: '605', label: '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', label: '606 - Arrendamiento' },
  { code: '616', label: '616 - Sin obligaciones fiscales' },
  { code: '621', label: '621 - Incorporación Fiscal' },
  { code: '625', label: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
];

export const USO_CFDI_OPTIONS: SatCatalogOption[] = [
  { code: 'G03', label: 'G03 - Gastos en general' },
  { code: 'G01', label: 'G01 - Adquisición de mercancías' },
  { code: 'I04', label: 'I04 - Equipo de cómputo y accesorios' },
  { code: 'S01', label: 'S01 - Sin efectos fiscales' },
  { code: 'D01', label: 'D01 - Honorarios médicos, dentales y gastos hospitalarios' },
];
