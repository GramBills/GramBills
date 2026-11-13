import { describe, expect, it } from 'vitest';
import { buildUpiUri } from './upi';

describe('UPI URI', () => {
  it('builds an encoded UPI payment URI', () => {
    expect(
      buildUpiUri({
        pa: ' shop@okaxis ',
        pn: ' Shree Electronics ',
        am: 125.5,
        tn: 'Bill 123',
      }),
    ).toBe(
      'upi://pay?pa=shop%40okaxis&pn=Shree%20Electronics&am=125.50&cu=INR&tn=Bill%20123',
    );
  });

  it('omits blank notes and clamps negative amounts', () => {
    const uri = buildUpiUri({
      pa: 'shop@okaxis',
      pn: 'Shree Electronics',
      am: -5,
      tn: '   ',
    });
    expect(uri).toContain('am=0.00');
    expect(uri).not.toContain('tn=');
  });
});
