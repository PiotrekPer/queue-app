import { describe, expect, it } from 'vitest';
import {
  CreateVisitInputSchema,
  GuestContactInputSchema,
  PhoneE164Schema,
  SettingsSchema,
} from './schemas';

describe('SettingsSchema (§4.1 defaults)', () => {
  it('fills every default from an empty object', () => {
    const s = SettingsSchema.parse({});
    expect(s.hold_minutes).toBe(7);
    expect(s.heads_up_position).toBe(2);
    expect(s.heads_up_eta_minutes).toBe(8);
    expect(s.retention_days).toBe(60);
    expect(s.quote_defaults).toEqual({ '1-2': 15, '3-4': 25, '5+': 40 });
    expect(s.quote_mode).toBe('auto');
    expect(s.channels).toEqual({ sms: true, email: false });
    expect(s.open_hours).toBeNull();
  });

  it('parses undefined via the top-level default', () => {
    expect(SettingsSchema.parse(undefined).hold_minutes).toBe(7);
  });

  it('rejects a retention outside the RODO slider range 30–90 (§9.3D)', () => {
    expect(() => SettingsSchema.parse({ retention_days: 10 })).toThrow();
    expect(SettingsSchema.parse({ retention_days: 90 }).retention_days).toBe(90);
  });
});

describe('CreateVisitInputSchema (the 5-second add §5 #1)', () => {
  it('accepts a minimal party and defaults type/source', () => {
    const v = CreateVisitInputSchema.parse({
      venue_id: '11111111-1111-1111-1111-111111111111',
      party_size: 4,
    });
    expect(v.type).toBe('walk_in');
    expect(v.quote_source).toBe('auto');
  });

  it('enforces the party_size CHECK (1..30)', () => {
    const venue_id = '11111111-1111-1111-1111-111111111111';
    expect(() => CreateVisitInputSchema.parse({ venue_id, party_size: 0 })).toThrow();
    expect(() => CreateVisitInputSchema.parse({ venue_id, party_size: 31 })).toThrow();
  });
});

describe('phone + contact (§8, §11)', () => {
  it('accepts +48 E.164 and rejects junk', () => {
    expect(PhoneE164Schema.parse('+48123456789')).toBe('+48123456789');
    expect(() => PhoneE164Schema.parse('123')).toThrow();
    expect(() => PhoneE164Schema.parse('48123456789')).toThrow();
  });

  it('marketing consent defaults to false (separate, unticked §11)', () => {
    const c = GuestContactInputSchema.parse({ token: 'abc', phone_e164: '+48123456789' });
    expect(c.marketing_consent).toBe(false);
  });
});
