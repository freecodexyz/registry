import { ButtonLink } from '@freecodexyz/ui'
import { PointCloud } from './PointCloud'
import { appUrl, docsUrl } from './navbarLinks'
import './FinalCtaSection.css'

export function FinalCtaSection() {
  return (
    <section className="final-cta" aria-labelledby="final-cta-heading">
      <PointCloud className="final-cta__point-cloud" shape="knot" density={0.9} />
      <div className="final-cta__content">
        <h3 className="final-cta__heading" id="final-cta-heading">
          Anyone can create, own, and control its own repos <span>RIK</span> through <span>$freecode</span>, our native protocol token.
        </h3>
        <p className="final-cta__subheading">Tokenize your repo today.</p>
        <div className="final-cta__actions" aria-label="Final call to action">
          <ButtonLink className="final-cta__button" href={appUrl}>Launch App</ButtonLink>
          <ButtonLink className="final-cta__button" href={docsUrl}>Open Docs</ButtonLink>
        </div>
      </div>
    </section>
  )
}
