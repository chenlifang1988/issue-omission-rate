import * as XLSX from 'xlsx';

function looksBinary(buffer) {
  if (buffer.length < 2) return false;
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf;
  return isZip || isOle;
}

export function parseWorkbook(buffer) {
  const workbook = looksBinary(buffer)
    ? XLSX.read(buffer, { type: 'buffer', cellDates: true })
    : XLSX.read(buffer.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = matrix[0].map((value) => String(value).trim());
  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const row = {};
    let hasValue = false;
    headers.forEach((header, colIndex) => {
      if (!header) return;
      const cell = matrix[i][colIndex];
      row[header] = cell === undefined || cell === null ? '' : cell;
      if (String(cell).trim() !== '') hasValue = true;
    });
    if (hasValue) {
      row.__rowNumber = i + 1;
      rows.push(row);
    }
  }
  return { headers, rows };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function normalizeDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
    }
    return undefined;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) {
    return `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`;
  }
  const fallback = new Date(text);
  if (!Number.isNaN(fallback.getTime())) {
    return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}`;
  }
  return undefined;
}

function cellText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function validateRows(rows, mapping) {
  if (!mapping || !mapping.description) {
    const error = new Error('列映射不完整：必须映射问题描述列');
    error.status = 400;
    throw error;
  }

  const valid = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNumber = row.__rowNumber || index + 2;
    const description = cellText(row[mapping.description]);
    if (!description) {
      errors.push({ rowNumber, reason: '问题描述为空' });
      return;
    }
    let occurredDate = null;
    if (mapping.occurredDate) {
      const raw = cellText(row[mapping.occurredDate]);
      if (raw !== '') {
        occurredDate = normalizeDate(row[mapping.occurredDate]);
        if (!occurredDate) {
          errors.push({ rowNumber, reason: `发生日期无效：「${raw}」` });
          return;
        }
      }
    }
    valid.push({
      raw_description: description,
      raw_classification: mapping.classification
        ? cellText(row[mapping.classification]) || null
        : null,
      module: mapping.module ? cellText(row[mapping.module]) || null : null,
      occurred_date: occurredDate,
      __rowNumber: rowNumber,
    });
  });

  return { valid, errors };
}
