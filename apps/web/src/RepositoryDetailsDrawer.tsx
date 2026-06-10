import { useEffect } from 'react'
import githubLogoUrl from './assets/GitHub_Invertocat_Black.svg'
import { Button, ButtonLink } from './components/ui'
import { chainLabel, explorerAddressUrl, explorerBlockUrl, explorerTxUrl } from './explorers'
import type { Repo } from './repositoryTypes'

const FULL_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' })

function repoNameParts(repo: Repo) {
  if (repo.github !== 'not found') {
    const [owner, ...name] = repo.github.fullName.split('/')
    return { owner, name: name.join('/') || repo.repoId, fullName: repo.github.fullName }
  }

  return {
    owner: repo.githubOwnerUsername === 'not found' ? 'unknown' : repo.githubOwnerUsername,
    name: repo.repoId,
    fullName: repo.repoId,
  }
}

function fullDate(timestamp: number) {
  return FULL_DATE.format(new Date(timestamp * 1000))
}

function truncateMiddle(value: string, start = 10, end = 8) {
  if (value.length <= start + end + 3) return value
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export function RepositoryDetailsDrawer({ repo, onClose }: { repo: Repo | null; onClose: () => void }) {
  useEffect(() => {
    if (!repo) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [repo, onClose])

  if (!repo) return null

  const github = repo.github === 'not found' ? null : repo.github
  const name = repoNameParts(repo)
  const ownerLabel = repo.githubOwnerUsername === 'not found' ? 'not found' : repo.githubOwnerUsername
  const registeredDate = new Date(repo.registeredAt * 1000)
  const explorerUrl = explorerAddressUrl(repo.chainId, repo.registryAddress)
  const registrant = repo.registrant

  function copyRegistrant() {
    void navigator.clipboard?.writeText(registrant)
  }

  return (
    <>
      <div className="repo-drawer-scrim" onClick={onClose} />
      <aside className="repo-drawer" role="dialog" aria-modal="true" aria-labelledby="repo-drawer-title">
        <header className="repo-drawer__top">
          <h2 id="repo-drawer-title" className="repo-drawer__title">
            <span>{name.owner}/</span>
            <strong>{name.name}</strong>
          </h2>
          <button className="repo-drawer__close" type="button" onClick={onClose} aria-label="Close repository details">×</button>
        </header>

        <div className="repo-drawer__middle">
          <section className="repo-drawer__section" aria-labelledby="repo-metadata-title">
            <h3 id="repo-metadata-title">Repository metadata</h3>
            <dl className="repo-details-list">
              <div>
                <dt>Repo name</dt>
                <dd>{github ? <a className="fcf-link" href={github.htmlUrl} target="_blank" rel="noreferrer">{name.fullName}</a> : name.fullName}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{github?.description ?? 'not found'}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{github?.language ?? '-'}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>
                  {repo.githubOwnerUsername === 'not found' ? ownerLabel : <a className="fcf-link" href={`https://github.com/${repo.githubOwnerUsername}`} target="_blank" rel="noreferrer">{ownerLabel}</a>}
                  <span className="repo-detail-muted">ID {repo.githubOwnerId}</span>
                </dd>
              </div>
              <div>
                <dt>Repo ID</dt>
                <dd>{repo.repoId}</dd>
              </div>
            </dl>
          </section>

          <section className="repo-drawer__section" aria-labelledby="repo-onchain-title">
            <h3 id="repo-onchain-title">On-chain record</h3>
            <dl className="repo-details-list">
              <div>
                <dt>Registrant</dt>
                <dd className="repo-copy-value">
                  <span title={repo.registrant}>{truncateMiddle(repo.registrant)}</span>
                  <button className="repo-copy-button" type="button" onClick={copyRegistrant} aria-label="Copy registrant address">
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M7 2.5h8.5V12H14V4H7V2.5Z" />
                      <path d="M4.5 6h8.5v11.5H4.5V6Zm1.5 1.5V16h5.5V7.5H6Z" />
                    </svg>
                  </button>
                </dd>
              </div>
              <div>
                <dt>Tx hash</dt>
                <dd>{repo.transactionHash ? <a className="fcf-link" href={explorerTxUrl(repo.chainId, repo.transactionHash)} target="_blank" rel="noreferrer" title={repo.transactionHash}>{truncateMiddle(repo.transactionHash)}</a> : 'not available'}</dd>
              </div>
              <div>
                <dt>Block ID</dt>
                <dd><a className="fcf-link" href={explorerBlockUrl(repo.chainId, repo.blockNumber)} target="_blank" rel="noreferrer">{repo.blockNumber}</a></dd>
              </div>
              <div>
                <dt>Registered date</dt>
                <dd><time dateTime={registeredDate.toISOString()}>{fullDate(repo.registeredAt)}</time></dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{chainLabel(repo.chainId)} <span className="repo-detail-muted">Chain ID {repo.chainId}</span></dd>
              </div>
            </dl>
          </section>
        </div>

        <footer className="repo-drawer__bottom">
          {github ? (
            <ButtonLink className="repo-drawer__view-repo" href={github.htmlUrl} target="_blank" rel="noreferrer" variant="dark" size="sm">
              <img className="repo-drawer__github-icon" src={githubLogoUrl} alt="" />
              View Repo
            </ButtonLink>
          ) : (
            <Button className="repo-drawer__view-repo" variant="dark" size="sm" disabled>
              <img className="repo-drawer__github-icon" src={githubLogoUrl} alt="" />
              View Repo
            </Button>
          )}
          <ButtonLink href={explorerUrl} target="_blank" rel="noreferrer" size="sm">Explore</ButtonLink>
        </footer>
      </aside>
    </>
  )
}
