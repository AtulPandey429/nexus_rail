import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken, TokenUser } from '../src/services/jwt.js';

describe('Suite: JWT HMAC-SHA256 Token Engine', () => {
  before(() => {
    process.env.JWT_SECRET = 'unit-test-jwt-secret-key-32-chars-long!';
  });

  const testUser: TokenUser = {
    id: 'user_test_uuid_123',
    email: 'trader@nexusrail.com',
    role: 'user',
  };

  test('Signs and successfully verifies a valid HMAC-SHA256 token', () => {
    const token = signToken(testUser);
    assert.ok(token && typeof token === 'string');
    assert.equal(token.split('.').length, 3, 'JWT must have exactly 3 parts');

    const decoded = verifyToken(token);
    assert.equal(decoded.id, testUser.id);
    assert.equal(decoded.email, testUser.email);
    assert.equal(decoded.role, testUser.role);
  });

  test('Strictly rejects malformed tokens without 3 parts', () => {
    assert.throws(
      () => verifyToken('invalid.token'),
      /Malformed token/
    );
  });

  test('Strictly rejects tokens with tampered signature', () => {
    const token = signToken(testUser);
    const parts = token.split('.');
    const forgedSignature = 'TAMPERED' + parts[2].slice(8);
    const forgedToken = `${parts[0]}.${parts[1]}.${forgedSignature}`;

    assert.throws(
      () => verifyToken(forgedToken),
      /Invalid token signature/
    );
  });
});
