import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from './ssrf.js';

describe('isPrivateAddress', () => {
  it('flags loopback, private, link-local and CGNAT blocks', () => {
    for (const ip of [
      '0.0.0.0',
      '10.1.2.3',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '100.64.0.1',
      '100.127.255.255',
      '::1',
      '::',
      'fe80::1',
      'fd00::1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('flags special-use / non-global IPv4 blocks', () => {
    for (const ip of [
      '198.18.0.1', // benchmark 198.18.0.0/15
      '198.19.255.255',
      '192.0.0.1', // IETF protocol assignments
      '192.0.2.1', // TEST-NET-1
      '198.51.100.1', // TEST-NET-2
      '203.0.113.1', // TEST-NET-3
      '224.0.0.1', // multicast
      '240.0.0.1', // reserved
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows ordinary public addresses', () => {
    for (const ip of [
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '172.32.0.1',
      '198.20.0.1',
      '203.0.114.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
