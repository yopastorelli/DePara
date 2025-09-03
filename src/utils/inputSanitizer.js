/**
 * Utilitário de Sanitização de Entrada para DePara
 * Funções para validar e limpar dados de entrada do usuário
 *
 * @author yopastorelli
 * @version 1.0.0
 */

const logger = require('./logger');

/**
 * Classe de erro para validação de entrada
 */
class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Sanitiza e valida strings
 */
const sanitizeString = (input, options = {}) => {
  const {
    maxLength = 1000,
    minLength = 0,
    allowedChars = null,
    trim = true,
    required = false
  } = options;

  // Verificar se é obrigatório
  if (required && (input === null || input === undefined || input === '')) {
    throw new ValidationError('Campo obrigatório não informado', options.field || 'unknown', input);
  }

  // Se não é obrigatório e está vazio, retornar vazio
  if (!required && (input === null || input === undefined || input === '')) {
    return '';
  }

  // Converter para string se necessário
  let str = String(input);

  // Aplicar trim se solicitado
  if (trim) {
    str = str.trim();
  }

  // Verificar tamanho mínimo
  if (str.length < minLength) {
    throw new ValidationError(`Campo deve ter pelo menos ${minLength} caracteres`, options.field || 'unknown', str);
  }

  // Verificar tamanho máximo
  if (str.length > maxLength) {
    throw new ValidationError(`Campo deve ter no máximo ${maxLength} caracteres`, options.field || 'unknown', str);
  }

  // Verificar caracteres permitidos
  if (allowedChars) {
    const regex = new RegExp(`^[${allowedChars}]+$`);
    if (!regex.test(str)) {
      throw new ValidationError(`Campo contém caracteres não permitidos. Apenas: ${allowedChars}`, options.field || 'unknown', str);
    }
  }

  // Sanitização básica contra XSS
  str = str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return str;
};

/**
 * Sanitiza e valida caminhos de arquivo
 */
const sanitizeFilePath = (path, options = {}) => {
  const {
    allowAbsolute = true,
    allowRelative = false,
    allowedExtensions = null,
    maxDepth = 10
  } = options;

  if (!path || typeof path !== 'string') {
    throw new ValidationError('Caminho inválido', 'path', path);
  }

  let sanitized = path.trim();

  // Verificar caracteres perigosos
  const dangerousChars = ['..', '~', '$', '|', ';', '&', '`'];
  for (const char of dangerousChars) {
    if (sanitized.includes(char)) {
      logger.warn('Tentativa de injeção detectada', { path: sanitized, char });
      throw new ValidationError(`Caminho contém caracteres não permitidos: ${char}`, 'path', sanitized);
    }
  }

  // Verificar se é caminho absoluto
  if (!allowAbsolute && path.startsWith('/')) {
    throw new ValidationError('Caminhos absolutos não são permitidos', 'path', path);
  }

  // Verificar se é caminho relativo
  if (!allowRelative && (path.startsWith('./') || path.startsWith('../'))) {
    throw new ValidationError('Caminhos relativos não são permitidos', 'path', path);
  }

  // Verificar profundidade de diretório
  const depth = (sanitized.match(/\//g) || []).length;
  if (depth > maxDepth) {
    throw new ValidationError(`Caminho muito profundo (máx: ${maxDepth} níveis)`, 'path', sanitized);
  }

  // Verificar extensão se especificado
  if (allowedExtensions && allowedExtensions.length > 0) {
    const extension = sanitized.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      throw new ValidationError(`Extensão não permitida. Permitidas: ${allowedExtensions.join(', ')}`, 'path', sanitized);
    }
  }

  return sanitized;
};

/**
 * Sanitiza e valida identificadores
 */
const sanitizeIdentifier = (id, options = {}) => {
  return sanitizeString(id, {
    maxLength: options.maxLength || 100,
    minLength: options.minLength || 1,
    allowedChars: 'a-zA-Z0-9_-',
    ...options
  });
};

/**
 * Sanitiza e valida números
 */
const sanitizeNumber = (input, options = {}) => {
  const {
    min = -Infinity,
    max = Infinity,
    integer = false,
    required = false
  } = options;

  // Verificar se é obrigatório
  if (required && (input === null || input === undefined || input === '')) {
    throw new ValidationError('Campo obrigatório não informado', options.field || 'unknown', input);
  }

  // Se não é obrigatório e está vazio, retornar null
  if (!required && (input === null || input === undefined || input === '')) {
    return null;
  }

  const num = Number(input);

  // Verificar se é um número válido
  if (isNaN(num)) {
    throw new ValidationError('Valor deve ser um número válido', options.field || 'unknown', input);
  }

  // Verificar se deve ser inteiro
  if (integer && !Number.isInteger(num)) {
    throw new ValidationError('Valor deve ser um número inteiro', options.field || 'unknown', input);
  }

  // Verificar limites
  if (num < min) {
    throw new ValidationError(`Valor deve ser maior ou igual a ${min}`, options.field || 'unknown', num);
  }

  if (num > max) {
    throw new ValidationError(`Valor deve ser menor ou igual a ${max}`, options.field || 'unknown', num);
  }

  return num;
};

/**
 * Sanitiza e valida arrays
 */
const sanitizeArray = (input, options = {}) => {
  const {
    maxLength = 100,
    itemSanitizer = sanitizeString,
    itemOptions = {},
    required = false
  } = options;

  // Verificar se é obrigatório
  if (required && (!Array.isArray(input) || input.length === 0)) {
    throw new ValidationError('Campo obrigatório não informado ou vazio', options.field || 'unknown', input);
  }

  // Se não é obrigatório e está vazio, retornar array vazio
  if (!required && (!Array.isArray(input) || input.length === 0)) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new ValidationError('Valor deve ser um array', options.field || 'unknown', input);
  }

  // Verificar tamanho máximo
  if (input.length > maxLength) {
    throw new ValidationError(`Array deve ter no máximo ${maxLength} itens`, options.field || 'unknown', input);
  }

  // Sanitizar cada item
  return input.map((item, index) => {
    try {
      return itemSanitizer(item, { ...itemOptions, field: `${options.field || 'unknown'}[${index}]` });
    } catch (error) {
      throw new ValidationError(`Item ${index}: ${error.message}`, options.field || 'unknown', item);
    }
  });
};

/**
 * Sanitiza e valida objetos
 */
const sanitizeObject = (input, schema, options = {}) => {
  const { required = false } = options;

  // Verificar se é obrigatório
  if (required && (!input || typeof input !== 'object')) {
    throw new ValidationError('Campo obrigatório não informado', options.field || 'unknown', input);
  }

  // Se não é obrigatório e está vazio, retornar objeto vazio
  if (!required && (!input || typeof input !== 'object')) {
    return {};
  }

  if (!input || typeof input !== 'object') {
    throw new ValidationError('Valor deve ser um objeto', options.field || 'unknown', input);
  }

  const sanitized = {};

  // Aplicar schema de validação
  for (const [key, validator] of Object.entries(schema)) {
    if (input.hasOwnProperty(key)) {
      try {
        sanitized[key] = validator(input[key], { field: key });
      } catch (error) {
        throw new ValidationError(`${key}: ${error.message}`, options.field || 'unknown', input[key]);
      }
    }
  }

  return sanitized;
};

module.exports = {
  sanitizeString,
  sanitizeFilePath,
  sanitizeIdentifier,
  sanitizeNumber,
  sanitizeArray,
  sanitizeObject,
  ValidationError
};
