const os = require('os');

const DEFAULT_RESOURCE_LIMITS = Object.freeze({
  pageSize: 250,
  lowMemoryPageSize: 100,
  memoryWarningMb: 1024,
  memoryCriticalMb: 512,
  maxRssMb: 192,
  catalogTtlMinutes: 30,
  maxCatalogs: 2
});

function readBoundedNumber(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function getResourceLimits() {
  return {
    pageSize: readBoundedNumber(
      'DEPARA_IMAGE_PAGE_SIZE',
      DEFAULT_RESOURCE_LIMITS.pageSize,
      1,
      DEFAULT_RESOURCE_LIMITS.pageSize
    ),
    lowMemoryPageSize: readBoundedNumber(
      'DEPARA_LOW_MEMORY_PAGE_SIZE',
      DEFAULT_RESOURCE_LIMITS.lowMemoryPageSize,
      1,
      DEFAULT_RESOURCE_LIMITS.pageSize
    ),
    memoryWarningMb: readBoundedNumber(
      'DEPARA_MEMORY_WARN_MB',
      DEFAULT_RESOURCE_LIMITS.memoryWarningMb,
      256,
      8192
    ),
    memoryCriticalMb: readBoundedNumber(
      'DEPARA_MEMORY_CRITICAL_MB',
      DEFAULT_RESOURCE_LIMITS.memoryCriticalMb,
      128,
      4096
    ),
    maxRssMb: readBoundedNumber(
      'DEPARA_MAX_RSS_MB',
      DEFAULT_RESOURCE_LIMITS.maxRssMb,
      64,
      1024
    ),
    catalogTtlMinutes: readBoundedNumber(
      'DEPARA_CATALOG_TTL_MINUTES',
      DEFAULT_RESOURCE_LIMITS.catalogTtlMinutes,
      5,
      240
    ),
    maxCatalogs: readBoundedNumber(
      'DEPARA_MAX_CATALOGS',
      DEFAULT_RESOURCE_LIMITS.maxCatalogs,
      1,
      4
    )
  };
}

function getResourceStatus() {
  const limits = getResourceLimits();
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const processMemory = process.memoryUsage();
  const warningBytes = limits.memoryWarningMb * 1024 * 1024;
  const criticalBytes = limits.memoryCriticalMb * 1024 * 1024;
  const maxRssBytes = limits.maxRssMb * 1024 * 1024;

  let state = 'normal';
  if (freeBytes <= criticalBytes || processMemory.rss >= maxRssBytes) {
    state = 'critical';
  } else if (freeBytes <= warningBytes) {
    state = 'warning';
  }

  return {
    state,
    canStartWork: state !== 'critical',
    totalBytes,
    freeBytes,
    freeMb: Math.round(freeBytes / 1024 / 1024),
    processRssBytes: processMemory.rss,
    processRssMb: Math.round(processMemory.rss / 1024 / 1024),
    recommendedPageSize: state === 'warning' ? limits.lowMemoryPageSize : limits.pageSize,
    limits: {
      pageSize: limits.pageSize,
      lowMemoryPageSize: limits.lowMemoryPageSize,
      memoryWarningMb: limits.memoryWarningMb,
      memoryCriticalMb: limits.memoryCriticalMb,
      maxRssMb: limits.maxRssMb,
      catalogTtlMinutes: limits.catalogTtlMinutes,
      maxCatalogs: limits.maxCatalogs
    }
  };
}

class ResourcePressureError extends Error {
  constructor(status) {
    super('Memória disponível insuficiente para iniciar uma nova indexação');
    this.name = 'ResourcePressureError';
    this.code = 'RESOURCE_CONSTRAINED';
    this.statusCode = 503;
    this.retryAfterSeconds = 15;
    this.status = status;
  }
}

function assertCanStartWork() {
  const status = getResourceStatus();
  if (!status.canStartWork) {
    throw new ResourcePressureError(status);
  }

  return status;
}

module.exports = {
  DEFAULT_RESOURCE_LIMITS,
  ResourcePressureError,
  assertCanStartWork,
  getResourceLimits,
  getResourceStatus
};
