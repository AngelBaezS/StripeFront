import { TestBed } from '@angular/core/testing';
import { Footer } from './footer';

describe('Footer', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
    }).compileComponents();
  });

  it('should render brand name, copyright year, and empty social links', () => {
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const footerEl = element.querySelector('footer');
    expect(footerEl?.classList.contains('bg-black')).toBe(true);
    expect(footerEl?.classList.contains('dark')).toBe(true);
    expect(element.textContent).toContain('StripeStore');
    expect(element.textContent).toContain(String(new Date().getFullYear()));

    const links = Array.from(element.querySelectorAll('nav[aria-label="Redes sociales"] a'));
    expect(links.length).toBe(5);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toBe('');
    });
  });
});
