import { useId, type PropsWithChildren, type SVGProps } from 'react'
import logoUrl from '../../../web/src/assets/fcf-logo.svg'
import './HyperFooter.css'

export type SocialPlatform = 'x' | 'discord' | 'github' | 'telegram' | 'linkedin'

export type SocialLink = {
  platform: SocialPlatform;
  href: string;
  label?: string;
}

export type FooterLink = {
  label: string;
  href: string;
}

type HyperFooterProps = {
  wordmark: string;
  socials?: readonly SocialLink[];
  links?: readonly FooterLink[];
  leadingLabel?: string;
  className?: string;
}

type IconProps = SVGProps<SVGSVGElement>

function FooterLogoGlyph({ className }: { className?: string }) {
  return <img className={className} src={logoUrl} alt="" aria-hidden="true" />
}

function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

function DiscordIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.4 12.4 0 0 0-.618-1.25.077.077 0 0 0-.078-.037A19.7 19.7 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.056c2.053 1.508 4.041 2.423 5.993 3.029a.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 12.8 12.8 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.011c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.01c.12.099.246.198.373.292a.077.077 0 0 1-.007.128c-.598.342-1.22.644-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029c1.961-.607 3.95-1.522 6.002-3.03a.077.077 0 0 0 .031-.055c.5-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.175 1.095 2.157 2.419 0 1.333-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419s.955-2.419 2.157-2.419c1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419Z" />
    </svg>
  )
}

function GitHubIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.52 11.52 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z" />
    </svg>
  )
}

function TelegramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056Zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635Z" />
    </svg>
  )
}

function LinkedInIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
    </svg>
  )
}

const SOCIAL_ICONS = {
  x: XIcon,
  discord: DiscordIcon,
  github: GitHubIcon,
  telegram: TelegramIcon,
  linkedin: LinkedInIcon,
}

const SOCIAL_LABELS = {
  x: 'X',
  discord: 'Discord',
  github: 'GitHub',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
}

function footerTarget(href: string) {
  return href.startsWith('http') ? '_blank' : undefined
}

function FooterAnchor({ href, children }: PropsWithChildren<{ href: string }>) {
  return (
    <a className="hyper-footer__link" href={href} target={footerTarget(href)} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
      {children}
    </a>
  )
}

export function HyperFooter({ wordmark, socials = [], links = [], leadingLabel, className }: HyperFooterProps) {
  const reactId = useId()
  const mid = Math.ceil(links.length / 2)
  const leftLinks = links.slice(0, mid)
  const rightLinks = links.slice(mid)
  const footerClassName = className ? `hyper-footer ${className}` : 'hyper-footer'

  return (
    <footer className={footerClassName}>
      <div className="hyper-footer__top">
        <FooterLogoGlyph className="hyper-footer__corner-mark" />
        <div className="hyper-footer__wordmark">{wordmark}</div>
      </div>

      <div className="hyper-footer__bottom">
        {socials.length > 0 && (
          <nav className="hyper-footer__socials" aria-label="Social links">
            {socials.map((social, index) => {
              const Icon = SOCIAL_ICONS[social.platform]
              const label = social.label ?? SOCIAL_LABELS[social.platform]
              return (
                <a
                  key={`${reactId}-social-${index}`}
                  className="hyper-footer__social-link"
                  href={social.href}
                  aria-label={label}
                  target={footerTarget(social.href)}
                  rel={social.href.startsWith('http') ? 'noreferrer' : undefined}
                >
                  <Icon width={20} height={20} />
                </a>
              )
            })}
          </nav>
        )}

        <nav className="hyper-footer__links" aria-label="Footer links">
          <div className="hyper-footer__link-group hyper-footer__link-group--left">
            {leadingLabel && <span className="hyper-footer__leading">{leadingLabel}</span>}
            {leftLinks.map((link, index) => (
              <FooterAnchor key={`${reactId}-left-${index}`} href={link.href}>{link.label}</FooterAnchor>
            ))}
          </div>
          <FooterLogoGlyph className="hyper-footer__center-mark" />
          <div className="hyper-footer__link-group hyper-footer__link-group--right">
            {rightLinks.map((link, index) => (
              <FooterAnchor key={`${reactId}-right-${index}`} href={link.href}>{link.label}</FooterAnchor>
            ))}
          </div>
        </nav>
      </div>
    </footer>
  )
}
