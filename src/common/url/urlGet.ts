// TODO: использовать эти хэлперы везде где требуется брать параметры из URL

function normalizeParamName(name: string): string {
  return name.replace(/\W/g, '').toLowerCase()
}

// TODO: write doc comment
export function urlGetParams(
  urlOrParams?: null | string | URL | URLSearchParams,
): URLSearchParams {
  if (urlOrParams instanceof URL) {
    return urlOrParams.searchParams
  }
  if (urlOrParams instanceof URLSearchParams) {
    return urlOrParams
  }
  if (typeof urlOrParams === 'string') {
    return new URL(urlOrParams).searchParams
  }
  if (typeof window !== 'undefined') {
    return new URL(window.location.href).searchParams
  }
  return new URLSearchParams()
}

// TODO: write doc comment
export function urlParamToBoolean(
  paramValue: string | null | undefined,
): boolean | null {
  if (paramValue == null) {
    return null
  }
  paramValue = paramValue.toLowerCase().trim()
  return paramValue === 'true' || paramValue === '1' || paramValue === 'yes'
    ? true
    : paramValue === 'false' || paramValue === '0' || paramValue === 'no'
      ? false
      : null
}

// TODO: write doc comment
export function urlParamToInt(
  paramValue: string | null | undefined,
): number | null {
  if (paramValue == null) {
    return null
  }
  paramValue = paramValue.trim()
  const value = parseInt(paramValue, 10)
  return isNaN(value) ? null : value
}

// TODO: write doc comment
export function urlParamToFloat(
  paramValue: string | null | undefined,
): number | null {
  if (paramValue == null) {
    return null
  }
  paramValue = paramValue.trim()
  const value = parseFloat(paramValue)
  return isNaN(value) ? null : value
}

// TODO: write doc comment
export function urlGetString(
  paramName,
  urlOrParams?: null | string | URL | URLSearchParams,
) {
  const params = urlGetParams(urlOrParams)
  const normalizedParamName = normalizeParamName(paramName)

  for (const [key, value] of params.entries()) {
    if (normalizeParamName(key) === normalizedParamName) {
      return value
    }
  }

  return null
}

// TODO: write doc comment
export function urlGetBoolean(
  paramName,
  urlOrParams?: null | string | URL | URLSearchParams,
) {
  return urlParamToBoolean(urlGetString(paramName, urlOrParams))
}

// TODO: write doc comment
export function urlGetInt(
  paramName,
  urlOrParams?: null | string | URL | URLSearchParams,
) {
  return urlParamToInt(urlGetString(paramName, urlOrParams))
}

// TODO: write doc comment
export function urlGetFloat(
  paramName,
  urlOrParams?: null | string | URL | URLSearchParams,
) {
  return urlParamToFloat(urlGetString(paramName, urlOrParams))
}
