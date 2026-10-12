import { describe, expect, it } from 'vitest'
import { ApiError, toApiError } from '../apiError'

const problem = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ type: 'about:blank', status, ...body }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })

describe('toApiError', () => {
  it('keeps the status, detail and field errors', async () => {
    const errors = [{ pointer: '#/name', detail: 'must not be empty' }]
    const error = await toApiError(
      problem(400, { title: 'Bad Request', detail: '1 field is invalid', errors }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.detail).toBe('1 field is invalid')
    expect(error.fieldErrors).toEqual(errors)
    expect(error.message).toBe('Invalid location: name must not be empty')
  })

  it('tells a missing API key from a wrong one', async () => {
    const missing = await toApiError(
      problem(401, { detail: 'Missing bearer token' }, { 'WWW-Authenticate': 'Bearer' }),
    )
    const invalid = await toApiError(
      problem(
        401,
        { detail: 'Invalid bearer token' },
        { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
      ),
    )

    expect(missing.message).toBe('API key missing.')
    expect(invalid.message).toBe('Invalid API key.')
  })

  it('falls back to the status when the body is not problem JSON', async () => {
    const html = await toApiError(
      new Response('<h1>Bad Gateway</h1>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    const broken = await toApiError(
      new Response('{not json', {
        status: 500,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )

    expect(html.message).toBe('API request failed with status 502')
    expect(html.problem).toBeNull()
    expect(broken.message).toBe('API request failed with status 500')
  })
})
