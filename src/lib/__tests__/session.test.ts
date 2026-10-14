/// <reference types="jest" />
import * as SecureStore from 'expo-secure-store';
import { clearSession, createAuthFetch, getAccessToken, refresh, saveSession } from '../session';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'after_first_unlock_this_device_only',
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

jest.mock('expo-constants', () => ({ expoConfig: { extra: { apiUrl: 'http://api.test/api/v1' } } }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  await clearSession();
  jest.clearAllMocks();
});

describe('mobile session (ADR-004: body tokens, no cookies)', () => {
  it('keeps the refresh token in secure storage and the access token in memory', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1' });
    expect(getAccessToken()).toBe('a1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('kg.refreshToken', 'r1', expect.any(Object));
  });

  it('refreshes with the stored token, the mobile header and no CSRF', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1' });
    const fetchMock = jest.fn().mockResolvedValue(json(200, { accessToken: 'a2', refreshToken: 'r2' }));
    expect(await refresh(fetchMock)).toBe('a2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/auth/refresh');
    expect(init.headers['X-Client-Type']).toBe('mobile');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'r1' });
    expect(await SecureStore.getItemAsync('kg.refreshToken')).toBe('r2');
  });

  it('shares one refresh between concurrent callers', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1' });
    const fetchMock = jest.fn().mockResolvedValue(json(200, { accessToken: 'a2', refreshToken: 'r2' }));
    await Promise.all([refresh(fetchMock), refresh(fetchMock)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the session when the API rejects the refresh token', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1' });
    expect(await refresh(jest.fn().mockResolvedValue(json(401, { code: 'SESSION_REVOKED' })))).toBeNull();
    expect(await SecureStore.getItemAsync('kg.refreshToken')).toBeNull();
  });

  it('keeps the stored token on a network error', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1' });
    expect(await refresh(jest.fn().mockRejectedValue(new Error('offline')))).toBeNull();
    expect(await SecureStore.getItemAsync('kg.refreshToken')).toBe('r1');
  });

  it('retries once after TOKEN_EXPIRED with a fresh token', async () => {
    await saveSession({ accessToken: 'old', refreshToken: 'r1' });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(json(401, { code: 'TOKEN_EXPIRED' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'fresh', refreshToken: 'r2' }))
      .mockResolvedValueOnce(json(200, { id: 'u1' }));
    const res = await createAuthFetch(fetchMock)(new Request('http://api.test/api/v1/me'));
    expect(res.status).toBe(200);
    const retried = fetchMock.mock.calls[2][0] as Request;
    expect(retried.headers.get('Authorization')).toBe('Bearer fresh');
    expect(retried.headers.get('X-Client-Type')).toBe('mobile');
  });
});
