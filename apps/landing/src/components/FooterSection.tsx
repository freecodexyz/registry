import { HyperFooter } from './HyperFooter'

const socials = [
  { platform: 'x', href: 'https://x.com/freecodexyz', label: 'X' },
  { platform: 'github', href: 'https://github.com/freecodexyz/fcf', label: 'GitHub' },
  { platform: 'linkedin', href: '#', label: 'Linkedin' },
] as const

const footerLinks = [
  { label: 'Terms of Service', href: '#' },
  { label: 'Privacy Policy', href: '#' },
  { label: 'NFT Terms & License', href: '#' },
  { label: 'Contact', href: '#' },

]

export function FooterSection() {
  return (
    <HyperFooter
      wordmark="Free Code Fund"
      leadingLabel="2026"
      socials={socials}
      links={footerLinks}
    />
  )
}
