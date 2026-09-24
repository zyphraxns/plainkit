import { describe, expect, it } from 'vitest';

import {
  buildEmailPayload,
  buildLinkPayload,
  buildPhonePayload,
  buildSmsPayload,
  buildTextPayload,
  buildVCardPayload,
  buildWifiPayload,
} from './index';

const wifi = (over: Partial<Parameters<typeof buildWifiPayload>[0]> = {}) => ({
  ssid: 'Cafe',
  password: 'secret',
  encryption: 'wpa' as const,
  ...over,
});

const contact = (over: Partial<Parameters<typeof buildVCardPayload>[0]> = {}) => ({
  name: 'Ada Lovelace',
  phone: '',
  email: '',
  org: '',
  url: '',
  ...over,
});

describe('buildLinkPayload', () => {
  it('AC-004: adds https:// when the link has no scheme', () => {
    expect(buildLinkPayload('plainkit.app')).toBe('https://plainkit.app');
  });

  it('AC-004: leaves links that already carry http(s):// untouched', () => {
    expect(buildLinkPayload('http://a.com')).toBe('http://a.com');
    expect(buildLinkPayload('https://a.com/x?y=1')).toBe('https://a.com/x?y=1');
  });

  it('AC-004: leaves other schemes untouched', () => {
    expect(buildLinkPayload('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('AC-018: blank input yields no payload', () => {
    expect(buildLinkPayload('')).toBeNull();
    expect(buildLinkPayload('   ')).toBeNull();
  });
});

describe('buildTextPayload', () => {
  it('AC-005: keeps inner newlines', () => {
    expect(buildTextPayload('line one\nline two')).toBe('line one\nline two');
  });

  it('AC-020: passes Chinese and emoji through unchanged', () => {
    expect(buildTextPayload('你好，世界 🎉')).toBe('你好，世界 🎉');
  });

  it('AC-018: blank input yields no payload', () => {
    expect(buildTextPayload('')).toBeNull();
    expect(buildTextPayload('  \n ')).toBeNull();
  });
});

describe('buildWifiPayload', () => {
  it('AC-006: builds a WPA credential', () => {
    expect(buildWifiPayload(wifi({ ssid: 'Cafe', password: 'secret' }))).toBe(
      'WIFI:T:WPA;S:Cafe;P:secret;;',
    );
  });

  it('AC-006: open networks carry no password field', () => {
    expect(buildWifiPayload(wifi({ encryption: 'none', password: 'ignored' }))).toBe(
      'WIFI:T:nopass;S:Cafe;;',
    );
  });

  it('AC-006: WEP is spelled out as WEP', () => {
    expect(buildWifiPayload(wifi({ encryption: 'wep' }))).toBe('WIFI:T:WEP;S:Cafe;P:secret;;');
  });

  it('AC-021: escapes ; : , \\ and " so scanners read them literally', () => {
    expect(buildWifiPayload(wifi({ ssid: 'Cafe;1', password: 'a:b\\c,d"e' }))).toBe(
      'WIFI:T:WPA;S:Cafe\\;1;P:a\\:b\\\\c\\,d\\"e;;',
    );
  });

  it('AC-018: a blank network name yields no payload', () => {
    expect(buildWifiPayload(wifi({ ssid: '  ' }))).toBeNull();
  });
});

describe('buildVCardPayload', () => {
  it('AC-008: emits vCard 3.0 with only the fields that were filled in', () => {
    expect(buildVCardPayload(contact({ name: 'Ada', phone: '+49 30 1', email: 'a@b.com' }))).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nTEL:+49301\nEMAIL:a@b.com\nEND:VCARD',
    );
  });

  it('AC-022: escapes , ; and backslash so fields do not shift', () => {
    expect(buildVCardPayload(contact({ name: 'Lovelace, Ada; Jr\\' }))).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Lovelace\\, Ada\\; Jr\\\\\nEND:VCARD',
    );
  });

  it('AC-018: a blank name yields no payload', () => {
    expect(buildVCardPayload(contact({ name: ' ' }))).toBeNull();
  });
});

describe('buildEmailPayload', () => {
  it('AC-024: recipient only — no query string at all', () => {
    expect(buildEmailPayload({ to: 'a@b.com', subject: '', body: '' })).toBe('mailto:a@b.com');
  });

  it('AC-024: subject and body are percent-encoded', () => {
    expect(buildEmailPayload({ to: 'a@b.com', subject: 'Hi there', body: 'Yo\nthere' })).toBe(
      'mailto:a@b.com?subject=Hi%20there&body=Yo%0Athere',
    );
  });

  it('AC-018: a blank recipient yields no payload', () => {
    expect(buildEmailPayload({ to: '  ', subject: 'x', body: '' })).toBeNull();
  });
});

describe('buildPhonePayload', () => {
  it('AC-023: drops spaces but keeps + and -', () => {
    expect(buildPhonePayload('+49 30 123456')).toBe('tel:+4930123456');
    expect(buildPhonePayload('030-123')).toBe('tel:030-123');
  });

  it('AC-018: a blank number yields no payload', () => {
    expect(buildPhonePayload('   ')).toBeNull();
  });
});

describe('buildSmsPayload', () => {
  it('AC-011: builds sms: with a percent-encoded body', () => {
    expect(buildSmsPayload({ number: '+49 123', body: 'Hi there' })).toBe(
      'sms:+49123?body=Hi%20there',
    );
  });

  it('AC-018: a blank number yields no payload', () => {
    expect(buildSmsPayload({ number: '', body: 'Hi' })).toBeNull();
  });
});
