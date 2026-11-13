import { mapError, ok, tryCatch } from '../api/errors';

describe('errors taxonomy', () => {
  it('maps network failures', () => {
    const error = new Error('Network request failed');
    const mapped = mapError(error);
    expect(mapped.class).toBe('network');
  });

  it('maps 401 to auth', () => {
    const mapped = mapError({ status: 401 });
    expect(mapped.class).toBe('auth');
  });

  it('maps 403 to forbidden', () => {
    const mapped = mapError({ status: 403 });
    expect(mapped.class).toBe('forbidden');
  });

  it('maps 404 to notFound', () => {
    const mapped = mapError({ status: 404 });
    expect(mapped.class).toBe('notFound');
  });

  it('maps 409 stale_write to conflict', () => {
    const mapped = mapError({ status: 409, data: { code: 'stale_write' } });
    expect(mapped.class).toBe('conflict');
  });

  it('maps 400 and 422 to validation', () => {
    expect(mapError({ status: 400 }).class).toBe('validation');
    expect(mapError({ status: 422 }).class).toBe('validation');
  });

  it('maps 429 and 5xx to transient', () => {
    expect(mapError({ status: 429 }).class).toBe('transient');
    expect(mapError({ status: 500 }).class).toBe('transient');
    expect(mapError({ status: 503 }).class).toBe('transient');
  });

  it('handles unknown errors gracefully', () => {
    expect(mapError('Something bad').class).toBe('unknown');
  });

  it('tryCatch utility works as expected', async () => {
    const success = await tryCatch(async () => 'hello');
    expect(success).toEqual(ok('hello'));

    const failure = await tryCatch(async () => {
      throw { status: 401 };
    });
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error.class).toBe('auth');
    }
  });
});
