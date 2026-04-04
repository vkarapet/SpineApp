import { describe, it, expect } from 'vitest';
import { sha256, computeChecksum } from '../../../src/utils/crypto';

describe('crypto', () => {
  describe('sha256', () => {
    it('should produce a 64-char hex string', async () => {
      const hash = await sha256('hello');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic', async () => {
      const h1 = await sha256('test');
      const h2 = await sha256('test');
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different inputs', async () => {
      const h1 = await sha256('hello');
      const h2 = await sha256('world');
      expect(h1).not.toBe(h2);
    });
  });

  describe('computeChecksum', () => {
    it('should produce consistent checksum for same data', async () => {
      const data = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
      const c1 = await computeChecksum(data);
      const c2 = await computeChecksum(data);
      expect(c1).toBe(c2);
    });
  });
});
