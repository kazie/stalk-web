// Error bodies from the API follow RFC 9457 (application/problem+json)
export interface FieldError {
  // JSON Pointer as a URI fragment, e.g. "#/latitude"
  pointer: string
  detail: string
}

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  // Only present on validation errors
  errors?: FieldError[]
}

export const ACCEPT_HEADER = 'application/json, application/problem+json'

const fieldName = (pointer: string): string => pointer.replace(/^#\//, '')

const isMissingToken = (problem: ProblemDetails | null, challenge: string | null): boolean =>
  challenge?.trim() === 'Bearer' || problem?.detail === 'Missing bearer token'

const describe = (
  status: number,
  problem: ProblemDetails | null,
  challenge: string | null,
): string => {
  if (status === 401)
    return isMissingToken(problem, challenge) ? 'API key missing.' : 'Invalid API key.'
  if (problem?.errors?.length) {
    const fields = problem.errors.map((e) => `${fieldName(e.pointer)} ${e.detail}`).join('; ')
    return `Invalid location: ${fields}`
  }
  return problem?.detail ?? `API request failed with status ${status}`
}

export class ApiError extends Error {
  readonly detail?: string
  readonly fieldErrors: FieldError[]

  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails | null = null,
    challenge: string | null = null,
  ) {
    super(describe(status, problem, challenge))
    this.name = 'ApiError'
    this.detail = problem?.detail
    this.fieldErrors = problem?.errors ?? []
  }
}

// Proxies and dev servers can answer with HTML or an empty body, so never let parsing throw
export const readProblem = async (response: Response): Promise<ProblemDetails | null> => {
  if (!response.headers?.get('content-type')?.includes('json')) return null
  try {
    const body: unknown = await response.json()
    return body && typeof body === 'object' && 'status' in body ? (body as ProblemDetails) : null
  } catch {
    return null
  }
}

export const toApiError = async (response: Response): Promise<ApiError> =>
  new ApiError(
    response.status,
    await readProblem(response),
    response.headers?.get('www-authenticate') ?? null,
  )
