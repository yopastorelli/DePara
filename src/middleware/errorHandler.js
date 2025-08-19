/**
 * Middleware de Tratamento de Erros para DePara
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const logger = require('../utils/logger');

/**
 * Middleware de tratamento de erros
 */
const errorHandler = (error, req, res, next) => {
  const startTime = Date.now();
  
  // Log do erro
  logger.operationError('HTTP Request', error, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Determinar tipo de erro
  let statusCode = 500;
  let message = 'Erro interno do servidor';
  let details = null;

  // Erros de validação
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Erro de validação';
    details = error.details || error.message;
  }
  
  // Erros de sintaxe JSON
  else if (error instanceof SyntaxError && error.status === 400) {
    statusCode = 400;
    message = 'JSON inválido';
    details = error.message;
  }
  
  // Erros de autenticação
  else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Não autorizado';
    details = error.message;
  }
  
  // Erros de permissão
  else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Acesso negado';
    details = error.message;
  }
  
  // Erros de recurso não encontrado
  else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Recurso não encontrado';
    details = error.message;
  }
  
  // Erros de conflito
  else if (error.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflito de dados';
    details = error.message;
  }
  
  // Erros de limite de taxa
  else if (error.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Muitas requisições';
    details = error.message;
  }

  // Resposta de erro
  const errorResponse = {
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  };

  // Adicionar detalhes se disponíveis
  if (details) {
    errorResponse.error.details = details;
  }

  // Adicionar stack trace em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
  }

  // Log de performance
  const duration = Date.now() - startTime;
  logger.performance('Error Handling', duration, {
    statusCode,
    errorType: error.name,
    path: req.path
  });

  // Enviar resposta
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
