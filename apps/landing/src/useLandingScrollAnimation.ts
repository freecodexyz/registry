import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useLandingScrollAnimation(rootRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const context = gsap.context(() => {
      const hero = root.querySelector<HTMLElement>('.hero')
      const heroText = root.querySelector<HTMLElement>('.hero-text')
      const heroNoise = root.querySelector<HTMLElement>('.hero__noise')
      const heroIntro = root.querySelectorAll<HTMLElement>('.hero-text__heading, .hero-text__subheading, .hero-text__actions')
      const protocol = root.querySelector<HTMLElement>('.protocol')
      const protocolHeading = root.querySelector<HTMLElement>('.protocol__heading')
      const protocolCards = root.querySelectorAll<HTMLElement>('.protocol-card')
      const protocolCardInners = root.querySelectorAll<HTMLElement>('.protocol-card__inner')
      const messaging = root.querySelector<HTMLElement>('.messaging')
      const messagingHeading = root.querySelector<HTMLElement>('.messaging__heading')
      const finalCta = root.querySelector<HTMLElement>('.final-cta')
      const finalCloud = root.querySelector<HTMLElement>('.final-cta__point-cloud')
      const finalContent = root.querySelectorAll<HTMLElement>('.final-cta__heading, .final-cta__subheading, .final-cta__actions')
      const footer = root.querySelector<HTMLElement>('.hyper-footer')
      const footerWordmark = root.querySelector<HTMLElement>('.hyper-footer__wordmark')

      if (heroIntro.length > 0) {
        gsap.from(heroIntro, {
          autoAlpha: 0,
          y: 28,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.09,
          delay: 0.08,
          clearProps: 'opacity,visibility,transform',
        })
      }

      if (hero && heroText) {
        gsap.to(heroText, {
          autoAlpha: 0,
          yPercent: -10,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: '58% top',
            end: 'bottom top',
            scrub: true,
          },
        })
      }

      if (hero && heroNoise) {
        gsap.to(heroNoise, {
          yPercent: 9,
          opacity: 0.72,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        })
      }

      if (protocol && protocolHeading) {
        gsap.fromTo(
          protocolHeading,
          { autoAlpha: 0, y: 42 },
          {
            autoAlpha: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: protocol,
              start: 'top 80%',
              end: 'top 48%',
              scrub: 0.45,
            },
          },
        )
      }

      if (protocol && protocolCards.length > 0 && protocolCardInners.length > 0) {
        const protocolCardsTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: protocolCards[0],
            start: 'top 84%',
            end: 'top 38%',
            scrub: 0.45,
          },
        })

        protocolCardsTimeline
          .fromTo(protocolCards, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', stagger: 0.08 }, 0)
          .fromTo(protocolCardInners, { y: 58 }, { y: 0, ease: 'none', stagger: 0.08 }, 0)
      }

      if (messaging && messagingHeading) {
        gsap.fromTo(
          messagingHeading,
          { autoAlpha: 0, y: 48, scale: 0.98 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: messaging,
              start: 'top 78%',
              end: 'top 42%',
              scrub: 0.45,
            },
          },
        )
      }

      if (finalCta && finalCloud) {
        gsap.to(finalCloud, {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: {
            trigger: finalCta,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      }

      if (finalCta && finalContent.length > 0) {
        gsap.fromTo(
          finalContent,
          { autoAlpha: 0, y: 42 },
          {
            autoAlpha: 1,
            y: 0,
            ease: 'none',
            stagger: 0.08,
            scrollTrigger: {
              trigger: finalCta,
              start: 'top 76%',
              end: 'top 42%',
              scrub: 0.45,
            },
          },
        )
      }

      if (footer && footerWordmark) {
        gsap.fromTo(
          footerWordmark,
          { autoAlpha: 0, yPercent: 20 },
          {
            autoAlpha: 1,
            yPercent: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: footer,
              start: 'top 88%',
              end: 'top 58%',
              scrub: 0.45,
            },
          },
        )
      }
    }, root)

    ScrollTrigger.refresh()

    return () => context.revert()
  }, [rootRef])
}
