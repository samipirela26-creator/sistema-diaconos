/**
 * Estandarizador de respuestas HTTP para toda la API (Metodología SSD)
 * Mantiene un contrato JSON estricto e inmutable:
 * Éxito: { ok: true, mensaje: string, data: any }
 * Error: { ok: false, error: string, detalles?: any }
 */

function ok(res, data = null, mensaje = 'Operación exitosa', statusCode = 200) {
  return res.status(statusCode).json({
    ok: true,
    mensaje,
    data
  });
}

function fallo(res, error = 'Ha ocurrido un error en la solicitud', statusCode = 400, detalles = null) {
  const respuesta = {
    ok: false,
    error: typeof error === 'string' ? error : (error.message || 'Error no especificado')
  };

  if (detalles) {
    respuesta.detalles = detalles;
  }

  return res.status(statusCode).json(respuesta);
}

module.exports = {
  ok,
  fallo
};
