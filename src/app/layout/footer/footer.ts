import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFacebook,
  lucideGithub,
  lucideInstagram,
  lucideLinkedin,
  lucideShoppingBag,
  lucideTwitter,
} from '@ng-icons/lucide';

export interface SocialLinkItem {
  readonly name: string;
  readonly label: string;
  readonly icon: string;
  readonly href: string;
}

@Component({
  selector: 'app-footer',
  imports: [HlmButtonImports, NgIcon],
  providers: [
    provideIcons({
      lucideShoppingBag,
      lucideFacebook,
      lucideInstagram,
      lucideTwitter,
      lucideLinkedin,
      lucideGithub,
    }),
  ],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  public readonly currentYear = new Date().getFullYear();

  public readonly socialLinks: readonly SocialLinkItem[] = [
    { name: 'facebook', label: 'Facebook', icon: 'lucideFacebook', href: '' },
    { name: 'instagram', label: 'Instagram', icon: 'lucideInstagram', href: '' },
    { name: 'twitter', label: 'X (Twitter)', icon: 'lucideTwitter', href: '' },
    { name: 'linkedin', label: 'LinkedIn', icon: 'lucideLinkedin', href: '' },
    { name: 'github', label: 'GitHub', icon: 'lucideGithub', href: '' },
  ];
}
